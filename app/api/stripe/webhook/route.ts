/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 *
 * サブスクリプション状態を DB に反映
 * - checkout.session.completed: 初回購入
 * - customer.subscription.created/updated: プラン変更検出 + 条件付きクレジットリセット
 * - customer.subscription.deleted: 解約完了
 * - invoice.payment_succeeded: 更新成功（月次クレジットリセット）
 * - invoice.payment_failed: 支払い失敗
 * - subscription_schedule.canceled/released: ダウングレード予定クリア
 *
 * 環境変数ベースの Price ID → プラン名 逆引きで判定
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { resolvePlanFromPrice, getPlanFromPriceId, PLAN_CREDITS } from '@/lib/plans';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * Unix タイムスタンプ（秒）を ISO 文字列に安全に変換するヘルパー
 * Stripe API バージョンによって current_period_start/end が
 * undefined や null になる場合があるため、ガード付きで変換する。
 */
function safeTimestamp(ts: number | null | undefined): string {
  if (ts == null || isNaN(ts)) {
    return new Date().toISOString(); // フォールバック: 現在時刻
  }
  return new Date(ts * 1000).toISOString();
}

/**
 * Subscription オブジェクトから current_period_start / end を安全に取得
 * Stripe 2025-11-17.clover 以降では items.data[0] にある場合がある
 */
function getPeriodFromSubscription(subscription: Stripe.Subscription): {
  periodStart: string;
  periodEnd: string;
} {
  // まずトップレベルを試す
  let start = (subscription as any).current_period_start;
  let end = (subscription as any).current_period_end;

  // トップレベルになければ items.data[0] から取得
  if (start == null || end == null) {
    const item = subscription.items?.data?.[0];
    if (item) {
      start = start ?? (item as any).current_period_start;
      end = end ?? (item as any).current_period_end;
    }
  }

  return {
    periodStart: safeTimestamp(start),
    periodEnd: safeTimestamp(end),
  };
}

export async function POST(request: NextRequest) {
  console.log('[Webhook] ====== Incoming request ======');
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    console.log('[Webhook] signature present:', !!signature);
    console.log('[Webhook] webhookSecret configured:', !!webhookSecret, 'length:', webhookSecret.length);

    if (!signature) {
      console.error('[Webhook] Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // 署名検証
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[Webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    console.log(`[Webhook] ✅ Event verified: ${event.type} (id: ${event.id})`);

    const supabase = createServiceClient();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, supabase);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription, supabase);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription, supabase);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        // 月次更新の場合のみ処理（初回購入は checkout.session.completed で処理）
        if (invoice.billing_reason === 'subscription_cycle') {
          await handleRenewalPayment(invoice, supabase);
        } else {
          console.log(`[Webhook] Payment succeeded (reason: ${invoice.billing_reason}), invoice: ${invoice.id}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice, supabase);
        break;
      }

      // Subscription Schedule 関連（ダウングレード予定のクリア）
      case 'subscription_schedule.canceled':
      case 'subscription_schedule.released': {
        const schedule = event.data.object as Stripe.SubscriptionSchedule;
        await handleScheduleCleared(schedule, supabase);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Price オブジェクトからプラン名を解決するヘルパー
 * subscription.items.data[0].price から lookup_key 優先で判定
 */
function resolvePlanFromSubscription(subscription: Stripe.Subscription): { priceId: string; plan: string } {
  const priceObj = subscription.items.data[0]?.price;
  const priceId = priceObj?.id || '';
  const plan = priceObj
    ? resolvePlanFromPrice({ id: priceObj.id, lookup_key: priceObj.lookup_key })
    : 'free';
  return { priceId, plan };
}

/**
 * Checkout 完了時の処理（初回購入）
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof createServiceClient>
) {
  const userId = session.client_reference_id || session.metadata?.userId;
  const subscriptionId = session.subscription as string;

  console.log('[Webhook][Checkout]', {
    sessionId: session.id,
    clientReferenceId: session.client_reference_id,
    metadataUserId: session.metadata?.userId,
    resolvedUserId: userId,
    customer: session.customer,
    subscriptionId,
  });

  if (!userId) {
    console.error('[Webhook] No userId found in checkout session — cannot update DB');
    return;
  }

  // サブスクリプション詳細を取得
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const { priceId, plan } = resolvePlanFromSubscription(subscription);
  const { periodStart, periodEnd } = getPeriodFromSubscription(subscription);

  // クレジット上限を算出
  const creditLimit = PLAN_CREDITS[plan] || 0;

  console.log('[Webhook][Checkout] Resolved:', { priceId, plan, creditLimit, status: subscription.status, periodStart, periodEnd });

  // DB に保存（クレジット初期化付き）
  const upsertData = {
    user_id: userId,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: subscriptionId,
    price_id: priceId,
    plan: plan,
    status: subscription.status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    pending_price_id: null,
    credits_limit: creditLimit,
    credits_remaining: creditLimit,
    credits_reset_at: new Date().toISOString(),
    monthly_usage_count: 0,
    updated_at: new Date().toISOString(),
  };

  console.log('[Webhook][Checkout] Upserting to subscriptions:', JSON.stringify(upsertData, null, 2));

  const { error, data } = await supabase.from('subscriptions').upsert(
    upsertData,
    { onConflict: 'user_id' }
  ).select();

  if (error) {
    console.error('[Webhook][SupabaseError] Error saving subscription:', error);
    throw error;
  }

  console.log(`[Webhook] ✅ Subscription saved: user=${userId}, plan=${plan}, credits=${creditLimit}`, data);
}

/**
 * サブスクリプション更新時の処理
 * プランが実際に変わった場合のみクレジットをリセット
 */
async function handleSubscriptionUpdate(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof createServiceClient>
) {
  // metadata.userId → customer ID でフォールバック
  let userId: string | null = subscription.metadata?.userId || null;
  if (!userId) {
    userId = await resolveUserIdByCustomer(subscription.customer as string, supabase);
  }
  if (!userId) {
    console.log('[Webhook] No userId found for subscription update, skipping...');
    return;
  }

  const { priceId, plan } = resolvePlanFromSubscription(subscription);
  const { periodStart, periodEnd } = getPeriodFromSubscription(subscription);

  // 現在の DB 状態を取得して、実際にプランが変わったか判定
  const { data: currentSub } = await supabase
    .from('subscriptions')
    .select('plan, price_id')
    .eq('user_id', userId)
    .single();

  const planActuallyChanged = currentSub?.plan !== plan;
  const creditLimit = PLAN_CREDITS[plan] || 0;

  // 更新データ構築
  const updateData: Record<string, any> = {
    user_id: userId,
    stripe_customer_id: subscription.customer as string,
    stripe_subscription_id: subscription.id,
    price_id: priceId,
    plan: plan,
    status: subscription.status,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  // プランが実際に変わった場合のみクレジットをリセット
  if (planActuallyChanged) {
    updateData.credits_limit = creditLimit;
    updateData.credits_remaining = creditLimit;
    updateData.credits_reset_at = new Date().toISOString();
    updateData.monthly_usage_count = 0;
    // ダウングレード予定をクリア（実際にプランが変わったので）
    updateData.pending_price_id = null;
    console.log(`[Webhook] Plan changed: ${currentSub?.plan} → ${plan}, credits reset to ${creditLimit}`);
  }

  // Subscription Schedule（ダウングレード予定）を検出
  if (subscription.schedule) {
    try {
      const schedule = await stripe.subscriptionSchedules.retrieve(
        subscription.schedule as string
      );
      const phases = schedule.phases;
      if (phases.length > 1) {
        const nextPhase = phases[phases.length - 1];
        // Stripe SDK の型で items は SubscriptionSchedulePhaseItem[]
        const nextPriceId = (nextPhase.items[0] as any)?.price;
        if (nextPriceId && nextPriceId !== priceId) {
          updateData.pending_price_id = nextPriceId;
          console.log(`[Webhook] Pending downgrade detected: ${nextPriceId}`);
        }
      }
    } catch (err) {
      console.error('[Webhook] Error retrieving schedule:', err);
    }
  }

  const { error } = await supabase.from('subscriptions').upsert(
    updateData,
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('[Webhook] Error updating subscription:', error);
    throw error;
  }

  console.log(`[Webhook] Subscription updated: user=${userId}, status=${subscription.status}, plan=${plan}, changed=${planActuallyChanged}`);
}

/**
 * サブスクリプション削除時の処理（解約完了）
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: ReturnType<typeof createServiceClient>
) {
  // metadata.userId → customer ID でフォールバック
  let userId: string | null = subscription.metadata?.userId || null;
  if (!userId) {
    userId = await resolveUserIdByCustomer(subscription.customer as string, supabase);
  }
  if (!userId) {
    console.log('[Webhook] No userId found for subscription deletion, skipping...');
    return;
  }

  // キャンセル時はfreeプランに戻す（無料プランはクレジット0、回数制で管理）
  const freeCreditLimit = 0;

  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      price_id: null,
      plan: 'free',
      status: 'canceled',
      cancel_at_period_end: false,
      pending_price_id: null,
      credits_limit: freeCreditLimit,
      credits_remaining: freeCreditLimit,
      credits_reset_at: new Date().toISOString(),
      monthly_usage_count: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('[Webhook] Error updating canceled subscription:', error);
  }

  console.log(`[Webhook] Subscription canceled: user=${userId}, credits reset to free (${freeCreditLimit})`);
}

/**
 * 月次更新の支払い成功時の処理
 * current_period_end を更新 + クレジットをリセット
 */
async function handleRenewalPayment(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof createServiceClient>
) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  let userId: string | null = subscription.metadata?.userId || null;
  if (!userId) {
    userId = await resolveUserIdByCustomer(subscription.customer as string, supabase);
  }
  if (!userId) {
    console.log('[Webhook] No userId for renewal payment, skipping...');
    return;
  }

  const { priceId, plan } = resolvePlanFromSubscription(subscription);
  const { periodStart, periodEnd } = getPeriodFromSubscription(subscription);
  const creditLimit = PLAN_CREDITS[plan] || 0;

  const { error } = await supabase
    .from('subscriptions')
    .update({
      current_period_start: periodStart,
      current_period_end: periodEnd,
      price_id: priceId,
      plan: plan,
      status: 'active',
      // 月次更新なのでクレジットをリセット
      credits_limit: creditLimit,
      credits_remaining: creditLimit,
      credits_reset_at: new Date().toISOString(),
      monthly_usage_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[Webhook] Error processing renewal:', error);
  }

  console.log(`[Webhook] Renewal processed: user=${userId}, plan=${plan}, credits reset to ${creditLimit}`);
}

/**
 * 支払い失敗時の処理
 */
async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: ReturnType<typeof createServiceClient>
) {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  let userId: string | null = subscription.metadata?.userId || null;
  if (!userId) {
    userId = await resolveUserIdByCustomer(subscription.customer as string, supabase);
  }
  if (!userId) {
    console.log('[Webhook] No userId for failed payment, skipping...');
    return;
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[Webhook] Error updating subscription status:', error);
  }

  console.log(`[Webhook] Payment failed: user=${userId}`);
}

/**
 * Stripe Customer ID から user_id を解決するフォールバック
 * metadata に userId がない場合（Dashboard操作等）の安全策
 */
async function resolveUserIdByCustomer(
  customerId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();
  if (data?.user_id) {
    console.log(`[Webhook] Resolved userId via customer_id: ${customerId} → ${data.user_id}`);
  }
  return data?.user_id || null;
}

/**
 * Subscription Schedule キャンセル/リリース時の処理
 * ダウングレード予定をクリア
 */
async function handleScheduleCleared(
  schedule: Stripe.SubscriptionSchedule,
  supabase: ReturnType<typeof createServiceClient>
) {
  const subscriptionId = schedule.subscription as string;
  if (!subscriptionId) return;

  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    let userId: string | null = sub.metadata?.userId || null;
    if (!userId) {
      userId = await resolveUserIdByCustomer(sub.customer as string, supabase);
    }
    if (!userId) {
      console.log('[Webhook] No userId for schedule event, skipping...');
      return;
    }

    const { error } = await supabase
      .from('subscriptions')
      .update({
        pending_price_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('[Webhook] Error clearing pending_price_id:', error);
    }

    console.log(`[Webhook] Schedule cleared for user: ${userId}`);
  } catch (err) {
    console.error('[Webhook] Error handling schedule event:', err);
  }
}

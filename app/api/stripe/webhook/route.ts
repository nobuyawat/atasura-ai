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
 * - charge.refunded: 返金完了 → plan=free, credits=0, status=refunded
 * - subscription_schedule.canceled/released: ダウングレード予定クリア
 *
 * 環境変数ベースの Price ID → プラン名 逆引きで判定
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { resolvePlanFromPrice, getPlanFromPriceId, PLAN_CREDITS, isKnownPriceId } from '@/lib/plans';
import { sendWelcomeEmail } from '@/lib/email/resend';

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

/**
 * Invoice から subscription ID を安全に取得するヘルパー
 * Stripe API 2025-11-17.clover ではトップレベルの invoice.subscription が null になり、
 * 代わりに invoice.parent.subscription_details.subscription にある
 */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // 1. トップレベル（旧APIバージョン）
  if (invoice.subscription) {
    return typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription.id;
  }

  // 2. parent.subscription_details（2025-11-17.clover 以降）
  const parent = (invoice as any).parent;
  if (parent?.subscription_details?.subscription) {
    return parent.subscription_details.subscription;
  }

  // 3. lines.data[0] からフォールバック
  const lineItem = invoice.lines?.data?.[0];
  if (lineItem) {
    const lineParent = (lineItem as any).parent;
    if (lineParent?.subscription_item_details?.subscription) {
      return lineParent.subscription_item_details.subscription;
    }
    // 旧バージョンでは lineItem.subscription に直接あることも
    if ((lineItem as any).subscription) {
      return (lineItem as any).subscription;
    }
  }

  console.warn('[Webhook] Could not extract subscription ID from invoice:', invoice.id);
  return null;
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

    // 各ハンドラのエラーを個別にキャッチし、200を返す構造にする
    // Stripeは500を受けるとリトライし続けるため、処理エラーでも200を返す
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const handled = await handleCheckoutCompleted(session, supabase);
          // ★アタスラAI商品のときだけウェルカムメール送信。
          //   共有Stripeアカウント上の別商品（Fluent Room等）には送らない（誤送信防止）。
          if (handled) {
            await sendWelcomeEmailSafe(event, session, supabase);
          }
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

        // ── 返金イベント ──
        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          await handleChargeRefunded(charge, supabase);
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
          console.log(`[Webhook] Unhandled event type: ${event.type} — returning 200`);
      }
    } catch (handlerError) {
      // ハンドラ内のエラーはログに記録するが、200を返す
      // Stripeが500を受けるとリトライし続けるため
      console.error(`[Webhook] Handler error for ${event.type}:`, handlerError);
    }

    console.log(`[Webhook] ====== Done: ${event.type} ======`);
    return NextResponse.json({ received: true });
  } catch (error) {
    // ここに到達するのは署名検証前のエラー（body取得失敗等）のみ
    console.error('[Webhook] Fatal error (pre-verification):', error);
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
): Promise<boolean> {
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
    return false;
  }

  // サブスクリプション詳細を取得
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const { priceId, plan } = resolvePlanFromSubscription(subscription);

  // ★共有Stripeアカウント上の別商品（Fluent Room等）はアタスラAIで処理しない。
  if (!isKnownPriceId(priceId)) {
    console.log('[Webhook] Skipping non-Atasura product (checkout):', priceId);
    return false;
  }

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
    return false; // エラーをthrowせず、200を返せるようにする
  }

  console.log(`[Webhook] ✅ Subscription saved: user=${userId}, plan=${plan}, credits=${creditLimit}`, data);
  return true;
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

  // ★共有Stripeアカウント上の別商品（Fluent Room等）はアタスラAIで処理しない。
  if (!isKnownPriceId(priceId)) {
    console.log('[Webhook] Skipping non-Atasura product (subscription update):', priceId);
    return;
  }

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
    return; // エラーをthrowせず、200を返せるようにする
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
  // ★共有Stripeアカウント上の別商品（Fluent Room等）の解約はアタスラAIで処理しない。
  const delPriceId = subscription.items?.data?.[0]?.price?.id;
  if (!isKnownPriceId(delPriceId)) {
    console.log('[Webhook] Skipping non-Atasura product (subscription deleted):', delPriceId);
    return;
  }

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
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    console.warn(`[Webhook] No subscriptionId in invoice ${invoice.id}, skipping renewal`);
    return;
  }

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
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    console.warn(`[Webhook] No subscriptionId in invoice ${invoice.id}, skipping payment failed`);
    return;
  }

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

/**
 * 返金（charge.refunded）時の処理
 *
 * Stripe Dashboard で返金が実行された場合に発火。
 * 1. 冪等性チェック（同一 charge の二重処理防止）
 * 2. customer_id → user_id 解決
 * 3. サブスクリプションをキャンセル（アクティブなら）
 * 4. DB を free プランに戻す（クレジット0、ステータス refunded）
 * 5. refund_requests テーブルを processed に更新
 *
 * 部分返金（amount_refunded < amount）はログのみ、プラン変更しない。
 */
async function handleChargeRefunded(
  charge: Stripe.Charge,
  supabase: ReturnType<typeof createServiceClient>
) {
  const customerId = charge.customer as string;
  const isFullRefund = charge.refunded === true;
  const amountRefunded = charge.amount_refunded;
  const totalAmount = charge.amount;

  console.log(`[Webhook][Refund] charge.refunded received`, {
    chargeId: charge.id,
    customerId,
    amount: totalAmount,
    amountRefunded,
    isFullRefund,
    paymentIntent: charge.payment_intent,
  });

  // ── 0. 部分返金はログのみ ──
  if (!isFullRefund) {
    console.log(`[Webhook][Refund] Partial refund (${amountRefunded}/${totalAmount}), no plan change`);
    return;
  }

  // ── 1. customer_id → user_id 解決 ──
  const userId = await resolveUserIdByCustomer(customerId, supabase);
  if (!userId) {
    console.error(`[Webhook][Refund] No user found for customer: ${customerId}`);
    return;
  }

  // ── 2. 冪等性チェック: 既に refunded なら skip ──
  const { data: currentSub } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, plan, status')
    .eq('user_id', userId)
    .single();

  if (currentSub?.status === 'refunded') {
    console.log(`[Webhook][Refund] User ${userId} already refunded, skipping`);
    return;
  }

  // ── 3. サブスクリプションをキャンセル（アクティブなら） ──
  if (currentSub?.stripe_subscription_id && currentSub.status !== 'canceled') {
    try {
      await stripe.subscriptions.cancel(currentSub.stripe_subscription_id);
      console.log(`[Webhook][Refund] Subscription ${currentSub.stripe_subscription_id} canceled`);
    } catch (cancelErr) {
      // 既にキャンセル済み等の場合もあるのでログのみ
      console.warn(`[Webhook][Refund] Could not cancel subscription:`, cancelErr);
    }
  }

  // ── 4. DB を free プランに戻す ──
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      plan: 'free',
      status: 'refunded',
      price_id: null,
      cancel_at_period_end: false,
      pending_price_id: null,
      credits_limit: 0,
      credits_remaining: 0,
      credits_reset_at: new Date().toISOString(),
      monthly_usage_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) {
    console.error(`[Webhook][Refund] Error updating subscription to free:`, updateError);
    return; // エラーをthrowせず、200を返せるようにする
  }

  console.log(`[Webhook][Refund] ✅ User ${userId} reverted to free plan (refunded from ${currentSub?.plan})`);

  // ── 5. refund_requests テーブルを更新（存在する場合） ──
  try {
    const { error: refundReqError } = await supabase
      .from('refund_requests')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (refundReqError) {
      console.warn(`[Webhook][Refund] refund_requests update skipped:`, refundReqError);
    }
  } catch {
    // refund_requests テーブルが存在しない場合も安全にスキップ
    console.warn(`[Webhook][Refund] refund_requests table not accessible, skipping`);
  }

  console.log(`[Webhook][Refund] ✅ Refund processing complete for user ${userId}`);
}

/* ================================================================== */
/*  Welcome Email — 安全ラッパー                                       */
/*  送信失敗しても決済・DB処理を止めない。冪等性保証付き。              */
/* ================================================================== */
async function sendWelcomeEmailSafe(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  supabase: ReturnType<typeof createServiceClient>
) {
  try {
    // ── 1) 冪等チェック: 同一 event.id で送信済みなら skip ──
    const { data: existing } = await supabase
      .from('email_logs')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (existing) {
      console.log(`[Webhook][Email] Already processed event ${event.id}, skipping`);
      return;
    }

    // ── 2) 宛先メール解決 ──
    let toEmail = session.customer_email;
    if (!toEmail && session.customer) {
      try {
        const customer = await stripe.customers.retrieve(
          session.customer as string
        );
        if (customer && !customer.deleted) {
          toEmail = (customer as Stripe.Customer).email;
        }
      } catch (e) {
        console.warn('[Webhook][Email] Failed to fetch customer email:', e);
      }
    }

    if (!toEmail) {
      console.warn('[Webhook][Email] No email found for session, skipping welcome email');
      return;
    }

    // ── 3) プラン名解決（表示用） ──
    const planLabelMap: Record<string, string> = {
      starter: 'スタータープラン',
      basic: 'ベーシックプラン',
      creator: 'クリエイタープラン',
    };
    let planName = 'ご契約プラン';
    if (session.subscription) {
      try {
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const resolved = resolvePlanFromSubscription(sub);
        planName = planLabelMap[resolved.plan] || planName;
      } catch {
        // プラン名が取れなくても送信は続行
      }
    }

    // ── 4) Resend で送信 ──
    console.log(`[Webhook][Email] Sending welcome email to ${toEmail}`);
    const result = await sendWelcomeEmail({
      to: toEmail,
      name: session.customer_details?.name || undefined,
      plan: planName,
    });

    // Resend v2 SDK: result.data / result.error
    const emailId = (result as any)?.data?.id;
    const emailError = (result as any)?.error;

    if (emailError) {
      console.error('[Webhook][Email] Resend error:', emailError);
      // 送信失敗を記録（retry時に再送しない）
      await supabase.from('email_logs').insert({
        stripe_event_id: event.id,
        user_id: session.client_reference_id || session.metadata?.userId || null,
        email: toEmail,
        type: 'welcome',
        status: 'failed',
        error_message: typeof emailError === 'string' ? emailError : JSON.stringify(emailError),
        payload: {
          checkout_session_id: session.id,
          customer_id: session.customer,
          plan: planName,
          resend_error: emailError,
        },
      });
      return;
    }

    // ── 5) 成功ログ保存 ──
    await supabase.from('email_logs').insert({
      stripe_event_id: event.id,
      user_id: session.client_reference_id || session.metadata?.userId || null,
      email: toEmail,
      type: 'welcome',
      status: 'sent',
      payload: {
        checkout_session_id: session.id,
        customer_id: session.customer,
        plan: planName,
        resend_email_id: emailId,
      },
    });

    console.log(`[Webhook][Email] ✅ Welcome email sent to ${toEmail} (resend_id: ${emailId})`);
  } catch (err) {
    // メール送信の全エラーをキャッチ — 決済フローを止めない
    console.error('[Webhook][Email] Unexpected error (non-fatal):', err);
  }
}

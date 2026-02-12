/**
 * Checkout Session 検証 & DB バックフィル API
 * POST /api/stripe/verify-session
 *
 * Webhook が届かなかった場合の安全策。
 * checkout/success ページから呼ばれ、Stripe API で session を直接確認し、
 * DB に反映されていなければ upsert する。
 *
 * ユーザー認証必須（セッションの client_reference_id と一致確認）
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { resolvePlanFromPrice, PLAN_CREDITS } from '@/lib/plans';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // ユーザー認証
    const supabaseAuth = createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[VerifySession] Checking session:', sessionId, 'for user:', user.id);

    // Stripe から Checkout Session を取得
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price'],
    });

    // セッションの所有者を確認
    const sessionUserId = session.client_reference_id || session.metadata?.userId;
    if (sessionUserId !== user.id) {
      console.error('[VerifySession] User mismatch:', { sessionUserId, authUserId: user.id });
      return NextResponse.json({ error: 'Session does not belong to this user' }, { status: 403 });
    }

    // セッションが完了しているか確認
    if (session.payment_status !== 'paid') {
      console.log('[VerifySession] Session not yet paid:', session.payment_status);
      return NextResponse.json({
        status: 'pending',
        message: 'Payment not yet completed',
      });
    }

    // DB の現在の状態を確認
    const supabase = createServiceClient();
    const { data: currentSub } = await supabase
      .from('subscriptions')
      .select('plan, status, stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription as any)?.id;

    // 既に DB に反映済みなら何もしない
    if (currentSub?.stripe_subscription_id === subscriptionId && currentSub?.status === 'active') {
      console.log('[VerifySession] Already up to date:', currentSub.plan);
      return NextResponse.json({
        status: 'ok',
        plan: currentSub.plan,
        message: 'Already synced',
      });
    }

    // Subscription 詳細を取得
    const subscription = typeof session.subscription === 'object' && session.subscription
      ? session.subscription as any
      : await stripe.subscriptions.retrieve(subscriptionId);

    const priceObj = subscription.items?.data?.[0]?.price;
    const priceId = priceObj?.id || '';
    const plan = priceObj
      ? resolvePlanFromPrice({ id: priceObj.id, lookup_key: priceObj.lookup_key })
      : 'free';
    const creditLimit = PLAN_CREDITS[plan] || 0;

    console.log('[VerifySession] Backfilling:', { plan, priceId, creditLimit, subscriptionStatus: subscription.status });

    // DB に upsert（バックフィル）
    const { error, data } = await supabase.from('subscriptions').upsert(
      {
        user_id: user.id,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscriptionId,
        price_id: priceId,
        plan,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        pending_price_id: null,
        credits_limit: creditLimit,
        credits_remaining: creditLimit,
        credits_reset_at: new Date().toISOString(),
        monthly_usage_count: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    ).select();

    if (error) {
      console.error('[VerifySession][SupabaseError]', error);
      return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }

    console.log('[VerifySession] ✅ Backfill complete:', { plan, creditLimit }, data);

    return NextResponse.json({
      status: 'ok',
      plan,
      credits: creditLimit,
      message: 'Subscription synced via verify-session',
    });
  } catch (error) {
    console.error('[VerifySession] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

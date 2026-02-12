/**
 * サブスクリプション 解約 API
 * POST /api/stripe/subscription/cancel
 *
 * cancel_at_period_end = true に設定（次回更新で停止）
 * { reactivate: true } で解約取り消しも可能
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    // 1. 認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. リクエスト解析
    const body = await request.json().catch(() => ({}));
    const { reactivate } = body;

    // 3. 現在のサブスクリプションを取得
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .single();

    if (!sub?.stripe_subscription_id) {
      return NextResponse.json({ error: 'アクティブなサブスクリプションがありません' }, { status: 400 });
    }

    // 4a. 解約取り消し（reactivate）
    if (reactivate) {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: false,
      });

      // DB の cancel_at_period_end と pending_price_id を即座にクリア
      // （Webhook 到達前に UI に反映するための防御的更新）
      await supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: false,
          pending_price_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      console.log(`[Cancel] User ${user.id}: reactivated subscription`);

      return NextResponse.json({
        success: true,
        cancelAtPeriodEnd: false,
        message: 'サブスクリプションの解約を取り消しました',
      });
    }

    // 4b. 解約（cancel_at_period_end = true）
    const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);

    // 既存の Schedule があれば解放
    if (current.schedule) {
      await stripe.subscriptionSchedules.release(current.schedule as string);
      console.log(`[Cancel] Released existing schedule: ${current.schedule}`);
    }

    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    const cancelAt = new Date(updated.current_period_end * 1000).toISOString();

    console.log(`[Cancel] User ${user.id}: cancel_at_period_end=true, cancelAt=${cancelAt}`);

    // Webhook (customer.subscription.updated) が DB の cancel_at_period_end を更新する
    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: true,
      cancelAt,
      message: `次回更新日（${new Date(updated.current_period_end * 1000).toLocaleDateString('ja-JP')}）にサブスクリプションが解約されます。それまで現在のプランをご利用いただけます。`,
    });
  } catch (error) {
    console.error('[Cancel] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '解約処理に失敗しました' },
      { status: 500 }
    );
  }
}

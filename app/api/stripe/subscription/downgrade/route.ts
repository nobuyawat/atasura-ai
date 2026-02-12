/**
 * サブスクリプション ダウングレード API
 * POST /api/stripe/subscription/downgrade
 *
 * lookup_key ベースで新プランの Price を動的取得し、
 * Subscription Schedule を使って次回更新日からプランを変更。
 * 今月は現行プランのまま利用可能。
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { getPriceIdForPlan, isDowngrade, getPlanDisplayName } from '@/lib/plans';

export async function POST(request: NextRequest) {
  try {
    // 1. 認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. リクエスト解析
    const { newPlan } = await request.json();
    if (!newPlan) {
      return NextResponse.json({ error: 'newPlan is required' }, { status: 400 });
    }

    // 3. free への変更は解約エンドポイントを案内
    if (newPlan === 'free') {
      return NextResponse.json(
        { error: '無料プランへの変更は解約エンドポイントをご利用ください（POST /api/stripe/subscription/cancel）' },
        { status: 400 }
      );
    }

    // lookup_key 経由で Price ID を取得（非同期）
    let newPriceId: string;
    try {
      newPriceId = await getPriceIdForPlan(newPlan);
    } catch (err: any) {
      console.error(`[Downgrade] Failed to resolve price for plan=${newPlan}:`, err.message);
      return NextResponse.json({ error: `Invalid plan: ${newPlan}` }, { status: 400 });
    }

    // 4. 現在のサブスクリプションを取得
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, plan')
      .eq('user_id', user.id)
      .single();

    if (!sub?.stripe_subscription_id) {
      return NextResponse.json({ error: 'アクティブなサブスクリプションがありません' }, { status: 400 });
    }

    // 5. ダウングレードか検証
    if (!isDowngrade(sub.plan, newPlan)) {
      return NextResponse.json(
        { error: 'これはダウングレードではありません。アップグレードAPIをご利用ください。' },
        { status: 400 }
      );
    }

    // 6. Stripe サブスクリプション取得
    const current = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const currentPriceId = current.items.data[0].price.id;

    // 7. 既存の Schedule があれば解放
    if (current.schedule) {
      await stripe.subscriptionSchedules.release(current.schedule as string);
      console.log(`[Downgrade] Released existing schedule: ${current.schedule}`);
    }

    // 8. Subscription Schedule 作成（現行サブスクリプションから）
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: sub.stripe_subscription_id,
    });

    // 9. スケジュールにフェーズを設定
    //    Phase 1: 現行プラン → 期間終了まで
    //    Phase 2: 新プラン → 次の期間
    await stripe.subscriptionSchedules.update(schedule.id, {
      phases: [
        {
          items: [{ price: currentPriceId, quantity: 1 }],
          start_date: current.current_period_start,
          end_date: current.current_period_end,
        },
        {
          items: [{ price: newPriceId, quantity: 1 }],
          iterations: 1,
        },
      ],
    });

    // 10. DB に pending_price_id を保存（service_role で書き込み）
    const serviceClient = createServiceClient();
    await serviceClient
      .from('subscriptions')
      .update({
        pending_price_id: newPriceId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    const effectiveDate = new Date(current.current_period_end * 1000).toISOString();

    console.log(`[Downgrade] User ${user.id}: ${sub.plan} → ${newPlan} (effective: ${effectiveDate})`);

    return NextResponse.json({
      success: true,
      pendingPlan: newPlan,
      pendingPlanDisplayName: getPlanDisplayName(newPlan),
      effectiveDate,
      message: `次回更新日（${new Date(current.current_period_end * 1000).toLocaleDateString('ja-JP')}）に${getPlanDisplayName(newPlan)}に変更されます`,
    });
  } catch (error) {
    console.error('[Downgrade] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ダウングレードに失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * サブスクリプション アップグレード API
 * POST /api/stripe/subscription/upgrade
 *
 * lookup_key ベースで新プランの Price を動的取得し、
 * 即時プロレーション（差額請求）でプランをアップグレード。
 * Webhook (customer.subscription.updated) が DB を更新する。
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { getPriceIdForPlan, resolvePlanFromPrice, isUpgrade, getPlanDisplayName } from '@/lib/plans';

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

    // lookup_key 経由で Price ID を取得（非同期）
    let newPriceId: string;
    try {
      newPriceId = await getPriceIdForPlan(newPlan);
    } catch (err: any) {
      console.error(`[Upgrade] Failed to resolve price for plan=${newPlan}:`, err.message);
      return NextResponse.json({ error: `Invalid plan: ${newPlan}` }, { status: 400 });
    }

    // 3. 現在のサブスクリプションを取得
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, plan')
      .eq('user_id', user.id)
      .single();

    if (!sub?.stripe_subscription_id) {
      return NextResponse.json({ error: 'アクティブなサブスクリプションがありません' }, { status: 400 });
    }

    // 4. アップグレードか検証
    if (!isUpgrade(sub.plan, newPlan)) {
      return NextResponse.json(
        { error: 'これはアップグレードではありません。ダウングレードAPIをご利用ください。' },
        { status: 400 }
      );
    }

    // 5. Stripe サブスクリプション取得
    const stripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const itemId = stripeSubscription.items.data[0].id;

    // 6. 既存の Subscription Schedule があれば解放（ダウングレード予定をキャンセル）
    if (stripeSubscription.schedule) {
      await stripe.subscriptionSchedules.release(stripeSubscription.schedule as string);
      console.log(`[Upgrade] Released existing schedule: ${stripeSubscription.schedule}`);
    }

    // 7. 即時アップグレード（プロレーション付き）
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
    });

    // price オブジェクトから lookup_key 優先でプラン名を解決
    const updatedPrice = updated.items.data[0].price;
    const updatedPlan = resolvePlanFromPrice({
      id: updatedPrice.id,
      lookup_key: updatedPrice.lookup_key,
    });

    console.log(`[Upgrade] User ${user.id}: ${sub.plan} → ${updatedPlan}`);

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
      planDisplayName: getPlanDisplayName(updatedPlan),
      message: `${getPlanDisplayName(updatedPlan)}にアップグレードしました`,
    });
  } catch (error) {
    console.error('[Upgrade] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'アップグレードに失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * サブスクリプション情報取得 API
 * GET /api/stripe/subscription
 *
 * 認証ユーザーの現在のサブスクリプション状態を返す
 * pending_price_id → プラン名解決は環境変数ベースの逆引きマップ
 *
 * 注意: キャッシュ厳禁（通常/シークレット問わず常にDB最新値を返す）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanFromPriceId, getPlanDisplayName } from '@/lib/plans';

// Vercel / Next.js のレスポンスキャッシュを完全に無効化
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, price_id, current_period_end, cancel_at_period_end, pending_price_id, stripe_customer_id, credits_remaining, credits_limit')
      .eq('user_id', user.id)
      .single();

    if (!sub) {
      return NextResponse.json({
        plan: 'free',
        planDisplayName: '無料プラン',
        status: 'active',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        pendingPlan: null,
        pendingPlanDisplayName: null,
        hasStripeCustomer: false,
        creditsRemaining: 0,
        creditsLimit: 0,
      });
    }

    const pendingPlan = sub.pending_price_id
      ? getPlanFromPriceId(sub.pending_price_id)
      : null;

    const response = NextResponse.json({
      plan: sub.plan,
      planDisplayName: getPlanDisplayName(sub.plan),
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      pendingPlan,
      pendingPlanDisplayName: pendingPlan ? getPlanDisplayName(pendingPlan) : null,
      hasStripeCustomer: !!sub.stripe_customer_id,
      creditsRemaining: sub.credits_remaining ?? 0,
      creditsLimit: sub.credits_limit ?? 0,
    });

    // CDN / ブラウザキャッシュを完全に無効化
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');

    return response;
  } catch (error) {
    console.error('[Subscription] Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription info' },
      { status: 500 }
    );
  }
}

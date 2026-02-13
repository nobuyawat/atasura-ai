/**
 * クレジット残高確認 API
 * GET /api/credits
 *
 * フロントエンドからクレジット残高を取得
 * 無料プランの場合は回数制情報も返す
 *
 * 注意: キャッシュ厳禁（通常/シークレット問わず常にDB最新値を返す）
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkCredits, checkFreePlanLimit, CREDITS_PER_VIDEO, PLAN_CREDITS } from '@/lib/credits';

// Vercel / Next.js のレスポンスキャッシュを完全に無効化
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // ユーザー認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const creditCheck = await checkCredits(user.id);

    // デバッグログ（Vercel Logs で確認用）
    console.log(`[credits] GET: user=${user.id}, plan=${creditCheck.plan}, credits_remaining=${creditCheck.creditsRemaining}`);

    // 動画換算数も返す
    const videosRemaining = Math.floor(creditCheck.creditsRemaining / CREDITS_PER_VIDEO);
    const videosLimit = Math.floor((PLAN_CREDITS[creditCheck.plan] || 0) / CREDITS_PER_VIDEO);

    // 無料プランの回数制情報
    const freePlanCheck = await checkFreePlanLimit(user.id);

    const response = NextResponse.json({
      creditsRemaining: creditCheck.creditsRemaining,
      creditsLimit: PLAN_CREDITS[creditCheck.plan] || 0,
      creditsPerVideo: CREDITS_PER_VIDEO,
      plan: creditCheck.plan,
      hasCredits: creditCheck.plan === 'free' ? freePlanCheck.allowed : creditCheck.hasCredits,
      videosRemaining,
      videosLimit,
      // 無料プラン回数制情報
      freePlan: {
        uses: freePlanCheck.uses,
        limit: freePlanCheck.limit,
        locked: freePlanCheck.locked,
      },
    });

    // CDN / ブラウザキャッシュを完全に無効化
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');

    return response;
  } catch (error: any) {
    console.error('[credits] Error:', error?.message);
    return NextResponse.json(
      { error: 'クレジット情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

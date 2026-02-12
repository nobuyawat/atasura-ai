/**
 * クレジット消費 API
 * POST /api/credits/consume
 *
 * 動画生成完了時に11クレジットを一括消費
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { consumeCredits, CREDITS_PER_VIDEO } from '@/lib/credits';

interface ConsumeRequest {
  sessionId?: string;
  amount?: number; // デフォルト: CREDITS_PER_VIDEO (11)
}

export async function POST(request: NextRequest) {
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

    const body: ConsumeRequest = await request.json();
    const amount = body.amount || CREDITS_PER_VIDEO;

    console.log(`[credits/consume] User: ${user.id}, Amount: ${amount}, Session: ${body.sessionId || 'none'}`);

    const result = await consumeCredits(user.id, amount, body.sessionId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          creditsRemaining: result.creditsRemaining,
        },
        { status: result.error === 'insufficient_credits' ? 402 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      creditsConsumed: result.creditsConsumed,
      creditsRemaining: result.creditsRemaining,
    });
  } catch (error: any) {
    console.error('[credits/consume] Error:', error?.message);
    return NextResponse.json(
      { error: 'クレジット消費に失敗しました' },
      { status: 500 }
    );
  }
}

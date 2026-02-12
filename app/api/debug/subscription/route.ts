/**
 * 診断用 API — サブスクリプション状態確認
 * GET /api/debug/subscription
 *
 * 現在ログイン中のユーザーの subscriptions レコードを
 * service_role で取得して返す（RLS バイパス）。
 * UI 問題と DB 問題の切り分けに使用。
 *
 * ⚠️ 本番では無効化 or 削除すること
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // ユーザー認証（anon key — cookie ベース）
    const supabaseAuth = createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    // service_role で subscriptions を取得（RLS バイパス）
    const supabase = createServiceClient();
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      subscription: sub || null,
      dbError: error?.message || null,
      timestamp: new Date().toISOString(),
      env: {
        STRIPE_PRICE_ID_STARTER: process.env.STRIPE_PRICE_ID_STARTER ? '***set***' : '***MISSING***',
        STRIPE_PRICE_ID_BASIC: process.env.STRIPE_PRICE_ID_BASIC ? '***set***' : '***MISSING***',
        STRIPE_PRICE_ID_CREATOR: process.env.STRIPE_PRICE_ID_CREATOR ? '***set***' : '***MISSING***',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? '***set***' : '***MISSING***',
      },
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

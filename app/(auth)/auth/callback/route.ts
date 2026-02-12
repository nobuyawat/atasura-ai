/**
 * OAuth Callback Route Handler
 * /auth/callback
 *
 * Supabase OAuth 認証後のコールバック処理
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/app';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // エラーがある場合
  if (error) {
    console.error('[Auth Callback] OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // コードがない場合
  if (!code) {
    console.error('[Auth Callback] No code provided');
    return NextResponse.redirect(`${origin}/login?error=認証コードがありません`);
  }

  try {
    const supabase = createClient();

    // 認証コードをセッションに交換
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[Auth Callback] Exchange error:', exchangeError);
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      );
    }

    console.log('[Auth Callback] Session created successfully');

    // リダイレクト先へ
    return NextResponse.redirect(`${origin}${redirect}`);
  } catch (err) {
    console.error('[Auth Callback] Unexpected error:', err);
    return NextResponse.redirect(`${origin}/login?error=認証処理中にエラーが発生しました`);
  }
}

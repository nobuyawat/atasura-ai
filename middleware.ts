/**
 * Next.js Middleware
 * 認証が必要なルートをサーバーサイドで保護
 */

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// 認証が必要なパス
const PROTECTED_PATHS = [
  '/app',
  '/checkout/success',
  '/checkout/cancel',
];

// 認証済みユーザーがアクセスすべきでないパス
const AUTH_PATHS = [
  '/login',
];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // 認証が必要なパスへのアクセス
  const isProtectedPath = PROTECTED_PATHS.some(path =>
    pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isProtectedPath && !user) {
    // 未認証 → ログインページへリダイレクト
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 認証済みユーザーがログインページにアクセス
  const isAuthPath = AUTH_PATHS.some(path =>
    pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isAuthPath && user) {
    // 認証済み → アプリページへリダイレクト
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのリクエストパスにマッチ:
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico (ファビコン)
     * - public フォルダ内のファイル
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
};

'use client';

/**
 * ログインページ (/login)
 * Google OAuth によるログイン
 */

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Loader2 } from 'lucide-react';

function LoginContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/app';

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05060f] text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ホームに戻る</span>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-[#FF1E56] to-purple-600 rounded-2xl mb-6 shadow-lg shadow-[#FF1E56]/20">
              <span className="text-white font-bold text-3xl">ア</span>
            </div>
            <h1 className="text-3xl font-black mb-2">アタスラAIにログイン</h1>
            <p className="text-gray-400">
              Googleアカウントで簡単にログインできます
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-gray-900 rounded-xl font-bold text-lg hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span>{isLoading ? 'ログイン中...' : 'Googleでログイン'}</span>
            </button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-gray-500 text-sm">または</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Terms */}
            <p className="text-center text-gray-500 text-sm">
              ログインすることで、
              <a href="https://spiffy-fenglisu-bc21c8.netlify.app/" target="_blank" rel="noopener noreferrer" className="text-[#FF1E56] hover:underline">利用規約</a>
              と
              <a href="https://euphonious-brioche-c80573.netlify.app/" target="_blank" rel="noopener noreferrer" className="text-[#FF1E56] hover:underline">プライバシーポリシー</a>
              に同意したことになります。
            </p>
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              まだアカウントをお持ちでない方も、
              <br />
              Googleでログインするとアカウントが自動作成されます。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

// ローディングフォールバック
function LoginLoading() {
  return (
    <div className="min-h-screen bg-[#05060f] text-white flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#FF1E56]" />
    </div>
  );
}

// Suspenseでラップしたエクスポート
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}

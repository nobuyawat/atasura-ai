'use client';

/**
 * アプリメインページ (/app)
 * 認証必須 - 本体の講座作成機能
 */

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SetupScreen from '@/components/setup/SetupScreen';
import EditorScreen from '@/components/editor/EditorScreen';
import { CourseData, AppScreen } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { LogOut, Crown, Home, CreditCard, Settings, User } from 'lucide-react';

// ユーザー情報の型
interface UserInfo {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  plan: string;
  cancelAtPeriodEnd?: boolean;
  pendingPriceId?: string | null;
}

export default function AppPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<AppScreen>('setup');
  const [course, setCourse] = useState<CourseData | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // ユーザー情報とサブスクリプションを取得
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();

      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push('/login');
        return;
      }

      // サブスクリプション情報を取得
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, status, cancel_at_period_end, pending_price_id')
        .eq('user_id', authUser.id)
        .single();

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        displayName: authUser.user_metadata?.full_name || authUser.email || '',
        avatarUrl: authUser.user_metadata?.avatar_url,
        plan: subscription?.plan || 'free',
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
        pendingPriceId: subscription?.pending_price_id || null,
      });

      setLoading(false);
    };

    fetchUser();
  }, [router]);

  // ログアウト処理
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  // セットアップ完了時
  const handleSetupComplete = useCallback((newCourse: CourseData) => {
    console.log('[APP] Setup completed, transitioning to editor');
    setCourse(newCourse);
    setScreen('editor');
  }, []);

  // コースデータ更新時
  const handleCourseUpdate = useCallback((updatedCourse: CourseData) => {
    console.log('[APP] Course updated');
    setCourse(updatedCourse);
  }, []);

  // ローディング中
  if (loading) {
    return (
      <div className="min-h-screen bg-[#05060f] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#FF1E56] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 py-2 flex justify-between items-center bg-[#05060f]/95 backdrop-blur-md border-b border-white/10">
        {/* Left: Logo */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-tr from-[#FF1E56] to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">ア</span>
            </div>
            <span className="font-bold text-white hidden sm:inline">アタスラAI</span>
          </Link>

          <Link
            href="/"
            className="text-gray-400 hover:text-white transition-colors text-xs flex items-center gap-1"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ホーム</span>
          </Link>
        </div>

        {/* Center: Plan Badge */}
        {user && (
          <div className="hidden md:flex items-center">
            {user.plan === 'free' ? (
              <Link
                href="/pricing"
                className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-full hover:border-indigo-500/50 transition-all text-xs"
              >
                <Crown className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-gray-300">無料プラン</span>
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-indigo-400 font-medium">アップグレード</span>
              </Link>
            ) : (
              <Link
                href="/app/plan"
                className="flex items-center gap-2 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs hover:border-yellow-500/40 transition-all"
              >
                <Crown className="w-3.5 h-3.5 text-yellow-500" />
                <span className="text-yellow-400 font-medium capitalize">{user.plan}プラン</span>
                {user.cancelAtPeriodEnd && (
                  <span className="text-[8px] font-bold px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full">解約予定</span>
                )}
                <Settings className="w-3 h-3 text-gray-400" />
              </Link>
            )}
          </div>
        )}

        {/* Right: User Menu */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Avatar"
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {user.email.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-gray-300 hidden lg:inline max-w-[120px] truncate">
                {user.displayName}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-xs px-2 py-1 rounded hover:bg-white/5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ログアウト</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {screen === 'setup' && (
          <SetupScreen onComplete={handleSetupComplete} />
        )}

        {screen === 'editor' && course && (
          <EditorScreen course={course} onCourseUpdate={handleCourseUpdate} />
        )}
      </main>
    </div>
  );
}

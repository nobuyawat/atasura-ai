'use client';

/**
 * モバイル専用統合ヘッダー（lg以上では非表示）
 *
 * 構成:
 *   1行目: ロゴ + ハンバーガーボタン
 *   2行目: 横スクロールナビタブ
 *
 * sticky top-0 で固定2段問題を回避:
 *   - iOS Safari の URLバー挙動差を吸収
 *   - スクロール時は上に抜ける（fixed ではない）
 *   - 各ページに pt-[104px] 等の固定パディング不要
 *
 * /app, /login, /checkout では非表示
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/', label: 'TOP' },
  { href: '/showcase', label: '実例' },
  { href: '/problems', label: 'お悩み' },
  { href: '/howto', label: '使い方' },
  { href: '/pricing', label: '料金' },
  { href: '/faq', label: 'FAQ' },
  { href: '/demo', label: 'デモ' },
];

const MENU_ITEMS = [
  { href: '/', label: 'TOP' },
  { href: '/showcase', label: '実例' },
  { href: '/problems', label: 'よくあるお悩み' },
  { href: '/howto', label: '使い方' },
  { href: '/pricing', label: '料金' },
  { href: '/faq', label: 'よくある質問' },
  { href: '/demo', label: 'デモ' },
];

/** アプリ内ページでは表示しないパス */
const HIDDEN_PATHS = ['/app', '/login', '/checkout'];

export const SharedMobileHeader: React.FC = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // メニュー展開中は背景スクロールをロック
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // アプリ内ページでは非表示
  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <>
      {/* ===== sticky ヘッダー + ナビタブ（モバイルのみ） ===== */}
      <div className="lg:hidden sticky top-0 z-50 bg-[#05060f]/95 backdrop-blur-md border-b border-white/5">
        {/* 1行目: ロゴ + ハンバーガー */}
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">アタスラAI</h1>
              <p className="text-[9px] text-gray-400 mt-0.5 font-medium">プレゼンサポート</p>
            </div>
          </Link>

          {/* ハンバーガーボタン */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 border border-white/10 active:bg-white/20 transition-colors"
            aria-label="メニュー"
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${isMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
              <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${isMenuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${isMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
            </div>
          </button>
        </div>

        {/* 2行目: 横スクロールナビタブ */}
        <nav
          className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hide border-t border-white/5"
          style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const isDemo = item.href === '/demo';

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors active:scale-95
                  ${isActive
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/40'
                    : isDemo
                      ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                      : 'bg-white/5 text-gray-300 border border-white/10 hover:text-white hover:bg-white/10'
                  }
                `}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ===== ハンバーガーメニューオーバーレイ（fixed — メニュー展開時のみ） ===== */}
      {isMenuOpen && (
        <div className="lg:hidden">
          {/* Full-screen backdrop */}
          <div
            className="fixed inset-0 bg-black/70 z-[55]"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Menu Panel */}
          <nav className="fixed top-0 left-0 right-0 z-[56] bg-[#0a0b18] pt-[60px] pb-6 px-4 animate-slide-up max-h-screen overflow-y-auto">
            <div className="flex flex-col gap-1">
              {MENU_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center px-4 py-3.5 text-base font-medium rounded-xl transition-colors active:bg-white/10
                      ${isActive
                        ? 'text-indigo-300 bg-indigo-500/10'
                        : 'text-gray-200 hover:text-white hover:bg-white/5'
                      }
                    `}
                  >
                    {item.label}
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* CTA in menu */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <Link
                href="/login"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-xl text-base font-bold transition-all active:scale-95 w-full shadow-lg shadow-indigo-600/20"
              >
                無料で始める
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
};

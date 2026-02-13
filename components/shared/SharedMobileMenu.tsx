'use client';

/**
 * 全ページ共通ハンバーガーメニュー
 * - lg 以上では非表示
 * - /app 配下（メインアプリ）では非表示
 * - 各ページの独自ヘッダーにはCTA「無料で始める」が残っていてもOK
 *   （モバイルではCTAを非表示にするので、ここにCTAを入れる）
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const NAV_ITEMS = [
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

export const SharedMobileMenu: React.FC = () => {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // ページ遷移時にメニューを閉じる
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // メニュー展開中は背景スクロールをロック
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // アプリ内ページでは非表示
  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <div className="lg:hidden">
      {/* Hamburger Button — 右上に固定 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-3 right-3 z-[60] w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 border border-white/10 active:bg-white/20 transition-colors"
        aria-label="メニュー"
      >
        <div className="w-5 h-4 flex flex-col justify-between">
          <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
          <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
        </div>
      </button>

      {/* メニューオーバーレイ */}
      {isOpen && (
        <>
          {/* Full-screen backdrop */}
          <div
            className="fixed inset-0 bg-black/70 z-[55]"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel */}
          <nav className="fixed top-0 left-0 right-0 z-[56] bg-[#0a0b18] pt-[60px] pb-6 px-4 animate-slide-up max-h-screen overflow-y-auto">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
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
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-xl text-base font-bold transition-all active:scale-95 w-full shadow-lg shadow-indigo-600/20"
              >
                無料で始める
              </Link>
            </div>
          </nav>
        </>
      )}
    </div>
  );
};

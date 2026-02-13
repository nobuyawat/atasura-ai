'use client';

/**
 * 全ページ共通モバイルナビゲーション
 * - ヘッダー直下に固定される横スクロールタブ（lg以上では非表示）
 * - ハンバーガーメニューは各ページヘッダーに既にあるので、ここではタブのみ
 * - usePathname() で現在ページをハイライト
 * - /app 配下（メインアプリ）では非表示
 *
 * レイアウト:
 *   ヘッダー: ~56px (py-3/py-4 + content)
 *   ナビタブ: ~40px (py-1.5 + content)
 *   → コンテンツは各ページで pt-[100px] 以上を確保すること
 */

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

/** アプリ内ページでは表示しないパス */
const HIDDEN_PATHS = ['/app', '/login', '/checkout'];

export const SharedMobileNav: React.FC = () => {
  const pathname = usePathname();

  // アプリ内ページでは非表示
  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <div className="lg:hidden fixed top-[56px] left-0 right-0 z-40 bg-[#05060f]/95 backdrop-blur-md border-b border-white/5">
      <nav
        className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
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
  );
};

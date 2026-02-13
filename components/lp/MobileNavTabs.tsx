'use client';

import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/showcase', label: '実例' },
  { href: '/problems', label: 'お悩み' },
  { href: '/howto', label: '使い方' },
  { href: '/pricing', label: '料金' },
  { href: '/faq', label: 'FAQ' },
  { href: '/demo', label: 'デモ', highlight: true },
];

/**
 * モバイル用の横スクロールナビタブ
 * ヘッダー直下に固定表示（lg以上では非表示）
 */
export const MobileNavTabs: React.FC = () => {
  return (
    <div className="lg:hidden fixed top-[52px] left-0 right-0 z-40 bg-[#05060f]/90 border-b border-white/5">
      <nav
        className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors active:scale-95
              ${item.highlight
                ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                : 'bg-white/5 text-gray-300 border border-white/10 hover:text-white hover:bg-white/10'
              }
            `}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
};

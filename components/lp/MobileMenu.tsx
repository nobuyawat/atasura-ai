'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/showcase', label: '実例' },
  { href: '/problems', label: 'よくあるお悩み' },
  { href: '/howto', label: '使い方' },
  { href: '/pricing', label: '料金' },
  { href: '/faq', label: 'よくある質問' },
  { href: '/demo', label: 'デモ' },
];

export const MobileMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <div className="lg:hidden">
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative z-[60] w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 border border-white/10 active:bg-white/20 transition-colors"
        aria-label="メニュー"
      >
        <div className="w-5 h-4 flex flex-col justify-between">
          <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
          <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 bg-white rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
        </div>
      </button>

      {/* Mobile Menu Overlay — z-[55] でヘッダー(z-50)より上に出す */}
      {isOpen && (
        <>
          {/* Full-screen backdrop */}
          <div
            className="fixed inset-0 bg-black/70 z-[55]"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu Panel — ヘッダーの下から展開 */}
          <nav className="fixed top-0 left-0 right-0 z-[56] bg-[#0a0b18] pt-[60px] pb-6 px-4 animate-slide-up max-h-screen overflow-y-auto">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center px-4 py-3.5 text-base font-medium text-gray-200 hover:text-white hover:bg-white/5 rounded-xl transition-colors active:bg-white/10"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* CTA in menu（ヘッダーのCTAと重複しないよう、メニュー内に配置） */}
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

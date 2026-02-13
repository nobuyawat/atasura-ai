'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';

/**
 * Hero画像スライダー（状態機械設計）
 *
 * 設計原則:
 * - index更新は tick() のみ（他のイベントから直接更新しない）
 * - タイマーは1本のみ（useRef + 二重起動ガード）
 * - フェードはCSSに任せる（isTransitioning状態を廃止）
 * - 依存配列は空（状態変化でタイマー再作成しない）
 */

// Hero画像のパス（コンポーネント外で固定 - レンダーごとに再生成しない）
const HERO_IMAGES = [
  '/hero/01_思考を進める_ビジネスプレゼン.png',
  '/hero/02_すぐ形に_プレゼン準備ゼロ.png',
  '/hero/03_形にする_思考アウトプット.png',
  '/hero/04_そのまま出す_即アウトプット.png',
  '/hero/05_考えの続き_AIプレゼン.png',
];

// ローテーション間隔（ミリ秒）
const SLIDE_MS = 3000;

export const ThumbnailStack: React.FC = () => {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  // ===== index更新は この tick() のみ =====
  const tick = () => {
    setIndex((prev) => (prev + 1) % HERO_IMAGES.length);
  };

  // タイマー停止
  const stop = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // タイマー開始（二重起動ガード付き）
  const start = () => {
    if (timerRef.current !== null) return; // 既に動いていたら何もしない
    timerRef.current = window.setInterval(tick, SLIDE_MS);
  };

  // メインのuseEffect - 依存配列は空
  useEffect(() => {
    // 初回開始
    start();

    // visibilitychange ハンドラー
    const onVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    // クリーンアップ
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 依存配列は空 - 状態変化でタイマーを再作成しない

  return (
    <div className="relative w-full max-w-[640px] aspect-[16/9] group cursor-pointer overflow-visible">
      {/* Background cards for depth - hidden on mobile for performance */}
      <div className="hidden sm:block absolute top-[-15%] right-[-10%] w-[90%] h-full bg-indigo-900/40 rounded-3xl -rotate-6 blur-[2px] opacity-40 scale-90 border border-white/5" />
      <div className="hidden sm:block absolute top-[-8%] right-[-5%] w-[95%] h-full bg-purple-900/40 rounded-3xl -rotate-3 blur-[1px] opacity-60 scale-95 border border-white/10" />

      {/* Main card */}
      <div className="relative w-full h-full bg-[#1e1f2b] rounded-3xl overflow-hidden border-4 border-white/10 shadow-2xl shadow-black/50 transition-transform duration-500 group-hover:scale-[1.02] group-hover:-translate-y-2">
        {/* 全画像を重ねて配置し、CSSでフェード切替 */}
        {HERO_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === index ? 1 : 0 }}
          >
            <Image
              src={src}
              alt={`Hero image ${i + 1}`}
              fill
              className="object-cover"
              priority={i === 0}
              sizes="(max-width: 768px) 100vw, 640px"
            />
          </div>
        ))}

        {/* Progress indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {HERO_IMAGES.map((_, i) => (
            <div
              key={i}
              className={`
                h-2 rounded-full transition-all duration-300
                ${i === index
                  ? 'bg-white w-6'
                  : 'bg-white/40 w-2 hover:bg-white/60'}
              `}
            />
          ))}
        </div>

        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Subtext */}
      <p className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-gray-500 text-sm font-medium tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
        {HERO_IMAGES.length}枚の画像を自動表示中
      </p>
    </div>
  );
};

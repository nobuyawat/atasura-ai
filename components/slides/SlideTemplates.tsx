"use client";

/**
 * スライドテンプレートコンポーネント
 *
 * 方針:
 * - 見た目のバリエーションを提供
 * - 日本語テキストはHTML/CSSで描画（文字化けなし）
 * - 画像は補助要素（別レーンで管理）
 */

import React from 'react';
import { LightSlide, SlideLayoutId } from '@/lib/slide-types';

// =====================================================
// 共通スタイル
// =====================================================

const COLORS = {
  primary: '#2563EB',      // ブルー
  secondary: '#6366F1',    // インディゴ
  accent: '#F59E0B',       // アンバー
  text: '#1E293B',         // スレートダーク
  textLight: '#64748B',    // スレート
  bg: '#FFFFFF',
  bgLight: '#F8FAFC',
};

// =====================================================
// タイトル + 箇条書き (デフォルト)
// =====================================================

interface TitleBulletsProps {
  slide: LightSlide;
  pageNumber: number;
}

export function TitleBulletsTemplate({ slide, pageNumber }: TitleBulletsProps) {
  return (
    <div className="h-full flex">
      {/* 左側：テキストコンテンツ (65%) */}
      <div className="w-[65%] flex flex-col p-8">
        {/* ページ番号 */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-slate-400 text-xs font-mono uppercase tracking-widest">
            Page {String(pageNumber).padStart(2, '0')}
          </div>
        </div>

        {/* タイトル */}
        <h2 className="text-3xl font-black text-slate-800 leading-tight mb-6">
          {slide.title}
        </h2>

        {/* 箇条書き */}
        <ul className="space-y-3 flex-1">
          {slide.bullets.map((bullet, index) => (
            <li key={index} className="flex items-start gap-3">
              <span
                className="w-2 h-2 rounded-full mt-2 shrink-0"
                style={{ backgroundColor: COLORS.primary }}
              />
              <span className="text-lg text-slate-600 leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>

        {/* 下部アクセント */}
        <div className="mt-auto pt-4 flex justify-center">
          <div
            className="w-16 h-1 rounded-full"
            style={{ backgroundColor: COLORS.primary }}
          />
        </div>
      </div>

      {/* 右側：画像エリア (35%) */}
      <div className="w-[35%] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 border-l border-slate-200">
        {slide.visual?.imageBase64 ? (
          <img
            src={`data:${slide.visual.imageMimeType || 'image/png'};base64,${slide.visual.imageBase64}`}
            alt=""
            className="max-w-full max-h-full object-contain rounded shadow-md"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
              <svg className="w-12 h-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// 2カラムテンプレート
// =====================================================

interface TwoColumnProps {
  slide: LightSlide;
  pageNumber: number;
}

export function TwoColumnTemplate({ slide, pageNumber }: TwoColumnProps) {
  // 箇条書きを左右に分割
  const midPoint = Math.ceil(slide.bullets.length / 2);
  const leftBullets = slide.bullets.slice(0, midPoint);
  const rightBullets = slide.bullets.slice(midPoint);

  return (
    <div className="h-full flex flex-col p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-slate-400 text-xs font-mono uppercase tracking-widest">
          Page {String(pageNumber).padStart(2, '0')}
        </div>
      </div>

      {/* タイトル */}
      <h2 className="text-3xl font-black text-slate-800 leading-tight mb-8 text-center">
        {slide.title}
      </h2>

      {/* 2カラム */}
      <div className="flex-1 grid grid-cols-2 gap-8">
        {/* 左カラム */}
        <div className="bg-slate-50 rounded-xl p-6">
          <ul className="space-y-3">
            {leftBullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  {index + 1}
                </span>
                <span className="text-base text-slate-600 leading-relaxed pt-0.5">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 右カラム */}
        <div className="bg-slate-50 rounded-xl p-6">
          <ul className="space-y-3">
            {rightBullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: COLORS.secondary }}
                >
                  {midPoint + index + 1}
                </span>
                <span className="text-base text-slate-600 leading-relaxed pt-0.5">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 下部アクセント */}
      <div className="mt-6 flex justify-center">
        <div className="w-24 h-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
      </div>
    </div>
  );
}

// =====================================================
// 引用テンプレート
// =====================================================

interface QuoteProps {
  slide: LightSlide;
  pageNumber: number;
}

export function QuoteTemplate({ slide, pageNumber }: QuoteProps) {
  // 最初の箇条書きを引用として使用
  const quoteText = slide.bullets[0] || slide.title;
  const additionalBullets = slide.bullets.slice(1);

  return (
    <div className="h-full flex flex-col p-8 bg-gradient-to-br from-slate-800 to-slate-900 text-white">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-8">
        <div className="text-slate-500 text-xs font-mono uppercase tracking-widest">
          Page {String(pageNumber).padStart(2, '0')}
        </div>
      </div>

      {/* 引用 */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-12">
        <div className="text-6xl text-blue-400 mb-4">"</div>
        <blockquote className="text-2xl font-bold leading-relaxed mb-6">
          {quoteText}
        </blockquote>
        <div className="text-6xl text-blue-400 rotate-180">"</div>

        {/* タイトル（出典として） */}
        <p className="text-slate-400 text-sm mt-8">
          — {slide.title}
        </p>
      </div>

      {/* 追加の箇条書きがあれば */}
      {additionalBullets.length > 0 && (
        <div className="mt-auto pt-4 border-t border-slate-700">
          <ul className="flex flex-wrap justify-center gap-4">
            {additionalBullets.map((bullet, index) => (
              <li key={index} className="text-sm text-slate-400">
                • {bullet}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// =====================================================
// ステップテンプレート
// =====================================================

interface StepsProps {
  slide: LightSlide;
  pageNumber: number;
}

export function StepsTemplate({ slide, pageNumber }: StepsProps) {
  return (
    <div className="h-full flex flex-col p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-slate-400 text-xs font-mono uppercase tracking-widest">
          Page {String(pageNumber).padStart(2, '0')}
        </div>
      </div>

      {/* タイトル */}
      <h2 className="text-3xl font-black text-slate-800 leading-tight mb-8 text-center">
        {slide.title}
      </h2>

      {/* ステップ */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-4 px-4">
          {slide.bullets.map((bullet, index) => (
            <React.Fragment key={index}>
              {/* ステップカード */}
              <div className="flex flex-col items-center max-w-[180px]">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3"
                  style={{
                    backgroundColor: index === 0 ? COLORS.primary : index === slide.bullets.length - 1 ? COLORS.accent : COLORS.secondary
                  }}
                >
                  {index + 1}
                </div>
                <p className="text-center text-sm text-slate-600 leading-snug">
                  {bullet}
                </p>
              </div>

              {/* 矢印 */}
              {index < slide.bullets.length - 1 && (
                <div className="text-slate-300 text-2xl">→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 下部アクセント */}
      <div className="mt-auto pt-4 flex justify-center">
        <div className="w-32 h-1 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-500" />
      </div>
    </div>
  );
}

// =====================================================
// 比較テンプレート
// =====================================================

interface ComparisonProps {
  slide: LightSlide;
  pageNumber: number;
}

export function ComparisonTemplate({ slide, pageNumber }: ComparisonProps) {
  // 箇条書きを半分に分割（左：メリット/A、右：デメリット/B）
  const midPoint = Math.ceil(slide.bullets.length / 2);
  const leftItems = slide.bullets.slice(0, midPoint);
  const rightItems = slide.bullets.slice(midPoint);

  return (
    <div className="h-full flex flex-col p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-slate-400 text-xs font-mono uppercase tracking-widest">
          Page {String(pageNumber).padStart(2, '0')}
        </div>
      </div>

      {/* タイトル */}
      <h2 className="text-3xl font-black text-slate-800 leading-tight mb-6 text-center">
        {slide.title}
      </h2>

      {/* 比較 */}
      <div className="flex-1 grid grid-cols-2 gap-6">
        {/* 左側 */}
        <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="font-bold text-blue-700">Point A</span>
          </div>
          <ul className="space-y-2">
            {leftItems.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-blue-500 mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 右側 */}
        <div className="bg-amber-50 rounded-xl p-5 border-2 border-amber-200">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="font-bold text-amber-700">Point B</span>
          </div>
          <ul className="space-y-2">
            {rightItems.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-amber-500 mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* VS バッジ */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm shadow-lg">
        VS
      </div>
    </div>
  );
}

// =====================================================
// 図解中心テンプレート
// =====================================================

interface DiagramFocusProps {
  slide: LightSlide;
  pageNumber: number;
}

export function DiagramFocusTemplate({ slide, pageNumber }: DiagramFocusProps) {
  return (
    <div className="h-full flex flex-col p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-slate-400 text-xs font-mono uppercase tracking-widest">
          Page {String(pageNumber).padStart(2, '0')}
        </div>
      </div>

      {/* タイトル */}
      <h2 className="text-2xl font-black text-slate-800 leading-tight mb-4 text-center">
        {slide.title}
      </h2>

      {/* 画像エリア（大きく） */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl">
        {slide.visual?.imageBase64 ? (
          <img
            src={`data:${slide.visual.imageMimeType || 'image/png'};base64,${slide.visual.imageBase64}`}
            alt=""
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-slate-400">
            <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm">画像を追加</span>
            {slide.visual?.imageGuide && (
              <span className="text-xs text-purple-500 px-4 text-center max-w-xs">
                ガイド: {slide.visual.imageGuide}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 箇条書き（コンパクト） */}
      {slide.bullets.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {slide.bullets.slice(0, 3).map((bullet, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full"
            >
              {bullet.length > 30 ? bullet.substring(0, 30) + '...' : bullet}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// テンプレートセレクター
// =====================================================

interface SlideTemplateProps {
  slide: LightSlide;
  pageNumber: number;
}

export function SlideTemplate({ slide, pageNumber }: SlideTemplateProps) {
  switch (slide.layoutId) {
    case 'two_column':
      return <TwoColumnTemplate slide={slide} pageNumber={pageNumber} />;
    case 'quote':
      return <QuoteTemplate slide={slide} pageNumber={pageNumber} />;
    case 'steps':
      return <StepsTemplate slide={slide} pageNumber={pageNumber} />;
    case 'comparison':
      return <ComparisonTemplate slide={slide} pageNumber={pageNumber} />;
    case 'diagram_focus':
      return <DiagramFocusTemplate slide={slide} pageNumber={pageNumber} />;
    case 'title_bullets':
    default:
      return <TitleBulletsTemplate slide={slide} pageNumber={pageNumber} />;
  }
}

// =====================================================
// エクスポート
// =====================================================

export default SlideTemplate;

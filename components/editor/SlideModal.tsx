"use client";

import React, { useRef, useCallback, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  ZoomIn,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Slide, getSlideImageSrc, hasSlideImage } from '@/lib/types';
import { BaseTemplateId, getBaseTemplate, DEFAULT_TEMPLATE_ID } from '@/lib/base-templates';

// =====================================================
// テンプレートベースのスライドレンダリング（モーダル用）
// プレビューと同一のレイアウトロジックを使用
// =====================================================
// 箇条書き内画像のサイズ（モーダル大サイズ — DeckModalと同じ）
const MODAL_BULLET_IMAGE_HEIGHTS: Record<string, string> = {
  S: 'max-h-[40px]',
  M: 'max-h-[80px]',
  B: 'max-h-[120px]',
};

interface TemplateBasedSlideProps {
  slide: Slide;
  slideIndex: number;
  onRegenerate?: (sectionId: string) => void;
}

const TemplateBasedSlide = React.forwardRef<HTMLDivElement, TemplateBasedSlideProps>(
  ({ slide, slideIndex, onRegenerate }, ref) => {
    const templateId: BaseTemplateId = slide.templateId || DEFAULT_TEMPLATE_ID;
    const template = getBaseTemplate(templateId);
    const { layout } = template;

    // 表示モードを取得（未設定の場合はbullets）
    const displayMode = slide.displayMode || 'bullets';
    const isBodyMode = displayMode === 'body';
    const bodyText = isBodyMode && slide.bullets.length > 0 ? slide.bullets[0] : '';

    // 2カラムレイアウト用の箇条書き分割
    const isTwoColumn = templateId === 'base3' || templateId === 'base4';
    const midPoint = Math.ceil(slide.bullets.length / 2);
    const leftBullets = isTwoColumn ? slide.bullets.slice(0, midPoint) : slide.bullets;
    const rightBullets = isTwoColumn ? slide.bullets.slice(midPoint) : [];

    // テキストコンテンツ
    const renderTextContent = (widthClass: string) => (
      <div className={`${widthClass} flex flex-col p-8`}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-slate-400 text-xs font-mono uppercase tracking-widest">
            Page {String(slideIndex + 1).padStart(2, '0')}
          </div>
          <div className="flex items-center gap-2">
            {slide.editedByUser && (
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">編集済み</span>
            )}
            {slide.locked && (
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">🔒</span>
            )}
          </div>
        </div>
        <h2 className="text-3xl font-black text-slate-800 leading-tight mb-6">
          {slide.title || 'タイトル未設定'}
        </h2>

        {/* 箇条書きモード（画像行対応） */}
        {!isBodyMode && slide.bullets.length > 0 && (slide.bullets.some(b => b.trim()) || (slide.bulletImages && slide.bulletImages.some(img => img !== null))) && (
          isTwoColumn ? (
            <div className="grid grid-cols-2 gap-4 flex-1">
              <ul className="space-y-3">
                {leftBullets.map((bullet, index) => {
                  const bulletImage = slide.bulletImages?.[index];
                  if (bulletImage) {
                    const heightClass = MODAL_BULLET_IMAGE_HEIGHTS[bulletImage.size] || MODAL_BULLET_IMAGE_HEIGHTS.M;
                    return (
                      <li key={index} className="flex items-center">
                        <img
                          src={bulletImage.src}
                          alt={bulletImage.fileName || '画像'}
                          className={`w-full ${heightClass} object-contain`}
                        />
                      </li>
                    );
                  }
                  if (!bullet.trim()) return null;
                  return (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-[#2563EB] mt-2 shrink-0" />
                      <span className="text-lg text-slate-600 leading-relaxed">{bullet}</span>
                    </li>
                  );
                })}
              </ul>
              <ul className="space-y-3">
                {rightBullets.map((bullet, index) => {
                  const globalIdx = midPoint + index;
                  const bulletImage = slide.bulletImages?.[globalIdx];
                  if (bulletImage) {
                    const heightClass = MODAL_BULLET_IMAGE_HEIGHTS[bulletImage.size] || MODAL_BULLET_IMAGE_HEIGHTS.M;
                    return (
                      <li key={index} className="flex items-center">
                        <img
                          src={bulletImage.src}
                          alt={bulletImage.fileName || '画像'}
                          className={`w-full ${heightClass} object-contain`}
                        />
                      </li>
                    );
                  }
                  if (!bullet.trim()) return null;
                  return (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-[#6366F1] mt-2 shrink-0" />
                      <span className="text-lg text-slate-600 leading-relaxed">{bullet}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <ul className="space-y-3 flex-1">
              {slide.bullets.map((bullet, index) => {
                const bulletImage = slide.bulletImages?.[index];
                if (bulletImage) {
                  const heightClass = MODAL_BULLET_IMAGE_HEIGHTS[bulletImage.size] || MODAL_BULLET_IMAGE_HEIGHTS.M;
                  return (
                    <li key={index} className="flex items-center">
                      <img
                        src={bulletImage.src}
                        alt={bulletImage.fileName || '画像'}
                        className={`w-full ${heightClass} object-contain`}
                      />
                    </li>
                  );
                }
                if (!bullet.trim()) return null;
                return (
                  <li key={index} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full bg-[#2563EB] mt-2 shrink-0" />
                    <span className="text-lg text-slate-600 leading-relaxed">{bullet}</span>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {/* 本文モード */}
        {isBodyMode && bodyText && (
          <div className="flex-1">
            <p className="text-lg text-slate-600 leading-relaxed whitespace-pre-wrap">
              {bodyText}
            </p>
          </div>
        )}

        <div className="mt-auto pt-4 flex justify-center">
          <div className="w-16 h-1 bg-[#2563EB] rounded-full" />
        </div>
      </div>
    );

    // 画像エリア
    const renderImageArea = (widthClass: string) => (
      <div className={`${widthClass} relative border-l border-slate-200 overflow-hidden`}>
        {/* 抽象背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
          <div className="absolute top-4 right-4 w-20 h-20 rounded-full bg-gradient-to-br from-blue-200/40 to-indigo-200/40 blur-xl" />
          <div className="absolute bottom-8 left-6 w-16 h-16 rounded-full bg-gradient-to-br from-purple-200/40 to-pink-200/40 blur-xl" />
        </div>

        {/* 画像表示 */}
        {hasSlideImage(slide) ? (
          <img
            src={getSlideImageSrc(slide) || ''}
            alt={slide.visual?.prompt || slide.imageIntent || 'スライド画像'}
            className={`relative z-10 w-full h-full ${
              slide.imageDisplayMode
                ? (slide.imageDisplayMode === 'contain' ? 'object-contain p-4' : 'object-cover')
                : (templateId === 'base3' || templateId === 'base4' ? 'object-contain p-4' : 'object-cover')
            }`}
          />
        ) : slide.imageStatus === 'pending' ? (
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-purple-600">
            <RefreshCw className="w-12 h-12 animate-spin" />
            <span className="text-sm font-medium mt-2">画像生成中...</span>
          </div>
        ) : slide.imageStatus === 'failed' ? (
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-4">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <span className="text-sm text-red-600 font-medium mt-2">画像生成失敗</span>
            <span className="text-xs text-red-500 px-4 max-w-full break-words">
              {slide.imageErrorMessage || '不明なエラー'}
            </span>
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(slide.sectionId)}
                className="mt-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs rounded flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                再生成
              </button>
            )}
          </div>
        ) : (
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-slate-400/50">
            <Sparkles className="w-12 h-12" />
          </div>
        )}
      </div>
    );

    // テンプレート別レイアウト
    // base1: 左テキスト70% / 右画像30%
    // base2: 左画像30% / 右テキスト70%
    // base3: 2カラムテキスト80% / 右アクセント画像20%
    // base4: 左アクセント画像20% / 2カラムテキスト80%
    // base5: 全文テキスト（画像なし）

    return (
      <div
        ref={ref}
        className="w-full aspect-video bg-white rounded-lg shadow-2xl overflow-hidden"
      >
        <div className="h-full flex">
          {templateId === 'base1' && (
            <>
              {renderTextContent('w-[70%]')}
              {renderImageArea('w-[30%]')}
            </>
          )}
          {templateId === 'base2' && (
            <>
              {renderImageArea('w-[30%] border-l-0 border-r border-slate-200')}
              {renderTextContent('w-[70%]')}
            </>
          )}
          {templateId === 'base3' && (
            <>
              {renderTextContent('w-[80%]')}
              {renderImageArea('w-[20%]')}
            </>
          )}
          {templateId === 'base4' && (
            <>
              {renderImageArea('w-[20%] border-l-0 border-r border-slate-200')}
              {renderTextContent('w-[80%]')}
            </>
          )}
          {templateId === 'base5' && (
            <>{renderTextContent('w-full')}</>
          )}
          {/* デフォルト（base1と同じ） */}
          {!['base1', 'base2', 'base3', 'base4', 'base5'].includes(templateId) && (
            <>
              {renderTextContent('w-[70%]')}
              {renderImageArea('w-[30%]')}
            </>
          )}
        </div>
      </div>
    );
  }
);
TemplateBasedSlide.displayName = 'TemplateBasedSlide';

interface SlideModalProps {
  slides: Slide[];
  initialIndex: number;
  chapterTitle?: string;
  sectionTitle?: string;
  onClose: () => void;
  onRegenerate?: (sectionId: string) => void;
}

export default function SlideModal({
  slides,
  initialIndex,
  chapterTitle,
  sectionTitle,
  onClose,
  onRegenerate,
}: SlideModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  const currentSlide = slides[currentIndex];

  // 前のスライド
  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : slides.length - 1));
  }, [slides.length]);

  // 次のスライド
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < slides.length - 1 ? prev + 1 : 0));
  }, [slides.length]);

  // キーボード操作
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, onClose]);

  // PNG ダウンロード
  const handleDownloadPng = useCallback(async () => {
    if (!slideRef.current) return;

    setIsDownloading(true);
    try {
      // 日時フォーマット
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

      // ファイル名を構築
      const safeChapterTitle = (chapterTitle || 'chapter').replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '_').slice(0, 20);
      const safeSectionTitle = (sectionTitle || 'section').replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '_').slice(0, 20);
      const safeSlideTitle = (currentSlide.title || 'slide').replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '_').slice(0, 20);
      const filename = `${safeChapterTitle}_${safeSectionTitle}_${safeSlideTitle}_${timestamp}.png`;

      // html-to-image でPNG化
      const dataUrl = await toPng(slideRef.current, {
        quality: 1,
        pixelRatio: 2,  // 高解像度
        backgroundColor: '#ffffff',
      });

      // ダウンロード
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('[SlideModal] PNG export failed:', error);
      alert('PNG出力に失敗しました');
    } finally {
      setIsDownloading(false);
    }
  }, [currentSlide, chapterTitle, sectionTitle]);

  if (!currentSlide) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      {/* オーバーレイクリックで閉じる */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* モーダルコンテンツ */}
      <div className="relative z-10 max-w-5xl w-full mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-white">
            <span className="text-sm opacity-70">{chapterTitle}</span>
            {sectionTitle && (
              <>
                <span className="text-sm opacity-50 mx-2">›</span>
                <span className="text-sm opacity-70">{sectionTitle}</span>
              </>
            )}
            <span className="text-sm opacity-50 ml-4">
              {currentIndex + 1} / {slides.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* PNG ダウンロード */}
            <button
              onClick={handleDownloadPng}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isDownloading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              PNG保存
            </button>
            {/* 閉じる */}
            <button
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* スライド本体 */}
        <div className="relative">
          {/* 左矢印 */}
          <button
            onClick={handlePrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>

          {/* スライドカード（16:9）- テンプレートベースのレンダリング */}
          <TemplateBasedSlide
            ref={slideRef}
            slide={currentSlide}
            slideIndex={currentIndex}
            onRegenerate={onRegenerate}
          />

          {/* 右矢印 */}
          <button
            onClick={handleNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        </div>

        {/* スライドサムネイル */}
        <div className="mt-6 flex justify-center gap-2 overflow-x-auto pb-2">
          {slides.map((slide, index) => (
            <button
              key={slide.slideId}
              onClick={() => setCurrentIndex(index)}
              className={`
                flex-shrink-0 w-24 aspect-video bg-white rounded border-2 overflow-hidden transition-all
                ${currentIndex === index ? 'border-[#2563EB] ring-2 ring-blue-300' : 'border-slate-300 hover:border-slate-400 opacity-60 hover:opacity-100'}
              `}
            >
              <div className="p-1 h-full flex flex-col">
                <span className="text-[7px] font-bold text-slate-600 truncate">{slide.title}</span>
                {slide.locked && (
                  <span className="text-[6px] text-amber-600 mt-auto">🔒</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* スピーカーノート */}
        {currentSlide.speakerNotes && (
          <div className="mt-4 p-4 bg-amber-50/90 rounded-lg border border-amber-200 max-h-32 overflow-y-auto">
            <p className="text-sm text-amber-700 font-medium flex items-center gap-1 mb-2">
              🎤 スピーカーノート
            </p>
            <p className="text-sm text-amber-800 whitespace-pre-wrap">
              {currentSlide.speakerNotes}
            </p>
          </div>
        )}

        {/* キーボードショートカット説明 */}
        <div className="mt-4 text-center text-white/50 text-xs">
          ← → キーでページ移動 / ESC で閉じる
        </div>
      </div>
    </div>
  );
}

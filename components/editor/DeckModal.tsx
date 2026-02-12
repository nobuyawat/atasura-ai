"use client";

import React, { useRef, useCallback, useState, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  AlertCircle,
  Sparkles,
  BookOpen,
  List,
  FileText,
  Printer,
} from 'lucide-react';
import { toPng } from 'html-to-image';
import { Slide, CourseData, getSlideImageSrc, hasSlideImage } from '@/lib/types';
import { BaseTemplateId, getBaseTemplate, getBulletLevel, DEFAULT_TEMPLATE_ID, getEffectiveColumnCount, splitBulletsIntoColumns } from '@/lib/base-templates';
import {
  exportSlideAsNormalPng,
  exportSlideAsNotePng,
  exportScriptOnlyPng,
  exportDataUrlsAsZip,
  downloadDataUrl,
  getTimestamp,
  sanitizeFilename,
} from '@/lib/exportUtils';

// デッキスライドの型（表紙・目次も含む）
interface DeckSlide {
  type: 'cover' | 'toc' | 'content';
  // 表紙用
  coverTitle?: string;
  coverSubtitle?: string;
  coverAuthor?: string;
  // 目次用
  chapters?: { title: string; sections: { title: string; slideCount: number }[] }[];
  // コンテンツ用
  slide?: Slide;
  chapterTitle?: string;
  sectionTitle?: string;
}

interface DeckModalProps {
  course: CourseData;
  coverSettings: {
    title: string;
    subtitle: string;
    author: string;
    showToc: boolean;
  };
  onClose: () => void;
}

// =====================================================
// テンプレートベースのデッキスライド描画
// SlideModal / SlidePreviewLayout と同一ルールを適用
// =====================================================
interface TemplateBasedDeckSlideProps {
  slide: Slide;
  chapterTitle?: string;
  sectionTitle?: string;
}

// カラムごとのドットカラー（デッキ表示用）
const DECK_COLUMN_DOT_COLORS = ['bg-[#2563EB]', 'bg-[#6366F1]', 'bg-[#8B5CF6]'];

// Deck用の見出しレベル別スタイル（大きめプレビュー用）
const DECK_BULLET_LEVEL_STYLES: Record<number, { text: string; dot: string }> = {
  1: { text: 'text-xl font-bold text-slate-800 leading-snug', dot: 'w-2.5 h-2.5 mt-2' },
  2: { text: 'text-lg font-medium text-slate-600 leading-relaxed', dot: 'w-2 h-2 mt-2' },
  3: { text: 'text-base font-normal text-slate-500 leading-relaxed', dot: 'w-1.5 h-1.5 mt-2.5' },
};

// 箇条書き内画像のサイズ（デッキ大サイズ）
const DECK_BULLET_IMAGE_HEIGHTS: Record<string, string> = {
  S: 'max-h-[40px]',
  M: 'max-h-[80px]',
  B: 'max-h-[120px]',
};

function TemplateBasedDeckSlide({ slide, chapterTitle, sectionTitle }: TemplateBasedDeckSlideProps) {
  const templateId: BaseTemplateId = slide.templateId || DEFAULT_TEMPLATE_ID;

  // テンプレート別レイアウト設定（共通ヘルパー使用）
  const columnCount = getEffectiveColumnCount(templateId, slide.columnCount);
  const isAccentImage = templateId === 'base3' || templateId === 'base4';
  const hasImage = templateId !== 'base5';

  // 幅設定
  let textWidthClass: string;
  let imageWidthClass: string;

  switch (templateId) {
    case 'base1':
      textWidthClass = 'w-[70%]';
      imageWidthClass = 'w-[30%]';
      break;
    case 'base2':
      textWidthClass = 'w-[70%]';
      imageWidthClass = 'w-[30%]';
      break;
    case 'base3':
      textWidthClass = 'w-[80%]';
      imageWidthClass = 'w-[20%]';
      break;
    case 'base4':
      textWidthClass = 'w-[80%]';
      imageWidthClass = 'w-[20%]';
      break;
    case 'base5':
      textWidthClass = 'w-full';
      imageWidthClass = '';
      break;
    default:
      textWidthClass = 'w-[70%]';
      imageWidthClass = 'w-[30%]';
  }

  // カラム分割（共通ヘルパー使用）
  const columns = splitBulletsIntoColumns(slide.bullets, columnCount);

  // 表示モード判定
  const displayMode = slide.displayMode || 'bullets';
  const isBodyMode = displayMode === 'body';
  const hasBodyHtml = isBodyMode && slide.bodyHtml && slide.bodyHtml.trim();
  const bodyText = isBodyMode && slide.bullets.length > 0
    ? slide.bullets.join('\n')
    : '';
  const hasBodyText = isBodyMode && bodyText && bodyText.trim();
  // テキスト行 or 画像行のいずれかがあればtrue
  const hasAnyBulletImage = !isBodyMode && slide.bulletImages && slide.bulletImages.some(img => img !== null);
  const hasBullets = !isBodyMode && slide.bullets && slide.bullets.length > 0 && (slide.bullets.some(b => b.trim()) || hasAnyBulletImage);

  // テキストエリア
  const TextContent = () => (
    <div className={`${textWidthClass} flex flex-col p-8`}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-slate-400 text-xs font-mono uppercase tracking-widest">
          {chapterTitle} {sectionTitle && `› ${sectionTitle}`}
        </div>
      </div>
      <h2 className="text-3xl font-black text-slate-800 leading-tight mb-6">
        {slide.title || 'タイトル未設定'}
      </h2>

      {/* 箇条書きモード（画像行対応） */}
      {hasBullets && (
        columnCount > 1 && slide.bullets.length > 1 ? (
          <div className={`grid gap-4 flex-1 ${columnCount === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {(() => {
              let globalOffset = 0;
              return columns.map((colBullets, colIdx) => {
                const startIdx = globalOffset;
                globalOffset += colBullets.length;
                return (
                  <ul key={colIdx} className="space-y-3">
                    {colBullets.map((bullet, index) => {
                      const globalIdx = startIdx + index;
                      const bulletImage = slide.bulletImages?.[globalIdx];
                      if (bulletImage) {
                        const heightClass = DECK_BULLET_IMAGE_HEIGHTS[bulletImage.size] || DECK_BULLET_IMAGE_HEIGHTS.M;
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
                      // 空テキスト行はスキップ（画像プレースホルダ行）
                      if (!bullet.trim()) return null;
                      const level = getBulletLevel(slide.bulletLevels, globalIdx);
                      const style = DECK_BULLET_LEVEL_STYLES[level];
                      return (
                        <li key={index} className="flex items-start gap-3">
                          <span className={`rounded-full ${DECK_COLUMN_DOT_COLORS[colIdx] || DECK_COLUMN_DOT_COLORS[0]} ${style.dot} shrink-0`} />
                          <span className={style.text}>{bullet}</span>
                        </li>
                      );
                    })}
                  </ul>
                );
              });
            })()}
          </div>
        ) : (
          <ul className="space-y-3 flex-1">
            {slide.bullets.map((bullet, index) => {
              const bulletImage = slide.bulletImages?.[index];
              if (bulletImage) {
                const heightClass = DECK_BULLET_IMAGE_HEIGHTS[bulletImage.size] || DECK_BULLET_IMAGE_HEIGHTS.M;
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
              // 空テキスト行はスキップ（画像プレースホルダ行）
              if (!bullet.trim()) return null;
              const level = getBulletLevel(slide.bulletLevels, index);
              const style = DECK_BULLET_LEVEL_STYLES[level];
              return (
                <li key={index} className="flex items-start gap-3">
                  <span className={`rounded-full bg-[#2563EB] ${style.dot} shrink-0`} />
                  <span className={style.text}>{bullet}</span>
                </li>
              );
            })}
          </ul>
        )
      )}

      {/* 本文モード: bodyHtml優先、なければプレーンテキスト */}
      {hasBodyHtml ? (
        <div
          className="flex-1 overflow-y-auto deck-body-rich text-lg text-slate-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: slide.bodyHtml! }}
        />
      ) : hasBodyText ? (
        <div className="flex-1 overflow-y-auto">
          <p className="text-lg text-slate-600 leading-relaxed whitespace-pre-wrap">
            {bodyText}
          </p>
        </div>
      ) : null}

      {/* 箇条書きも本文もない場合のプレースホルダー */}
      {!hasBullets && !hasBodyText && !hasBodyHtml && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-base text-slate-400">スライド編集で内容を入力してください</p>
        </div>
      )}

      <div className="mt-auto pt-4 flex justify-center">
        <div className="w-16 h-1 bg-[#2563EB] rounded-full" />
      </div>
    </div>
  );

  // 画像エリア
  const ImageArea = () => (
    <div className={`${imageWidthClass} relative ${templateId === 'base2' || templateId === 'base4' ? 'border-r' : 'border-l'} border-slate-200 overflow-hidden`}>
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
              : (isAccentImage ? 'object-contain p-4' : 'object-cover')
          }`}
        />
      ) : slide.imageStatus === 'failed' ? (
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-4">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <span className="text-sm text-red-600 font-medium mt-2">画像生成失敗</span>
        </div>
      ) : (
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-slate-400/50">
          <Sparkles className="w-12 h-12" />
        </div>
      )}
    </div>
  );

  // テンプレート別レンダリング
  // base1: 左テキスト / 右画像
  // base2: 左画像 / 右テキスト
  // base3: 左テキスト(2カラム) / 右ワンポイント画像
  // base4: 左ワンポイント画像 / 右テキスト(2カラム)
  // base5: テキストのみ

  if (templateId === 'base2' || templateId === 'base4') {
    // 画像が左
    return (
      <div className="h-full flex">
        <ImageArea />
        <TextContent />
      </div>
    );
  }

  if (templateId === 'base5') {
    // テキストのみ
    return (
      <div className="h-full flex">
        <TextContent />
      </div>
    );
  }

  // base1, base3: 画像が右
  return (
    <div className="h-full flex">
      <TextContent />
      {hasImage && <ImageArea />}
    </div>
  );
}

export default function DeckModal({
  course,
  coverSettings,
  onClose,
}: DeckModalProps) {
  // デバッグ: DeckModalがマウントされていることを確認
  console.log('[DeckModal] mounted', Date.now());

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const slideRef = useRef<HTMLDivElement>(null);

  // デッキのスライド一覧を構築
  const deckSlides = useMemo<DeckSlide[]>(() => {
    const slides: DeckSlide[] = [];

    // 1. 表紙
    slides.push({
      type: 'cover',
      coverTitle: coverSettings.title || course.title,
      coverSubtitle: coverSettings.subtitle,
      coverAuthor: coverSettings.author,
    });

    // 2. 目次（オプション）
    if (coverSettings.showToc) {
      slides.push({
        type: 'toc',
        chapters: course.chapters.map(ch => ({
          title: ch.title,
          sections: ch.sections.map(sec => ({
            title: sec.title,
            slideCount: sec.slides?.length || 0,
          })),
        })),
      });
    }

    // 3. コンテンツスライド（章・セクション順）
    course.chapters.forEach(chapter => {
      chapter.sections.forEach(section => {
        if (section.slides && section.slides.length > 0) {
          const sortedSlides = [...section.slides].sort((a, b) => a.order - b.order);
          sortedSlides.forEach(slide => {
            // デバッグ: 元スライドのtemplateIdを確認
            console.log('[DeckModal] Adding slide to deck:', slide.slideId, 'templateId:', slide.templateId);
            slides.push({
              type: 'content',
              slide,
              chapterTitle: chapter.title,
              sectionTitle: section.title,
            });
          });
        }
      });
    });

    return slides;
  }, [course, coverSettings]);

  const currentSlide = deckSlides[currentIndex];
  const totalSlides = deckSlides.length;

  // 前のスライド
  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalSlides - 1));
  }, [totalSlides]);

  // 次のスライド
  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : 0));
  }, [totalSlides]);

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

  // 現在のスライドをPNG保存（通常形式 - html-to-image使用）
  const handleDownloadNormal = useCallback(async () => {
    if (!slideRef.current) return;
    setIsDownloading(true);
    try {
      const timestamp = getTimestamp();
      const baseName = sanitizeFilename(course.title);
      let slideTypeName = 'slide';
      if (currentSlide.type === 'cover') slideTypeName = 'cover';
      else if (currentSlide.type === 'toc') slideTypeName = 'toc';
      else if (currentSlide.slide) slideTypeName = sanitizeFilename(currentSlide.slide.title, 20);

      const filename = `${baseName}_${String(currentIndex + 1).padStart(3, '0')}_${slideTypeName}_${timestamp}.png`;

      const dataUrl = await toPng(slideRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      downloadDataUrl(dataUrl, filename);
    } catch (error) {
      console.error('[DeckModal] PNG export failed:', error);
      alert('PNG出力に失敗しました');
    } finally {
      setIsDownloading(false);
    }
  }, [currentSlide, currentIndex, course.title]);

  // 現在のスライドをPNG保存（ノート形式）
  const handleDownloadNote = useCallback(async () => {
    if (currentSlide.type !== 'content' || !currentSlide.slide) {
      alert('ノート形式はコンテンツスライドのみ対応しています');
      return;
    }
    setIsDownloading(true);
    try {
      const timestamp = getTimestamp();
      const baseName = sanitizeFilename(course.title);
      const slideTypeName = sanitizeFilename(currentSlide.slide.title, 20);
      const filename = `${baseName}_${String(currentIndex + 1).padStart(3, '0')}_${slideTypeName}_note_${timestamp}.png`;

      const dataUrl = await exportSlideAsNotePng(
        currentSlide.slide,
        currentIndex + 1,
        totalSlides,
        currentSlide.chapterTitle,
        currentSlide.sectionTitle,
        course.title
      );

      downloadDataUrl(dataUrl, filename);
    } catch (error) {
      console.error('[DeckModal] Note PNG export failed:', error);
      alert('ノート形式PNG出力に失敗しました');
    } finally {
      setIsDownloading(false);
    }
  }, [currentSlide, currentIndex, totalSlides, course.title]);

  // 全ページ保存（通常形式）
  const handleDownloadAllNormal = useCallback(async () => {
    if (!slideRef.current) return;
    setIsDownloadingAll(true);
    const timestamp = getTimestamp();
    const baseName = sanitizeFilename(course.title);

    try {
      const zipItems: { dataUrl: string; filename: string }[] = [];

      for (let i = 0; i < totalSlides; i++) {
        setCurrentIndex(i);
        setDownloadProgress({ current: i + 1, total: totalSlides });
        await new Promise(resolve => setTimeout(resolve, 400));

        const slideTypeName = deckSlides[i].type === 'cover' ? 'cover' :
          deckSlides[i].type === 'toc' ? 'toc' :
          sanitizeFilename(deckSlides[i].slide?.title || 'slide', 20);

        const filename = `${String(i + 1).padStart(3, '0')}_${slideTypeName}.png`;

        const dataUrl = await toPng(slideRef.current!, {
          quality: 1,
          pixelRatio: 2,
          backgroundColor: '#ffffff',
        });

        zipItems.push({ dataUrl, filename });
      }

      // ZIP生成 & ダウンロード
      await exportDataUrlsAsZip(zipItems, `${baseName}_slides_${timestamp}.zip`);
    } catch (error) {
      console.error('[DeckModal] ZIP export failed:', error);
      alert('ZIP一括出力に失敗しました');
    } finally {
      setIsDownloadingAll(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  }, [course.title, totalSlides, deckSlides]);

  // 全ページ保存（ノート形式 → ZIP）
  const handleDownloadAllNote = useCallback(async () => {
    setIsDownloadingAll(true);
    const timestamp = getTimestamp();
    const baseName = sanitizeFilename(course.title);

    try {
      const contentSlides = deckSlides.filter(s => s.type === 'content' && s.slide);
      const total = contentSlides.length;
      const zipItems: { dataUrl: string; filename: string }[] = [];

      for (let i = 0; i < contentSlides.length; i++) {
        const ds = contentSlides[i];
        setDownloadProgress({ current: i + 1, total });

        const slideTypeName = sanitizeFilename(ds.slide?.title || 'slide', 20);
        const filename = `${String(i + 1).padStart(3, '0')}_${slideTypeName}_note.png`;

        const dataUrl = await exportSlideAsNotePng(
          ds.slide!,
          i + 1,
          total,
          ds.chapterTitle,
          ds.sectionTitle,
          course.title
        );

        zipItems.push({ dataUrl, filename });
      }

      // ZIP生成 & ダウンロード
      await exportDataUrlsAsZip(zipItems, `${baseName}_notes_${timestamp}.zip`);
    } catch (error) {
      console.error('[DeckModal] Note ZIP export failed:', error);
      alert('ノート形式ZIP出力に失敗しました');
    } finally {
      setIsDownloadingAll(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  }, [course.title, deckSlides]);

  if (!currentSlide) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 max-w-5xl w-full mx-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="text-white">
            <span className="text-lg font-bold">{coverSettings.title || course.title}</span>
            <span className="text-sm opacity-50 ml-4">
              {currentIndex + 1} / {totalSlides}
            </span>
            <span className="text-xs opacity-50 ml-2">
              ({currentSlide.type === 'cover' ? '表紙' : currentSlide.type === 'toc' ? '目次' : `${currentSlide.chapterTitle} > ${currentSlide.sectionTitle}`})
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* PNG保存（通常） */}
            <button
              onClick={handleDownloadNormal}
              disabled={isDownloading || isDownloadingAll}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Download className="w-3 h-3" />
              通常
            </button>
            {/* PNG保存（ノート） */}
            {currentSlide.type === 'content' && (
              <button
                onClick={handleDownloadNote}
                disabled={isDownloading || isDownloadingAll}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Printer className="w-3 h-3" />
                ノート
              </button>
            )}
            {/* 全ページZIP（通常） */}
            <button
              onClick={handleDownloadAllNormal}
              disabled={isDownloading || isDownloadingAll}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isDownloadingAll && downloadProgress.total > 0 ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {downloadProgress.current}/{downloadProgress.total}
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  全ZIP
                </>
              )}
            </button>
            {/* 全ページZIP（ノート） */}
            <button
              onClick={handleDownloadAllNote}
              disabled={isDownloading || isDownloadingAll}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isDownloadingAll && downloadProgress.total > 0 ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  {downloadProgress.current}/{downloadProgress.total}
                </>
              ) : (
                <>
                  <Printer className="w-3 h-3" />
                  全ノートZIP
                </>
              )}
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
          <button
            onClick={handlePrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-16 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <ChevronLeft className="w-8 h-8 text-white" />
          </button>

          {/* スライドカード（16:9） */}
          <div
            ref={slideRef}
            className="w-full aspect-video bg-white rounded-lg shadow-2xl overflow-hidden"
          >
            {currentSlide.type === 'cover' ? (
              <div className="h-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-indigo-50 to-purple-50">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mb-8 shadow-lg">
                  <BookOpen className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-4xl font-black text-slate-800 text-center mb-4">
                  {currentSlide.coverTitle}
                </h1>
                {currentSlide.coverSubtitle && (
                  <p className="text-xl text-slate-600 text-center mb-6">
                    {currentSlide.coverSubtitle}
                  </p>
                )}
                {currentSlide.coverAuthor && (
                  <p className="text-lg text-slate-500 mt-auto">
                    {currentSlide.coverAuthor}
                  </p>
                )}
                <div className="mt-8 w-24 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full" />
              </div>
            ) : currentSlide.type === 'toc' ? (
              <div className="h-full flex flex-col p-8 bg-white">
                <h2 className="text-3xl font-bold text-slate-800 text-center mb-6">目次</h2>
                <div className="flex-1 overflow-y-auto space-y-4">
                  {currentSlide.chapters?.map((chapter, chIdx) => (
                    <div key={chIdx}>
                      <div className="flex items-baseline gap-3">
                        <span className="text-xl font-bold text-indigo-600">{chIdx + 1}.</span>
                        <span className="text-xl font-semibold text-slate-800">{chapter.title}</span>
                      </div>
                      <div className="ml-10 mt-1 space-y-0.5">
                        {chapter.sections.map((section, secIdx) => (
                          <div key={secIdx} className="flex items-center gap-2 text-base text-slate-600">
                            <span className="text-slate-400">{chIdx + 1}.{secIdx + 1}</span>
                            <span>{section.title || '（未入力）'}</span>
                            {section.slideCount > 0 && (
                              <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                {section.slideCount}枚
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-center">
                  <div className="w-16 h-1 bg-indigo-600 rounded-full" />
                </div>
              </div>
            ) : currentSlide.slide ? (
              // NotebookLMスライドの場合は完成画像をフル表示
              currentSlide.slide.sourceType === 'notebooklm' && currentSlide.slide.pngDataUrl ? (
                <div className="h-full w-full flex items-center justify-center bg-slate-900">
                  <img
                    src={currentSlide.slide.pngDataUrl}
                    alt={currentSlide.slide.title || 'NotebookLMスライド'}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                // 通常のアプリ生成スライド（テンプレートベースレイアウト）
                <TemplateBasedDeckSlide
                  slide={currentSlide.slide}
                  chapterTitle={currentSlide.chapterTitle}
                  sectionTitle={currentSlide.sectionTitle}
                />
              )
            ) : null}
          </div>

          <button
            onClick={handleNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-16 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <ChevronRight className="w-8 h-8 text-white" />
          </button>
        </div>

        {/* サムネイル */}
        <div className="mt-6 flex justify-center gap-2 overflow-x-auto pb-2 max-w-full">
          {deckSlides.map((slide, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`
                flex-shrink-0 w-20 aspect-video rounded border-2 overflow-hidden transition-all
                ${currentIndex === index ? 'border-[#2563EB] ring-2 ring-blue-300' : 'border-slate-300 hover:border-slate-400 opacity-60 hover:opacity-100'}
                ${slide.type === 'cover' ? 'bg-gradient-to-br from-indigo-100 to-purple-100' : slide.type === 'toc' ? 'bg-slate-100' : 'bg-white'}
              `}
            >
              <div className="p-1 h-full flex flex-col items-center justify-center">
                {slide.type === 'cover' ? (
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                ) : slide.type === 'toc' ? (
                  <List className="w-4 h-4 text-slate-600" />
                ) : (
                  <span className="text-[6px] font-bold text-slate-600 truncate text-center px-1">
                    {slide.slide?.title}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-4 text-center text-white/50 text-xs">
          ← → キーでページ移動 / ESC で閉じる
        </div>
      </div>
    </div>
  );
}

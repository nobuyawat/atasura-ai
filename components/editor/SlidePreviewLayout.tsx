"use client";

import React from 'react';
import {
  Upload,
  Sparkles,
  ZoomIn,
  RefreshCw,
  AlertCircle,
  Image,
  History,
  X,
  Zap,
} from 'lucide-react';
import { Slide, BulletImage } from '@/lib/types';
import { BaseTemplateId, getBaseTemplate, getBulletLevel, getEffectiveColumnCount, splitBulletsIntoColumns } from '@/lib/base-templates';

// =====================================================
// Props定義
// =====================================================

interface SlidePreviewLayoutProps {
  slide: Slide;
  slideIndex: number;
  templateId: BaseTemplateId;
  // 画像関連
  hasImage: boolean;
  imageSrc: string | null;
  imageUploadMode: 'cover' | 'contain';
  isGeneratingImage: boolean;
  isGeneratingSlides: boolean;
  // 編集関連
  isEditingVisualPrompt: boolean;
  editingVisualPrompt: string;
  showPromptHistory: boolean;
  // 中央エディタからのリアルタイムプレビューデータ
  // これが渡されると、slide.title/bulletsよりも優先的に表示される
  livePreview?: {
    title: string;
    bullets: string[];
    bodyText: string;
    noteText: string;
  };
  // 後方互換のため残す（livePreviewがない場合のフォールバック）
  bodyText?: string;
  // ハンドラ
  onSlideEdit: () => void;
  onImageUploadClick: () => void;
  onStartEditingVisualPrompt: () => void;
  onImageUploadModeToggle: () => void;
  onSetEditingVisualPrompt: (prompt: string) => void;
  onSetIsEditingVisualPrompt: (editing: boolean) => void;
  onSetShowPromptHistory: (show: boolean) => void;
  onSelectPromptFromHistory: (prompt: string) => void;
  onGenerateImage: () => void;
}

// =====================================================
// 共通コンポーネント
// =====================================================

// テキストコンテンツ（タイトル + 箇条書き or 本文）
// displayModeに基づいて表示を切り替え
// カラムごとのドットカラー
const COLUMN_DOT_COLORS = ['bg-[#2563EB]', 'bg-[#6366F1]', 'bg-[#8B5CF6]'];

// 見出しレベル別のスタイル（プレビュー用）
// タイトル > H1 > H2 > H3 の階層
const BULLET_LEVEL_STYLES: Record<number, { text: string; dot: string }> = {
  1: { text: 'text-[12px] font-bold text-slate-800 leading-snug', dot: 'w-2 h-2 mt-1' },
  2: { text: 'text-[10px] font-medium text-slate-600 leading-relaxed', dot: 'w-1.5 h-1.5 mt-1.5' },
  3: { text: 'text-[9px] font-normal text-slate-500 leading-relaxed', dot: 'w-1 h-1 mt-1.5' },
};

// 箇条書き内画像のサイズ（プレビュー — Deck/Modalと同一比率）
// プレビューはDeck/Modalの約50%スケールなので、
// 実表示(S=40,M=80,B=120) × 0.5 = S=20,M=40,B=60 を基準に余裕を持たせる
const PREVIEW_BULLET_IMAGE_HEIGHTS: Record<string, string> = {
  S: 'max-h-[24px]',
  M: 'max-h-[52px]',
  B: 'max-h-[80px]',
};

function TextContent({
  slide,
  slideIndex,
  onClick,
  widthClass,
  columnCount = 1,
}: {
  slide: Slide;
  slideIndex: number;
  onClick: () => void;
  widthClass: string;
  columnCount?: 1 | 2 | 3;
}) {
  // 表示モードを取得（未設定の場合はbullets）
  const displayMode = slide.displayMode || 'bullets';

  // 本文モードの場合: bullets全要素を改行結合して本文として表示
  // （handleBodyTextChangeで[text]として保存される場合と、
  //   箇条書きから本文へモード切替した場合の両方に対応）
  const isBodyMode = displayMode === 'body';
  const hasBodyHtml = isBodyMode && slide.bodyHtml && slide.bodyHtml.trim();
  const bodyText = isBodyMode && slide.bullets.length > 0
    ? slide.bullets.join('\n')
    : '';

  // カラム分割（共通ヘルパーを使用）
  const columns = splitBulletsIntoColumns(slide.bullets, columnCount);

  // 箇条書きの有無を判定（箇条書きモード時のみ）
  // テキスト行 or 画像行のいずれかがあればtrue
  const hasAnyBulletImage = !isBodyMode && slide.bulletImages && slide.bulletImages.some(img => img !== null);
  const hasBullets = !isBodyMode && slide.bullets && slide.bullets.length > 0 && (slide.bullets.some(b => b.trim()) || hasAnyBulletImage);
  const hasBodyText = isBodyMode && bodyText && bodyText.trim();

  return (
    <div
      className={`${widthClass} flex flex-col p-4 cursor-pointer hover:bg-slate-50/50 transition-colors`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-slate-400 text-[9px] font-mono uppercase tracking-widest">
          Page {String(slideIndex + 1).padStart(2, '0')}
        </div>
        <div className="flex items-center gap-1">
          {slide.editedByUser && (
            <span className="text-[8px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">編集済み</span>
          )}
          {slide.locked && (
            <span className="text-[8px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">🔒</span>
          )}
        </div>
      </div>
      <h2 className="text-lg font-black text-slate-800 leading-tight mb-3">
        {slide.title || 'タイトル未設定'}
      </h2>

      {/* 箇条書きがある場合（レベル別スタイル対応 + 画像行対応） */}
      {hasBullets && (
        columnCount > 1 ? (
          <div className={`grid gap-3 overflow-y-auto flex-1 ${
            columnCount === 2 ? 'grid-cols-2' : 'grid-cols-3'
          }`}>
            {(() => {
              // カラム分割時のグローバルインデックスを計算
              let globalOffset = 0;
              return columns.map((colBullets, colIdx) => {
                const startIdx = globalOffset;
                globalOffset += colBullets.length;
                return (
                  <ul key={colIdx} className="space-y-1.5">
                    {colBullets.map((bullet, index) => {
                      const globalIdx = startIdx + index;
                      const bulletImage = slide.bulletImages?.[globalIdx];
                      // 画像行の場合
                      if (bulletImage) {
                        const heightClass = PREVIEW_BULLET_IMAGE_HEIGHTS[bulletImage.size] || PREVIEW_BULLET_IMAGE_HEIGHTS.M;
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
                      const style = BULLET_LEVEL_STYLES[level];
                      return (
                        <li key={index} className="flex items-start gap-2">
                          <span className={`rounded-full ${COLUMN_DOT_COLORS[colIdx] || COLUMN_DOT_COLORS[0]} ${style.dot} shrink-0`} />
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
          <ul className={`space-y-1.5 overflow-y-auto ${hasBodyText ? '' : 'flex-1'}`}>
            {slide.bullets.map((bullet, index) => {
              const bulletImage = slide.bulletImages?.[index];
              // 画像行の場合
              if (bulletImage) {
                const heightClass = PREVIEW_BULLET_IMAGE_HEIGHTS[bulletImage.size] || PREVIEW_BULLET_IMAGE_HEIGHTS.M;
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
              const style = BULLET_LEVEL_STYLES[level];
              return (
                <li key={index} className="flex items-start gap-2">
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
          className="flex-1 overflow-y-auto body-preview-rich text-[11px] text-slate-600 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: slide.bodyHtml! }}
        />
      ) : hasBodyText ? (
        <div className="flex-1 overflow-y-auto">
          <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">
            {bodyText}
          </p>
        </div>
      ) : null}

      {/* 箇条書きも本文もない場合のプレースホルダー */}
      {!hasBullets && !hasBodyText && !hasBodyHtml && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[10px] text-slate-400">スライド編集で内容を入力してください</p>
        </div>
      )}

      <div className="mt-auto pt-2 flex justify-center">
        <div className="w-8 h-0.5 bg-[#2563EB] rounded-full" />
      </div>
    </div>
  );
}

// 画像エリア
function ImageArea({
  slide,
  hasImage,
  imageSrc,
  imageUploadMode,
  isGeneratingImage,
  isGeneratingSlides,
  isEditingVisualPrompt,
  editingVisualPrompt,
  showPromptHistory,
  widthClass,
  isAccent = false,
  accentPosition,
  onImageUploadClick,
  onStartEditingVisualPrompt,
  onImageUploadModeToggle,
  onSetEditingVisualPrompt,
  onSetIsEditingVisualPrompt,
  onSetShowPromptHistory,
  onSelectPromptFromHistory,
  onGenerateImage,
}: {
  slide: Slide;
  hasImage: boolean;
  imageSrc: string | null;
  imageUploadMode: 'cover' | 'contain';
  isGeneratingImage: boolean;
  isGeneratingSlides: boolean;
  isEditingVisualPrompt: boolean;
  editingVisualPrompt: string;
  showPromptHistory: boolean;
  widthClass: string;
  isAccent?: boolean;
  accentPosition?: 'left' | 'right';
  onImageUploadClick: () => void;
  onStartEditingVisualPrompt: () => void;
  onImageUploadModeToggle: () => void;
  onSetEditingVisualPrompt: (prompt: string) => void;
  onSetIsEditingVisualPrompt: (editing: boolean) => void;
  onSetShowPromptHistory: (show: boolean) => void;
  onSelectPromptFromHistory: (prompt: string) => void;
  onGenerateImage: () => void;
}) {
  // アクセント画像（20%幅）の場合、AI編集パネルを全幅に拡張する
  // base3: 右側アクセント → 左方向に拡張 (right:0, width:500%)
  // base4: 左側アクセント → 右方向に拡張 (left:0, width:500%)
  const accentPanelStyle: React.CSSProperties | undefined = isAccent ? (
    accentPosition === 'right'
      ? { position: 'absolute', top: 0, right: 0, bottom: 0, width: '500%', zIndex: 30 }
      : { position: 'absolute', top: 0, left: 0, bottom: 0, width: '500%', zIndex: 30 }
  ) : undefined;
  return (
    <div className={`${widthClass} flex flex-col border-l border-slate-200 relative ${isAccent && isEditingVisualPrompt ? 'overflow-visible' : 'overflow-hidden'}`}>
      {/* 画像生成中オーバーレイ */}
      {isGeneratingImage && (
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center z-20">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
          <span className="text-xs font-medium text-purple-600 mt-2">生成中...</span>
        </div>
      )}

      {/* 抽象背景 */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-gradient-to-br from-blue-200/40 to-indigo-200/40 blur-xl" />
        <div className="absolute bottom-6 left-4 w-12 h-12 rounded-full bg-gradient-to-br from-purple-200/40 to-pink-200/40 blur-xl" />
      </div>

      {/* 画像表示 */}
      {hasImage && imageSrc ? (
        <div className="relative flex-1 min-h-0 z-10">
          <img
            src={imageSrc}
            alt={slide.visual?.prompt || slide.visualPrompt || slide.imageIntent || 'スライド画像'}
            className={`w-full h-full ${imageUploadMode === 'cover' ? 'object-cover' : 'object-contain'}`}
          />
          {/* オーバーレイボタン */}
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onImageUploadModeToggle(); }}
              className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded shadow-sm"
              title={imageUploadMode === 'cover' ? '全体表示に切替' : 'カバー表示に切替'}
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onImageUploadClick(); }}
              className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded shadow-sm"
              title="画像を差し替え"
            >
              <Upload className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onStartEditingVisualPrompt(); }}
              className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded shadow-sm shadow-emerald-500/30 transition-all"
              title="クレジットを消費してAI生成します"
            >
              <Zap className="w-3 h-3" />
            </button>
          </div>
          {slide.visual?.type === 'uploaded' && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-green-500/80 text-white text-[8px] rounded">
              アップロード
            </div>
          )}
        </div>
      ) : slide.imageStatus === 'pending' || (isGeneratingSlides && !slide.imageStatus) ? (
        <div className="relative flex-1 flex flex-col items-center justify-center text-purple-600 z-10">
          <RefreshCw className={`${isAccent ? 'w-6 h-6' : 'w-10 h-10'} animate-spin`} />
          <span className="text-xs font-medium mt-2">生成中...</span>
        </div>
      ) : slide.imageStatus === 'failed' ? (
        <div className="relative flex-1 flex flex-col items-center justify-center text-center p-2 z-10">
          <AlertCircle className={`${isAccent ? 'w-5 h-5' : 'w-8 h-8'} text-red-400`} />
          <span className="text-[9px] text-red-600 font-medium mt-1">失敗</span>
          <div className="flex gap-1 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onImageUploadClick(); }}
              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[8px] rounded"
            >
              <Upload className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onStartEditingVisualPrompt(); }}
              className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-[8px] rounded"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col items-center justify-center p-2 z-10">
          <div className={`${isAccent ? 'w-8 h-8' : 'w-12 h-12'} rounded-lg border-2 border-dashed border-slate-300/80 flex items-center justify-center bg-white/50 mb-2`}>
            <Image className={`${isAccent ? 'w-4 h-4' : 'w-6 h-6'} text-slate-400`} />
          </div>
          <div className="flex flex-col gap-1 w-full max-w-[100px]">
            <button
              onClick={(e) => { e.stopPropagation(); onImageUploadClick(); }}
              className="w-full px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[9px] rounded flex items-center justify-center gap-1"
            >
              <Upload className="w-3 h-3" />
              アップ
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onStartEditingVisualPrompt(); }}
              className="w-full px-2 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] rounded flex items-center justify-center gap-1 shadow-sm shadow-emerald-500/30 transition-all"
              title="クレジットを消費してAI生成します"
            >
              <Zap className="w-2.5 h-2.5" />
              AI生成
            </button>
            <span className="text-[7px] text-emerald-500 text-center">消費</span>
          </div>
        </div>
      )}

      {/* Visual Prompt 編集パネル */}
      {isEditingVisualPrompt && (
        <div
          className={`bg-white flex flex-col ${isAccent ? '' : 'absolute inset-0 z-30'}`}
          style={accentPanelStyle || { position: 'absolute', inset: 0, zIndex: 30 }}
        >
          <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50">
            <span className="text-[10px] font-medium text-slate-700">🎨 AI画像生成</span>
            <button
              onClick={() => { onSetIsEditingVisualPrompt(false); onSetEditingVisualPrompt(''); }}
              className="p-1 hover:bg-slate-200 rounded"
            >
              <X className="w-3 h-3 text-slate-500" />
            </button>
          </div>
          <div className="flex-1 p-2 flex flex-col gap-1.5 overflow-hidden">
            {/* ガイド文（簡潔版） */}
            <p className="text-[8px] text-purple-600 bg-purple-50 px-1.5 py-1 rounded">
              💡 写真・イラスト・図解など自由に入力
            </p>
            <textarea
              value={editingVisualPrompt}
              onChange={(e) => onSetEditingVisualPrompt(e.target.value)}
              placeholder="例: K-POP 成功の分析グラフ、チーム写真..."
              className="flex-1 min-h-[48px] p-2 text-[9px] border border-slate-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            {slide.visualPromptHistory && slide.visualPromptHistory.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => onSetShowPromptHistory(!showPromptHistory)}
                  className="text-[8px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <History className="w-3 h-3" />
                  履歴 ({slide.visualPromptHistory.length})
                </button>
                {showPromptHistory && (
                  <div className="absolute bottom-full left-0 mb-1 w-full bg-white border border-slate-200 rounded shadow-lg max-h-24 overflow-y-auto z-10">
                    {slide.visualPromptHistory.map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSelectPromptFromHistory(prompt)}
                        className="w-full text-left p-1.5 text-[8px] text-slate-600 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        {prompt.length > 40 ? prompt.slice(0, 40) + '...' : prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-2 border-t border-slate-200 flex gap-2">
            <button
              onClick={() => { onSetIsEditingVisualPrompt(false); onSetEditingVisualPrompt(''); }}
              className="flex-1 py-1.5 text-[9px] text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
              disabled={isGeneratingImage}
            >
              キャンセル
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateImage(); }}
              disabled={!editingVisualPrompt.trim() || isGeneratingImage}
              className="flex-1 py-2 text-[9px] bg-emerald-500 hover:bg-emerald-600 text-white rounded-md flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/30 transition-all"
              title="クレジットを消費してAI生成します"
            >
              {isGeneratingImage ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" />
                  AI画像生成
                  <span className="text-[7px] font-medium bg-white/25 px-1 py-0.5 rounded-full">
                    -11
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// メインコンポーネント（テンプレート別レイアウト）
// =====================================================

export function SlidePreviewLayout(props: SlidePreviewLayoutProps) {
  const {
    slide,
    slideIndex,
    templateId,
    hasImage,
    imageSrc,
    imageUploadMode,
    isGeneratingImage,
    isGeneratingSlides,
    isEditingVisualPrompt,
    editingVisualPrompt,
    showPromptHistory,
    livePreview,
    bodyText,
    onSlideEdit,
    onImageUploadClick,
    onStartEditingVisualPrompt,
    onImageUploadModeToggle,
    onSetEditingVisualPrompt,
    onSetIsEditingVisualPrompt,
    onSetShowPromptHistory,
    onSelectPromptFromHistory,
    onGenerateImage,
  } = props;

  const template = getBaseTemplate(templateId);
  const { layout } = template;

  // =====================================================
  // プレビュー表示データ
  // 常にslideデータをそのまま表示
  // displayModeに基づいてTextContentが箇条書き/本文を切り替え
  // これにより「プレビュー = 最終スライド」が保証される
  // =====================================================
  const displaySlide = slide;

  // 共通の画像エリアprops
  const imageAreaProps = {
    slide,
    hasImage,
    imageSrc,
    imageUploadMode,
    isGeneratingImage,
    isGeneratingSlides,
    isEditingVisualPrompt,
    editingVisualPrompt,
    showPromptHistory,
    onImageUploadClick,
    onStartEditingVisualPrompt,
    onImageUploadModeToggle,
    onSetEditingVisualPrompt,
    onSetIsEditingVisualPrompt,
    onSetShowPromptHistory,
    onSelectPromptFromHistory,
    onGenerateImage,
  };

  // ベース1: 左テキスト70% / 右画像30%
  if (templateId === 'base1') {
    return (
      <div className="absolute inset-0 flex bg-white">
        <TextContent
          slide={displaySlide}
          slideIndex={slideIndex}
          onClick={onSlideEdit}
          widthClass="w-[70%]"
        />
        <ImageArea
          {...imageAreaProps}
          widthClass="w-[30%]"
        />
      </div>
    );
  }

  // ベース2: 左画像30% / 右テキスト70%
  if (templateId === 'base2') {
    return (
      <div className="absolute inset-0 flex bg-white">
        <ImageArea
          {...imageAreaProps}
          widthClass="w-[30%]"
        />
        <TextContent
          slide={displaySlide}
          slideIndex={slideIndex}
          onClick={onSlideEdit}
          widthClass="w-[70%]"
        />
      </div>
    );
  }

  // ベース3: 2カラムテキスト + 右アクセント画像20%
  if (templateId === 'base3') {
    return (
      <div className="absolute inset-0 flex bg-white">
        <TextContent
          slide={displaySlide}
          slideIndex={slideIndex}
          onClick={onSlideEdit}
          widthClass="w-[80%]"
          columnCount={getEffectiveColumnCount('base3')}
        />
        <ImageArea
          {...imageAreaProps}
          widthClass="w-[20%]"
          isAccent
          accentPosition="right"
        />
      </div>
    );
  }

  // ベース4: 左アクセント画像20% + 2カラムテキスト
  if (templateId === 'base4') {
    return (
      <div className="absolute inset-0 flex bg-white">
        <ImageArea
          {...imageAreaProps}
          widthClass="w-[20%]"
          isAccent
          accentPosition="left"
        />
        <TextContent
          slide={displaySlide}
          slideIndex={slideIndex}
          onClick={onSlideEdit}
          widthClass="w-[80%]"
          columnCount={getEffectiveColumnCount('base4')}
        />
      </div>
    );
  }

  // ベース5: フリーレイアウト（カラム数選択可能）
  if (templateId === 'base5') {
    const colCount = getEffectiveColumnCount('base5', slide.columnCount);
    return (
      <div className="absolute inset-0 flex bg-white">
        <TextContent
          slide={displaySlide}
          slideIndex={slideIndex}
          onClick={onSlideEdit}
          widthClass="w-full"
          columnCount={colCount}
        />
      </div>
    );
  }

  // デフォルト（base1と同じ）
  return (
    <div className="absolute inset-0 flex bg-white">
      <TextContent
        slide={displaySlide}
        slideIndex={slideIndex}
        onClick={onSlideEdit}
        widthClass="w-[70%]"
      />
      <ImageArea
        {...imageAreaProps}
        widthClass="w-[30%]"
      />
    </div>
  );
}

export default SlidePreviewLayout;

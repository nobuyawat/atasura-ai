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
} from 'lucide-react';
import { Slide } from '@/lib/types';
import { BaseTemplateId, getBaseTemplate } from '@/lib/base-templates';

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
  // 中央エディタからの本文テキスト（リアルタイム反映用）
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

// テキストコンテンツ（タイトル + 箇条書き + 本文）
function TextContent({
  slide,
  slideIndex,
  onClick,
  widthClass,
  isTwoColumn = false,
  bodyText,
}: {
  slide: Slide;
  slideIndex: number;
  onClick: () => void;
  widthClass: string;
  isTwoColumn?: boolean;
  bodyText?: string;
}) {
  // 2カラム時は箇条書きを左右に分割
  const midPoint = Math.ceil(slide.bullets.length / 2);
  const leftBullets = isTwoColumn ? slide.bullets.slice(0, midPoint) : slide.bullets;
  const rightBullets = isTwoColumn ? slide.bullets.slice(midPoint) : [];

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

      {isTwoColumn ? (
        <div className="flex-1 grid grid-cols-2 gap-3 overflow-y-auto">
          <ul className="space-y-1.5">
            {leftBullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mt-1.5 shrink-0" />
                <span className="text-[10px] text-slate-600 leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
          <ul className="space-y-1.5">
            {rightBullets.map((bullet, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] mt-1.5 shrink-0" />
                <span className="text-[10px] text-slate-600 leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="space-y-1.5 flex-1 overflow-y-auto">
          {slide.bullets.map((bullet, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mt-1.5 shrink-0" />
              <span className="text-[10px] text-slate-600 leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 本文テキスト（中央エディタからのリアルタイム反映） */}
      {bodyText && (
        <div className="mt-2 pt-2 border-t border-slate-100">
          <p className="text-[9px] text-slate-500 leading-relaxed line-clamp-3">
            {bodyText}
          </p>
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
  onImageUploadClick: () => void;
  onStartEditingVisualPrompt: () => void;
  onImageUploadModeToggle: () => void;
  onSetEditingVisualPrompt: (prompt: string) => void;
  onSetIsEditingVisualPrompt: (editing: boolean) => void;
  onSetShowPromptHistory: (show: boolean) => void;
  onSelectPromptFromHistory: (prompt: string) => void;
  onGenerateImage: () => void;
}) {
  return (
    <div className={`${widthClass} flex flex-col border-l border-slate-200 relative overflow-hidden`}>
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
              className="p-1.5 bg-purple-600/90 hover:bg-purple-600 text-white rounded shadow-sm"
              title="AIで再生成"
            >
              <Sparkles className="w-3 h-3" />
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
              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[8px] rounded"
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
              className="w-full px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[9px] rounded flex items-center justify-center gap-1"
            >
              <Upload className="w-3 h-3" />
              アップ
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onStartEditingVisualPrompt(); }}
              className="w-full px-2 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 text-[9px] rounded flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              AI生成
            </button>
          </div>
        </div>
      )}

      {/* Visual Prompt 編集パネル */}
      {isEditingVisualPrompt && (
        <div className="absolute inset-0 bg-white z-30 flex flex-col">
          <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50">
            <span className="text-[10px] font-medium text-slate-700">🎨 AI画像生成</span>
            <button
              onClick={() => { onSetIsEditingVisualPrompt(false); onSetEditingVisualPrompt(''); }}
              className="p-1 hover:bg-slate-200 rounded"
            >
              <X className="w-3 h-3 text-slate-500" />
            </button>
          </div>
          <div className="flex-1 p-2 flex flex-col gap-2 overflow-hidden">
            <textarea
              value={editingVisualPrompt}
              onChange={(e) => onSetEditingVisualPrompt(e.target.value)}
              placeholder="生成したい画像の説明..."
              className="flex-1 p-2 text-[9px] border border-slate-200 rounded resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
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
              className="flex-1 py-1 text-[9px] text-slate-600 hover:bg-slate-100 rounded"
            >
              キャンセル
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onGenerateImage(); }}
              disabled={!editingVisualPrompt.trim() || isGeneratingImage}
              className="flex-1 py-1 text-[9px] bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              生成
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
          slide={slide}
          slideIndex={slideIndex}
          onClick={onSlideEdit}
          widthClass="w-[70%]"
          bodyText={bodyText}
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
          slide={slide}
          slideIndex={slideIndex}
          onClick={onSlideEdit}
          widthClass="w-[70%]"
          bodyText={bodyText}
        />
      </div>
    );
  }

  // ベース3: 2カラムテキスト + 右アクセント画像20%
  if (templateId === 'base3') {
    return (
      <div className="absolute inset-0 flex bg-white">
        <TextContent
          slide={slide}
          slideIndex={slideIndex}
          onClick={onSlideEdit}
          widthClass="w-[80%]"
          isTwoColumn
          bodyText={bodyText}
        />
        <ImageArea
          {...imageAreaProps}
          widthClass="w-[20%]"
          isAccent
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
        />
        <TextContent
          slide={slide}
          slideIndex={slideIndex}
          onClick={onSlideEdit}
          widthClass="w-[80%]"
          isTwoColumn
          bodyText={bodyText}
        />
      </div>
    );
  }

  // ベース5: 全文テキスト（画像なし）
  if (templateId === 'base5') {
    return (
      <div className="absolute inset-0 flex bg-white">
        <TextContent
          slide={slide}
          slideIndex={slideIndex}
          onClick={onSlideEdit}
          widthClass="w-full"
          bodyText={bodyText}
        />
      </div>
    );
  }

  // デフォルト（base1と同じ）
  return (
    <div className="absolute inset-0 flex bg-white">
      <TextContent
        slide={slide}
        slideIndex={slideIndex}
        onClick={onSlideEdit}
        widthClass="w-[70%]"
        bodyText={bodyText}
      />
      <ImageArea
        {...imageAreaProps}
        widthClass="w-[30%]"
      />
    </div>
  );
}

export default SlidePreviewLayout;

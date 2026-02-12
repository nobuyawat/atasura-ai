"use client";

import React, { useState } from 'react';
import { Layout, Check, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { BASE_TEMPLATES, BaseTemplateId, getBaseTemplate } from '@/lib/base-templates';

// =====================================================
// テンプレートプレビューカード
// =====================================================

interface TemplatePreviewProps {
  templateId: BaseTemplateId;
  isSelected: boolean;
  onClick: () => void;
}

function TemplatePreview({ templateId, isSelected, onClick }: TemplatePreviewProps) {
  const template = getBaseTemplate(templateId);
  const { preview } = template;

  // 簡易説明テキスト（常時表示用）
  const getShortDescription = (id: string) => {
    switch (id) {
      case 'base1': return '左テキスト / 右画像';
      case 'base2': return '左画像 / 右テキスト';
      case 'base3': return 'テキスト＋右ワンポイント';
      case 'base4': return '左ワンポイント＋テキスト';
      case 'base5': return 'フリー（カラム可変）';
      default: return '';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`
        relative w-full p-1 rounded border transition-all flex flex-col
        ${isSelected
          ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300'
          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
        }
      `}
      title={template.description}
    >
      {/* 選択チェック */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-500 rounded-full flex items-center justify-center">
          <Check className="w-2 h-2 text-white" />
        </div>
      )}

      {/* ミニプレビュー（さらにコンパクト） */}
      <div className="flex h-6 rounded-sm overflow-hidden border border-slate-200 bg-white">
        {/* 左ブロック */}
        {preview.leftWidth > 0 && (
          <div
            className={`flex items-center justify-center ${
              preview.leftBlock === 'text'
                ? 'bg-slate-100'
                : preview.leftBlock === 'image'
                ? 'bg-indigo-100'
                : ''
            }`}
            style={{ width: `${preview.leftWidth}%` }}
          >
            {preview.leftBlock === 'text' && (
              <div className="space-y-0.5 px-0.5">
                <div className="w-3 h-[1px] bg-slate-400" />
                <div className="w-2 h-[1px] bg-slate-300" />
              </div>
            )}
            {preview.leftBlock === 'image' && (
              <div className="w-3 h-3 rounded-sm bg-indigo-200 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-indigo-400" />
              </div>
            )}
          </div>
        )}
        {/* 右ブロック */}
        {preview.rightWidth > 0 && (
          <div
            className={`flex items-center justify-center border-l border-slate-200 ${
              preview.rightBlock === 'text'
                ? 'bg-slate-100'
                : preview.rightBlock === 'image'
                ? 'bg-indigo-100'
                : ''
            }`}
            style={{ width: `${preview.rightWidth}%` }}
          >
            {preview.rightBlock === 'text' && (
              <div className="space-y-0.5 px-0.5">
                <div className="w-3 h-[1px] bg-slate-400" />
                <div className="w-2 h-[1px] bg-slate-300" />
              </div>
            )}
            {preview.rightBlock === 'image' && (
              <div className="w-3 h-3 rounded-sm bg-indigo-200 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-indigo-400" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 簡易説明テキスト（常時表示） */}
      <div className={`text-[8px] leading-tight text-center mt-1 ${
        isSelected ? 'text-indigo-600 font-medium' : 'text-slate-500'
      }`}>
        {getShortDescription(templateId)}
      </div>
    </button>
  );
}

// =====================================================
// テンプレートセレクターパネル
// =====================================================

interface TemplateSelectorProps {
  selectedTemplateId: BaseTemplateId;
  onSelectTemplate: (templateId: BaseTemplateId) => void;
  onApplyToAll?: () => void;
  slideCount?: number;
  forceExpanded?: boolean; // 常時展開モード
}

export function TemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
  onApplyToAll,
  slideCount = 0,
  forceExpanded = true, // デフォルトで常時展開
}: TemplateSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(true); // 初期状態で展開
  const selectedTemplate = getBaseTemplate(selectedTemplateId);

  // forceExpandedがtrueの場合は常に展開
  const showExpanded = forceExpanded || isExpanded;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-indigo-200 rounded-lg overflow-hidden mb-3">
      {/* ヘッダー：Step 1ラベル付き */}
      <div className="px-3 py-2 bg-white/80">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-white bg-indigo-500 px-2 py-0.5 rounded">Step 1</span>
          <Layout className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-xs font-bold text-slate-700">テンプレート選択 → AIスライド作成</span>
          {!forceExpanded && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-auto"
            >
              {showExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 展開時のコンテンツ（常時表示） */}
      {showExpanded && (
        <div className="px-3 pb-3">
          {/* テンプレートグリッド（5カラムで1行に収める） */}
          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {BASE_TEMPLATES.map((template) => (
              <TemplatePreview
                key={template.id}
                templateId={template.id}
                isSelected={selectedTemplateId === template.id}
                onClick={() => onSelectTemplate(template.id)}
              />
            ))}
          </div>

          {/* 全スライドに適用ボタン */}
          {onApplyToAll && slideCount > 1 && (
            <button
              onClick={onApplyToAll}
              className="w-full mt-2 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[10px] font-medium transition-colors"
            >
              <Copy className="w-3 h-3" />
              <span>全{slideCount}スライドに適用</span>
            </button>
          )}

          {/* スライドがない場合のヒント */}
          {slideCount === 0 && (
            <div className="mt-2 text-[10px] text-indigo-600 text-center font-medium">
              💡 5つの中から好みのレイアウトを選んでください
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TemplateSelector;

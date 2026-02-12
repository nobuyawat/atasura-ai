"use client";

import React, { useState, useCallback } from 'react';
import {
  List,
  FileText,
  Plus,
  X,
  GripVertical,
  Lock,
  Unlock,
} from 'lucide-react';
import { Slide } from '@/lib/types';

// =====================================================
// Props定義
// =====================================================

interface SlideContentEditorProps {
  slide: Slide | null;
  onSlideUpdate: (updatedSlide: Slide) => void;
  disabled?: boolean;
}

// =====================================================
// 編集モード
// =====================================================

type EditMode = 'bullets' | 'body';

// =====================================================
// メインコンポーネント
// =====================================================

export function SlideContentEditor({
  slide,
  onSlideUpdate,
  disabled = false,
}: SlideContentEditorProps) {
  // 編集モード（箇条書き / 本文）
  const [editMode, setEditMode] = useState<EditMode>('bullets');

  // 本文モード用のテキスト（slideのbulletsを結合して初期化）
  const [bodyText, setBodyText] = useState(() => {
    if (!slide) return '';
    // slide.bodyText があればそれを使用、なければbulletsを結合
    return (slide as any).bodyText || slide.bullets.join('\n');
  });

  // スライドがない場合
  if (!slide) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="text-center text-slate-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">スライドを選択してください</p>
          <p className="text-xs mt-1">AIスライド作成ボタンでスライドを生成できます</p>
        </div>
      </div>
    );
  }

  // タイトル変更
  const handleTitleChange = (newTitle: string) => {
    onSlideUpdate({
      ...slide,
      title: newTitle,
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  // 箇条書き変更
  const handleBulletChange = (index: number, value: string) => {
    const newBullets = [...slide.bullets];
    newBullets[index] = value;
    onSlideUpdate({
      ...slide,
      bullets: newBullets,
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  // 箇条書き追加
  const handleAddBullet = () => {
    if (slide.bullets.length >= 5) return;
    onSlideUpdate({
      ...slide,
      bullets: [...slide.bullets, ''],
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  // 箇条書き削除
  const handleRemoveBullet = (index: number) => {
    const newBullets = slide.bullets.filter((_, i) => i !== index);
    onSlideUpdate({
      ...slide,
      bullets: newBullets,
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  // 本文モードのテキスト変更
  const handleBodyTextChange = (text: string) => {
    setBodyText(text);
    // 本文を保存（将来的にはslide.bodyTextに保存）
    // 現在はbulletsとして分割保存
    const lines = text.split('\n').filter(line => line.trim()).slice(0, 5);
    onSlideUpdate({
      ...slide,
      bullets: lines,
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  // ロック切り替え
  const handleToggleLock = () => {
    onSlideUpdate({
      ...slide,
      locked: !slide.locked,
      updatedAt: new Date(),
    });
  };

  // スピーカーノート変更
  const handleSpeakerNotesChange = (notes: string) => {
    onSlideUpdate({
      ...slide,
      speakerNotes: notes,
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-lg overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700">スライド編集</span>
          <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
            最終反映
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 編集モード切替 */}
          <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
            <button
              onClick={() => setEditMode('bullets')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                editMode === 'bullets'
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <List className="w-3 h-3" />
              箇条書き
            </button>
            <button
              onClick={() => setEditMode('body')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                editMode === 'body'
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3 h-3" />
              本文
            </button>
          </div>
          {/* ロックボタン */}
          <button
            onClick={handleToggleLock}
            className={`p-1.5 rounded transition-colors ${
              slide.locked
                ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
            }`}
            title={slide.locked ? 'AI上書き禁止中' : 'AI上書き禁止にする'}
          >
            {slide.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-4 space-y-4">
        {/* タイトル */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            スライドタイトル
          </label>
          <input
            type="text"
            value={slide.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="タイトルを入力..."
          />
        </div>

        {/* 箇条書きモード */}
        {editMode === 'bullets' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              箇条書き（最大5行）
            </label>
            <div className="space-y-2">
              {slide.bullets.map((bullet, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-4">{index + 1}</span>
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => handleBulletChange(index, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={`箇条書き ${index + 1}`}
                  />
                  <button
                    onClick={() => handleRemoveBullet(index)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {slide.bullets.length < 5 && (
                <button
                  onClick={handleAddBullet}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded"
                >
                  <Plus className="w-3 h-3" />
                  箇条書きを追加
                </button>
              )}
            </div>
          </div>
        )}

        {/* 本文モード */}
        {editMode === 'body' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              本文（フリーテキスト）
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => handleBodyTextChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={5}
              placeholder="スライドに表示する本文を入力..."
            />
            <p className="text-[10px] text-slate-400 mt-1">
              ※ 改行で区切ると箇条書きとして表示されます（最大5行）
            </p>
          </div>
        )}

        {/* スピーカーノート */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            スピーカーノート
          </label>
          <textarea
            value={slide.speakerNotes || ''}
            onChange={(e) => handleSpeakerNotesChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-slate-50"
            rows={3}
            placeholder="プレゼン時のメモ（スライドには表示されません）"
          />
        </div>

        {/* ステータス表示 */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {slide.editedByUser && (
              <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                編集済み
              </span>
            )}
            {slide.locked && (
              <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                AI上書き禁止
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400">
            この内容がスライドに反映されます
          </span>
        </div>
      </div>
    </div>
  );
}

export default SlideContentEditor;

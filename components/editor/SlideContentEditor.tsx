"use client";

import React, { useState, useRef, useCallback } from 'react';
import {
  List,
  FileText,
  Plus,
  X,
  GripVertical,
  Lock,
  Unlock,
  Columns,
  MoreVertical,
  Image as ImageIcon,
  Trash2,
  Maximize2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Slide, SlideDisplayMode, BulletImage, BulletImageSize } from '@/lib/types';
import {
  BaseTemplateId,
  getBulletLevel,
  getEffectiveColumnCount,
  getMaxBulletCount,
  splitBulletsIntoColumns,
} from '@/lib/base-templates';

// TipTapはSSR非対応のためdynamic import
const BodyRichEditor = dynamic(
  () => import('./BodyRichEditor').then(mod => ({ default: mod.BodyRichEditor })),
  { ssr: false, loading: () => <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-400 min-h-[80px]">読み込み中...</div> }
);

// =====================================================
// Props定義
// =====================================================

interface SlideContentEditorProps {
  slide: Slide | null;
  onSlideUpdate: (updatedSlide: Slide) => void;
  disabled?: boolean;
  templateId?: BaseTemplateId;
}

// =====================================================
// D&Dハンドラ用の型
// =====================================================

interface DragState {
  dragIndex: number;
  dragOverIndex: number;
  isDragging: boolean;
}

// カラムごとのラベル・色
const COLUMN_LABELS = ['左列', '中列', '右列'];
const COLUMN_DOT_COLORS = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500'];
const COLUMN_TEXT_COLORS = ['text-blue-600', 'text-indigo-600', 'text-violet-600'];
const COLUMN_BORDER_COLORS = ['border-blue-100', 'border-indigo-100', 'border-violet-100'];

// サイズラベル
const SIZE_LABELS: Record<BulletImageSize, string> = { S: '小', M: '中', B: '大' };

// =====================================================
// 左側メニュー（コンテンツ操作: 画像挿入/サイズ/解除 + H1H2H3）
// 8点ハンドル横に配置される「行の中身・見た目」を操作するメニュー
// =====================================================

interface LeftContentMenuProps {
  isImageRow: boolean;
  onInsertImage: (size: BulletImageSize) => void;
  onChangeSize?: (size: BulletImageSize) => void;
  onRemoveImage?: () => void;
  currentSize?: BulletImageSize;
}

function LeftContentMenu({ isImageRow, onInsertImage, onChangeSize, onRemoveImage, currentSize }: LeftContentMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`p-0.5 rounded transition-colors ${
          isImageRow
            ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50'
            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
        }`}
        title={isImageRow ? '画像設定' : '画像を挿入'}
      >
        <ImageIcon className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[150px]">
          {isImageRow ? (
            <>
              {/* 画像行: サイズ変更 + 画像解除 */}
              <div className="px-3 py-1 text-[10px] text-slate-400 font-medium">サイズ変更</div>
              {(['S', 'M', 'B'] as const).map(sz => (
                <button
                  key={sz}
                  onClick={() => { onChangeSize?.(sz); setOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 ${
                    currentSize === sz ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Maximize2 className="w-3 h-3" />
                  {SIZE_LABELS[sz]}（{sz}）
                </button>
              ))}
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={() => { onRemoveImage?.(); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-orange-600 hover:bg-orange-50 flex items-center gap-2"
              >
                <ImageIcon className="w-3 h-3" />
                画像を解除
              </button>
            </>
          ) : (
            <>
              {/* テキスト行: 画像挿入(3サイズ) */}
              {(['S', 'M', 'B'] as const).map(sz => (
                <button
                  key={sz}
                  onClick={() => { onInsertImage(sz); setOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                >
                  <ImageIcon className="w-3 h-3" />
                  画像を挿入（{SIZE_LABELS[sz]}）
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// 右側メニュー（行管理: 削除のみ）
// =====================================================

interface RightManageMenuProps {
  onDelete: () => void;
}

function RightManageMenu({ onDelete }: RightManageMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[120px]">
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <Trash2 className="w-3 h-3" />
            行を削除
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================
// メインコンポーネント
// =====================================================

export function SlideContentEditor({
  slide,
  onSlideUpdate,
  disabled = false,
  templateId,
}: SlideContentEditorProps) {
  const [editMode, setEditMode] = useState<SlideDisplayMode>(() => {
    return slide?.displayMode || 'bullets';
  });

  const [bodyText, setBodyText] = useState(() => {
    if (!slide) return '';
    return slide.bullets.join('\n');
  });

  const [dragState, setDragState] = useState<DragState>({
    dragIndex: -1,
    dragOverIndex: -1,
    isDragging: false,
  });

  // 画像挿入用のstate
  const bulletImageInputRef = useRef<HTMLInputElement>(null);
  const [pendingImageIndex, setPendingImageIndex] = useState<number | null>(null);
  const [pendingImageSize, setPendingImageSize] = useState<BulletImageSize>('M');

  // 実効カラム数（共通ヘルパー使用）
  const effectiveColumnCount = templateId
    ? getEffectiveColumnCount(templateId, slide?.columnCount)
    : 1;

  // base5かどうか（カラム切替UIを表示するかどうか）
  const isBase5 = templateId === 'base5';

  // 最大箇条書き数（base5はカラム数×5、他は5固定）
  const maxBullets = templateId
    ? getMaxBulletCount(templateId, slide?.columnCount)
    : 5;

  React.useEffect(() => {
    if (slide) {
      // displayModeが明示的に設定されている場合のみ切り替え
      // AI再生成で新しいスライドが来た際（displayMode未設定）は
      // 現在のeditModeを維持し、タブが勝手に切り替わるのを防ぐ
      if (slide.displayMode) {
        setEditMode(slide.displayMode);
      }
      setBodyText(slide.bullets.join('\n'));
    }
  }, [slide?.slideId]);

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

  // カラム分割（共通ヘルパーを使用）
  const columns = splitBulletsIntoColumns(slide.bullets, effectiveColumnCount);
  // カラムごとのグローバルindex範囲を計算
  const columnIndices: number[][] = [];
  let offset = 0;
  for (const col of columns) {
    const indices = col.map((_, i) => offset + i);
    columnIndices.push(indices);
    offset += col.length;
  }

  // =====================================================
  // ハンドラ
  // =====================================================

  const handleTitleChange = (newTitle: string) => {
    onSlideUpdate({
      ...slide,
      title: newTitle,
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  const handleModeChange = (mode: SlideDisplayMode) => {
    setEditMode(mode);
    onSlideUpdate({
      ...slide,
      displayMode: mode,
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  const handleBulletChange = (index: number, value: string) => {
    const newBullets = [...slide.bullets];
    newBullets[index] = value;
    onSlideUpdate({
      ...slide,
      bullets: newBullets,
      displayMode: 'bullets',
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  const handleAddBullet = () => {
    if (slide.bullets.length >= maxBullets) return;
    const newLevels = [...(slide.bulletLevels || slide.bullets.map(() => 2)), 2];
    // bulletImagesも同期（存在する場合のみ）
    const newBulletImages = slide.bulletImages
      ? [...slide.bulletImages, null]
      : undefined;
    onSlideUpdate({
      ...slide,
      bullets: [...slide.bullets, ''],
      bulletLevels: newLevels,
      bulletImages: newBulletImages,
      displayMode: 'bullets',
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  const handleRemoveBullet = (index: number) => {
    const newBullets = slide.bullets.filter((_, i) => i !== index);
    const newLevels = (slide.bulletLevels || []).filter((_, i) => i !== index);
    // bulletImagesも同期
    const newBulletImages = slide.bulletImages
      ? slide.bulletImages.filter((_, i) => i !== index)
      : undefined;
    onSlideUpdate({
      ...slide,
      bullets: newBullets,
      bulletLevels: newLevels.length > 0 ? newLevels : undefined,
      bulletImages: newBulletImages && newBulletImages.length > 0 ? newBulletImages : undefined,
      displayMode: 'bullets',
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  // base5のカラム数変更
  const handleColumnCountChange = (count: 1 | 2 | 3) => {
    onSlideUpdate({
      ...slide,
      columnCount: count,
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  // D&D
  const handleDragStart = (index: number) => {
    setDragState({ dragIndex: index, dragOverIndex: -1, isDragging: true });
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragState.dragOverIndex !== index) {
      setDragState(prev => ({ ...prev, dragOverIndex: index }));
    }
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const { dragIndex } = dragState;
    if (dragIndex === -1 || dragIndex === dropIndex) {
      setDragState({ dragIndex: -1, dragOverIndex: -1, isDragging: false });
      return;
    }
    const newBullets = [...slide.bullets];
    const [draggedItem] = newBullets.splice(dragIndex, 1);
    newBullets.splice(dropIndex, 0, draggedItem);
    // bulletLevelsも連動して並べ替え
    const newLevels = [...(slide.bulletLevels || slide.bullets.map(() => 2))];
    const [draggedLevel] = newLevels.splice(dragIndex, 1);
    newLevels.splice(dropIndex, 0, draggedLevel);
    // bulletImagesも連動して並べ替え
    let newBulletImages: (BulletImage | null)[] | undefined;
    if (slide.bulletImages) {
      newBulletImages = [...slide.bulletImages];
      // 配列長をbulletsに合わせる
      while (newBulletImages.length < slide.bullets.length) newBulletImages.push(null);
      const [draggedImage] = newBulletImages.splice(dragIndex, 1);
      newBulletImages.splice(dropIndex, 0, draggedImage);
    }
    onSlideUpdate({
      ...slide,
      bullets: newBullets,
      bulletLevels: newLevels,
      bulletImages: newBulletImages,
      displayMode: 'bullets',
      editedByUser: true,
      updatedAt: new Date(),
    });
    setDragState({ dragIndex: -1, dragOverIndex: -1, isDragging: false });
  };

  const handleDragEnd = () => {
    setDragState({ dragIndex: -1, dragOverIndex: -1, isDragging: false });
  };

  const handleBodyTextChange = (text: string) => {
    setBodyText(text);
    onSlideUpdate({
      ...slide,
      bullets: [text],
      displayMode: 'body',
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  // TipTapリッチエディタからのコールバック（HTML + プレーンテキスト）
  const handleBodyRichChange = (html: string, plainText: string) => {
    setBodyText(plainText);
    onSlideUpdate({
      ...slide,
      bullets: plainText ? plainText.split('\n').filter(l => l.trim()) : [''],
      bodyHtml: html,
      displayMode: 'body',
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  // 箇条書きの見出しレベル変更
  const handleBulletLevelChange = (index: number, level: 1 | 2 | 3) => {
    const newLevels = [...(slide.bulletLevels || slide.bullets.map(() => 2))];
    // 配列が足りない場合は補完
    while (newLevels.length <= index) newLevels.push(2);
    newLevels[index] = level;
    onSlideUpdate({
      ...slide,
      bulletLevels: newLevels,
      editedByUser: true,
      updatedAt: new Date(),
    });
  };

  const handleToggleLock = () => {
    onSlideUpdate({
      ...slide,
      locked: !slide.locked,
      updatedAt: new Date(),
    });
  };

  // =====================================================
  // 画像挿入ハンドラ（base5専用）
  // =====================================================

  const handleBulletImageUploadClick = useCallback((index: number, size: BulletImageSize) => {
    setPendingImageIndex(index);
    setPendingImageSize(size);
    if (bulletImageInputRef.current) {
      bulletImageInputRef.current.value = '';
      bulletImageInputRef.current.click();
    }
  }, []);

  const handleBulletImageFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || pendingImageIndex === null) return;

    // バリデーション
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('ファイルサイズは5MB以下にしてください');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl || !slide) return;

      const newImage: BulletImage = {
        src: dataUrl,
        mimeType: file.type,
        size: pendingImageSize,
        fileName: file.name,
      };

      // bulletImages配列を作成/更新
      const newBulletImages: (BulletImage | null)[] = slide.bulletImages
        ? [...slide.bulletImages]
        : slide.bullets.map(() => null);
      // 配列長を合わせる
      while (newBulletImages.length <= pendingImageIndex) newBulletImages.push(null);
      newBulletImages[pendingImageIndex] = newImage;

      // 画像行のbulletsテキストはプレースホルダー
      const newBullets = [...slide.bullets];
      newBullets[pendingImageIndex] = '';

      onSlideUpdate({
        ...slide,
        bullets: newBullets,
        bulletImages: newBulletImages,
        displayMode: 'bullets',
        editedByUser: true,
        updatedAt: new Date(),
      });
    };
    reader.readAsDataURL(file);

    e.target.value = '';
    setPendingImageIndex(null);
  }, [pendingImageIndex, pendingImageSize, slide, onSlideUpdate]);

  const handleBulletImageSizeChange = useCallback((index: number, newSize: BulletImageSize) => {
    if (!slide?.bulletImages?.[index]) return;
    const newBulletImages = [...slide.bulletImages];
    newBulletImages[index] = { ...newBulletImages[index]!, size: newSize };
    onSlideUpdate({
      ...slide,
      bulletImages: newBulletImages,
      editedByUser: true,
      updatedAt: new Date(),
    });
  }, [slide, onSlideUpdate]);

  const handleRemoveBulletImage = useCallback((index: number) => {
    if (!slide?.bulletImages) return;
    const newBulletImages = [...slide.bulletImages];
    newBulletImages[index] = null;
    // bulletImages全部nullなら undefined に
    const hasAnyImage = newBulletImages.some(img => img !== null);
    onSlideUpdate({
      ...slide,
      bulletImages: hasAnyImage ? newBulletImages : undefined,
      editedByUser: true,
      updatedAt: new Date(),
    });
  }, [slide, onSlideUpdate]);

  // =====================================================
  // 箇条書き行レンダリング（D&D対応 + 見出しレベル選択）
  // =====================================================

  const renderBulletRow = (globalIndex: number, bullet: string) => {
    const isDragOver = dragState.dragOverIndex === globalIndex && dragState.isDragging;
    const isDragged = dragState.dragIndex === globalIndex;
    const currentLevel = getBulletLevel(slide.bulletLevels, globalIndex);
    const bulletImage = slide.bulletImages?.[globalIndex];

    // 画像行（base5のみ）
    if (bulletImage && isBase5) {
      return (
        <div
          key={globalIndex}
          draggable
          onDragStart={() => handleDragStart(globalIndex)}
          onDragOver={(e) => handleDragOver(e, globalIndex)}
          onDrop={(e) => handleDrop(e, globalIndex)}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-1.5 transition-all ${
            isDragged ? 'opacity-40' : ''
          } ${isDragOver ? 'border-t-2 border-blue-400' : ''}`}
        >
          {/* 左側: ドラッグハンドル + 画像設定メニュー */}
          <div className="flex items-center gap-0.5 shrink-0">
            <div className="cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-slate-600">
              <GripVertical className="w-4 h-4" />
            </div>
            <LeftContentMenu
              isImageRow={true}
              currentSize={bulletImage.size}
              onInsertImage={() => {}}
              onChangeSize={(sz) => handleBulletImageSizeChange(globalIndex, sz)}
              onRemoveImage={() => handleRemoveBulletImage(globalIndex)}
            />
          </div>
          {/* 画像サムネイル */}
          <div className="flex-1 flex items-center gap-2 px-2 py-1 border border-slate-200 rounded bg-slate-50 min-w-0">
            <img
              src={bulletImage.src}
              alt={bulletImage.fileName || '画像'}
              className="h-8 max-w-[60px] object-contain rounded"
            />
            <span className="text-[10px] text-slate-500 truncate flex-1">
              {bulletImage.fileName || '画像'}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
              bulletImage.size === 'S' ? 'bg-green-100 text-green-700' :
              bulletImage.size === 'M' ? 'bg-blue-100 text-blue-700' :
              'bg-purple-100 text-purple-700'
            }`}>
              {bulletImage.size}
            </span>
          </div>
          {/* 右側: 行管理メニュー（削除のみ） */}
          <RightManageMenu onDelete={() => handleRemoveBullet(globalIndex)} />
        </div>
      );
    }

    // テキスト行
    return (
      <div
        key={globalIndex}
        draggable
        onDragStart={() => handleDragStart(globalIndex)}
        onDragOver={(e) => handleDragOver(e, globalIndex)}
        onDrop={(e) => handleDrop(e, globalIndex)}
        onDragEnd={handleDragEnd}
        className={`flex items-center gap-1.5 transition-all ${
          isDragged ? 'opacity-40' : ''
        } ${isDragOver ? 'border-t-2 border-blue-400' : ''}`}
      >
        {/* 左側: ドラッグハンドル + (base5のみ)画像挿入メニュー */}
        <div className="flex items-center gap-0.5 shrink-0">
          <div
            className="cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-slate-600"
            title="ドラッグで並び替え"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          {isBase5 && (
            <LeftContentMenu
              isImageRow={false}
              onInsertImage={(size) => handleBulletImageUploadClick(globalIndex, size)}
            />
          )}
        </div>
        {/* 見出しレベル切替（H1/H2/H3） */}
        <div className="flex shrink-0 bg-slate-50 rounded border border-slate-200 overflow-hidden">
          {([1, 2, 3] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => handleBulletLevelChange(globalIndex, lvl)}
              className={`px-1 py-0.5 text-[9px] font-bold leading-none transition-colors ${
                currentLevel === lvl
                  ? lvl === 1
                    ? 'bg-blue-500 text-white'
                    : lvl === 2
                    ? 'bg-slate-500 text-white'
                    : 'bg-slate-400 text-white'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
              title={`見出し${lvl}`}
            >
              H{lvl}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={bullet}
          onChange={(e) => handleBulletChange(globalIndex, e.target.value)}
          className={`flex-1 px-3 py-1.5 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-0 ${
            currentLevel === 1
              ? 'text-sm font-bold'
              : currentLevel === 2
              ? 'text-sm font-medium'
              : 'text-xs font-normal'
          }`}
          placeholder={`箇条書き ${globalIndex + 1}`}
        />
        {/* 右側: base5は行管理メニュー / その他はXボタン */}
        {isBase5 ? (
          <RightManageMenu onDelete={() => handleRemoveBullet(globalIndex)} />
        ) : (
          <button
            onClick={() => handleRemoveBullet(globalIndex)}
            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  // カラム数セレクターUI（base5用）
  const renderColumnSelector = () => {
    if (!isBase5) return null;
    const currentCount = slide.columnCount || 1;
    return (
      <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5">
        {([1, 2, 3] as const).map(count => (
          <button
            key={count}
            onClick={() => handleColumnCountChange(count)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              currentCount === count
                ? 'bg-indigo-500 text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {count}列
          </button>
        ))}
      </div>
    );
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
              onClick={() => handleModeChange('bullets')}
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
              onClick={() => handleModeChange('body')}
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
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-500">
                箇条書き（最大{maxBullets}行）
              </label>
              <div className="flex items-center gap-2">
                {/* base5: カラム数選択 */}
                {renderColumnSelector()}
                {/* base3/base4/base5(2列以上): カラム表示バッジ */}
                {effectiveColumnCount > 1 && !isBase5 && (
                  <span className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    <Columns className="w-3 h-3" />
                    {effectiveColumnCount}カラム表示
                  </span>
                )}
              </div>
            </div>

            {/* マルチカラム編集UI */}
            {effectiveColumnCount > 1 ? (
              <div className={`grid gap-3 ${
                effectiveColumnCount === 2 ? 'grid-cols-2' : 'grid-cols-3'
              }`}>
                {columnIndices.map((indices, colIdx) => (
                  <div key={colIdx} className="space-y-2">
                    <div className={`text-[10px] font-medium ${COLUMN_TEXT_COLORS[colIdx]} flex items-center gap-1 pb-1 border-b ${COLUMN_BORDER_COLORS[colIdx]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${COLUMN_DOT_COLORS[colIdx]}`} />
                      {effectiveColumnCount === 2
                        ? (colIdx === 0 ? '左列' : '右列')
                        : COLUMN_LABELS[colIdx]
                      }
                    </div>
                    {indices.map(idx => renderBulletRow(idx, slide.bullets[idx]))}
                    {indices.length === 0 && (
                      <p className="text-[10px] text-slate-400 py-2 text-center">項目なし</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* 1カラム編集UI */
              <div className="space-y-2">
                {slide.bullets.map((bullet, index) =>
                  renderBulletRow(index, bullet)
                )}
              </div>
            )}

            {/* 箇条書き追加ボタン */}
            {slide.bullets.length < maxBullets && (
              <button
                onClick={handleAddBullet}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-50 rounded mt-2"
              >
                <Plus className="w-3 h-3" />
                箇条書きを追加
              </button>
            )}

            {/* マルチカラム時の補足説明 */}
            {effectiveColumnCount > 1 && (
              <p className="text-[10px] text-slate-400 mt-2">
                ※ ドラッグで並び替えると列の配置も変わります（順番に自動配分）
              </p>
            )}
          </div>
        )}

        {/* 本文モード（TipTapリッチエディタ） */}
        {editMode === 'body' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              本文（リッチテキスト）
            </label>
            <BodyRichEditor
              html={slide.bodyHtml || ''}
              plainText={bodyText}
              onChange={handleBodyRichChange}
              disabled={disabled}
            />
          </div>
        )}

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

      {/* 画像挿入用hidden input（base5専用） */}
      {isBase5 && (
        <input
          ref={bulletImageInputRef}
          type="file"
          accept="image/*"
          onChange={handleBulletImageFileChange}
          className="hidden"
        />
      )}
    </div>
  );
}

export default SlideContentEditor;

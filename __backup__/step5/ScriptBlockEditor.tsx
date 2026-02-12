"use client";

import React, { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  ChevronDown,
  Edit3,
  Trash2,
} from 'lucide-react';
import { BlockMenu } from '@/components/ui/DropdownMenu';
import { ScriptBlock, BlockType, BLOCK_TYPE_LABELS, SyncStatus } from '@/lib/types';

// =====================================================
// ブロックタイプに応じたスタイル
// =====================================================
const getBlockStyles = (type: BlockType, isGenerated: boolean) => {
  const baseStyles = "w-full outline-none bg-transparent resize-none";

  switch (type) {
    case 'heading1':
      return `${baseStyles} font-bold text-2xl mt-6 mb-4 text-slate-800`;
    case 'heading2':
      return `${baseStyles} font-bold text-lg mt-4 mb-2 text-slate-800`;
    case 'bullet':
      return `${baseStyles} text-slate-600 leading-relaxed`;
    case 'body':
      return `${baseStyles} text-slate-600 leading-relaxed ${isGenerated ? 'min-h-[200px]' : ''}`;
    case 'note':
      return `${baseStyles} text-slate-500 text-sm italic leading-relaxed pl-3 border-l-2 border-slate-300`;
    default:
      return baseStyles;
  }
};

// =====================================================
// タイプセレクタ
// =====================================================
interface TypeSelectorProps {
  type: BlockType;
  onChange: (newType: BlockType) => void;
}

function TypeSelector({ type, onChange }: TypeSelectorProps) {
  const availableTypes: BlockType[] = ['heading2', 'bullet', 'body', 'note'];

  return (
    <div className="relative group/select">
      <button className="flex items-center gap-1 px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors">
        <span>{BLOCK_TYPE_LABELS[type]}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 min-w-[100px] z-50 opacity-0 invisible group-hover/select:opacity-100 group-hover/select:visible transition-all">
        {availableTypes.map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 transition-colors ${
              t === type ? 'text-purple-600 font-medium bg-purple-50' : 'text-slate-600'
            }`}
          >
            {BLOCK_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// ソート可能なブロックアイテム
// =====================================================
interface SortableBlockProps {
  block: ScriptBlock;
  isGenerated: boolean;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  onContentChange: (id: string, content: string) => void;
  onTypeChange: (id: string, type: BlockType) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

function SortableBlock({
  block,
  isGenerated,
  inputRef,
  onContentChange,
  onTypeChange,
  onDelete,
  onEdit,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const renderInput = () => {
    const inputStyles = getBlockStyles(block.type, isGenerated);

    if (block.type === 'bullet') {
      return (
        <div className="flex items-start gap-2 flex-1 py-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
          <input
            type="text"
            value={block.content}
            onChange={(e) => onContentChange(block.id, e.target.value)}
            placeholder="要点を入力..."
            className={inputStyles}
          />
        </div>
      );
    }

    if (block.type === 'body' || block.type === 'note') {
      return (
        <textarea
          value={block.content}
          onChange={(e) => onContentChange(block.id, e.target.value)}
          placeholder={block.type === 'note' ? '補足を入力...' : '本文を入力...'}
          rows={block.type === 'body' ? 8 : 3}
          className={inputStyles}
          style={block.type === 'body' ? { minHeight: '200px' } : undefined}
        />
      );
    }

    return (
      <input
        type="text"
        value={block.content}
        onChange={(e) => onContentChange(block.id, e.target.value)}
        placeholder={block.type === 'heading1' ? '章タイトル...' : '見出しを入力...'}
        className={inputStyles}
      />
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={block.id}
      className={`group relative flex items-start gap-2 -ml-8 px-2 py-2 rounded-md transition-colors ${
        isDragging ? 'bg-purple-50 shadow-lg' : 'hover:bg-slate-50'
      } ${isGenerated && block.type === 'body' ? 'bg-purple-50/30' : ''}`}
    >
      {/* ドラッグハンドル */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center mt-1 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4 text-slate-300 hover:text-slate-500" />
      </div>

      {/* 入力フィールド */}
      <div className="flex-1">
        {renderInput()}
      </div>

      {/* タイプ選択 & メニュー */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {block.type !== 'heading1' && (
          <TypeSelector
            type={block.type}
            onChange={(newType) => onTypeChange(block.id, newType)}
          />
        )}
        <BlockMenu
          onEdit={() => onEdit(block.id)}
          onDelete={() => onDelete(block.id)}
        />
      </div>
    </div>
  );
}

// =====================================================
// メインコンポーネント
// =====================================================
interface ScriptBlockEditorProps {
  blocks: ScriptBlock[];
  syncStatus: SyncStatus;
  onBlocksChange: (blocks: ScriptBlock[]) => void;
  onAddBlock: (type: BlockType) => void;
}

export default function ScriptBlockEditor({
  blocks,
  syncStatus,
  onBlocksChange,
  onAddBlock,
}: ScriptBlockEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isGenerated = syncStatus === 'draft_generated';

  // 全ブロックを元の順序で表示（分離しない）
  // body/noteも上部に残り、スライドへの反映対象となる

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newBlocks = arrayMove(blocks, oldIndex, newIndex);
      onBlocksChange(newBlocks);
    }
  }, [blocks, onBlocksChange]);

  const handleContentChange = useCallback((id: string, content: string) => {
    const newBlocks = blocks.map((b) =>
      b.id === id ? { ...b, content } : b
    );
    onBlocksChange(newBlocks);
  }, [blocks, onBlocksChange]);

  const handleTypeChange = useCallback((id: string, type: BlockType) => {
    const newBlocks = blocks.map((b) =>
      b.id === id ? { ...b, type } : b
    );
    onBlocksChange(newBlocks);
  }, [blocks, onBlocksChange]);

  const handleDelete = useCallback((id: string) => {
    if (!window.confirm('この行を削除しますか？')) return;
    const newBlocks = blocks.filter((b) => b.id !== id);
    onBlocksChange(newBlocks);
  }, [blocks, onBlocksChange]);

  const handleEdit = useCallback((id: string) => {
    // 該当ブロックの入力フィールドにフォーカス
    const input = document.querySelector(`[data-block-id="${id}"] input, [data-block-id="${id}"] textarea`);
    if (input) {
      (input as HTMLElement).focus();
    }
  }, []);

  return (
    <div className="space-y-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          {/* 全ブロックを元の順序で表示 */}
          {blocks.map((block) => (
            <SortableBlock
              key={block.id}
              block={block}
              isGenerated={isGenerated && (block.type === 'body' || block.type === 'note')}
              onContentChange={handleContentChange}
              onTypeChange={handleTypeChange}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* ブロック追加ボタン */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onAddBlock('bullet')}
          className="flex-1 py-3 text-slate-400 text-sm cursor-pointer hover:bg-slate-50 transition-colors rounded-md border border-dashed border-slate-300"
        >
          + 箇条書きを追加
        </button>
        <button
          onClick={() => onAddBlock('body')}
          className="flex-1 py-3 text-slate-400 text-sm cursor-pointer hover:bg-slate-50 transition-colors rounded-md border border-dashed border-slate-300"
        >
          + 本文を追加
        </button>
        <button
          onClick={() => onAddBlock('note')}
          className="flex-1 py-3 text-slate-400 text-sm cursor-pointer hover:bg-slate-50 transition-colors rounded-md border border-dashed border-slate-300"
        >
          + 補足を追加
        </button>
      </div>
    </div>
  );
}

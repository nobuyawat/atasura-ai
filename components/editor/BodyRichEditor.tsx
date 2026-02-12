"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Mark, mergeAttributes } from '@tiptap/core';

// =====================================================
// カスタムMark: HeadingLevel（インライン見出しレベル装飾）
// <span data-heading-level="1|2|3"> として出力
// =====================================================

const HeadingLevel = Mark.create({
  name: 'headingLevel',

  addAttributes() {
    return {
      level: {
        default: 2,
        parseHTML: (element) => {
          return parseInt(element.getAttribute('data-heading-level') || '2', 10);
        },
        renderHTML: (attributes) => {
          return { 'data-heading-level': attributes.level };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-heading-level]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const level = HTMLAttributes['data-heading-level'] || 2;
    // インラインスタイルを付与してエディタ内でも見た目が変わるように
    const styles: Record<number, string> = {
      1: 'font-size: 1.15em; font-weight: 700; color: #1e293b;',
      2: 'font-size: 1em; font-weight: 500; color: #475569;',
      3: 'font-size: 0.85em; font-weight: 400; color: #64748b;',
    };
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        style: styles[level] || styles[2],
      }),
      0,
    ];
  },
});

// =====================================================
// Props
// =====================================================

interface BodyRichEditorProps {
  html: string;
  plainText: string;       // bodyHtml未設定時のフォールバック
  onChange: (html: string, plainText: string) => void;
  disabled?: boolean;
}

// =====================================================
// HTML → プレーンテキスト変換
// =====================================================

function htmlToPlainText(html: string): string {
  if (!html) return '';
  // <br> と </p><p> を改行に変換し、タグを削除
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

// =====================================================
// プレーンテキスト → HTML変換（初回用）
// =====================================================

function plainTextToHtml(text: string): string {
  if (!text) return '<p></p>';
  const lines = text.split('\n');
  return lines.map(line => `<p>${line || '<br>'}</p>`).join('');
}

// =====================================================
// カスタムバブルメニュー（テキスト選択時に表示）
// TipTap v3ではBubbleMenuコンポーネントが@tiptap/reactに含まれないため
// エディタの選択状態を監視して手動でツールバーを表示する
// =====================================================

interface CustomBubbleMenuProps {
  editor: ReturnType<typeof useEditor>;
  onApplyHeadingLevel: (level: 1 | 2 | 3) => void;
}

function CustomBubbleMenu({ editor, onApplyHeadingLevel }: CustomBubbleMenuProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const updateMenu = () => {
      const { from, to, empty } = editor.state.selection;

      if (empty || from === to) {
        setShow(false);
        return;
      }

      // テキストが選択されている場合、選択範囲の上にメニューを表示
      const editorEl = editor.view.dom;
      const editorRect = editorEl.getBoundingClientRect();

      // 選択範囲の座標を取得
      const coords = editor.view.coordsAtPos(from);
      const endCoords = editor.view.coordsAtPos(to);

      // メニュー位置を計算（選択範囲の上中央）
      const top = coords.top - editorRect.top - 40;
      const left = (coords.left + endCoords.left) / 2 - editorRect.left;

      setPosition({ top, left });
      setShow(true);
    };

    // 名前付き関数でイベントリスナーを登録（クリーンアップ時に確実にoffできるように）
    const handleBlur = () => setShow(false);

    editor.on('selectionUpdate', updateMenu);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('selectionUpdate', updateMenu);
      editor.off('blur', handleBlur);
    };
  }, [editor]);

  if (!show || !editor) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 flex bg-white rounded-lg shadow-lg border border-slate-200 p-0.5 gap-0.5"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => e.preventDefault()} // クリック時にエディタのフォーカスを失わないように
    >
      {([1, 2, 3] as const).map(lvl => {
        const isActive = editor.isActive('headingLevel', { level: lvl });
        return (
          <button
            key={lvl}
            onClick={() => onApplyHeadingLevel(lvl)}
            className={`px-2 py-1 text-[10px] font-bold rounded transition-colors ${
              isActive
                ? lvl === 1
                  ? 'bg-blue-500 text-white'
                  : lvl === 2
                  ? 'bg-slate-500 text-white'
                  : 'bg-slate-400 text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
            title={`見出し${lvl}`}
          >
            H{lvl}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// メインコンポーネント
// =====================================================

export function BodyRichEditor({ html, plainText, onChange, disabled = false }: BodyRichEditorProps) {
  const isInternalUpdate = useRef(false);
  // onUpdate → onChange の過剰呼び出しを防止するdebounceタイマー
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初期コンテンツ: bodyHtml優先、なければplainTextからHTML変換
  const initialContent = html || plainTextToHtml(plainText);

  // onChangeをrefで保持（useEditor内のコールバックから参照しても最新値を取得するため）
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 不要な機能を無効化（シンプルに保つ）
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
        strike: false,
        bold: false,
        italic: false,
      }),
      HeadingLevel,
    ],
    content: initialContent,
    editable: !disabled,
    immediatelyRender: false, // SSR hydration mismatch を防止
    onUpdate: ({ editor }) => {
      if (isInternalUpdate.current) return;

      // debounce: 150ms以内の連続入力はまとめて1回だけonChangeを呼ぶ
      // これにより毎キーストロークの state更新→再レンダ連鎖を防止
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      debounceTimer.current = setTimeout(() => {
        const newHtml = editor.getHTML();
        const newPlain = htmlToPlainText(newHtml);
        onChangeRef.current(newHtml, newPlain);
      }, 150);
    },
  });

  // クリーンアップ: debounceタイマー
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // disabled変更時
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  // 外部からHTMLが変わった場合（スライド切替時など）
  useEffect(() => {
    if (!editor) return;
    const newContent = html || plainTextToHtml(plainText);
    const currentContent = editor.getHTML();
    // 内容が実質的に同じなら更新しない（カーソル位置保持）
    if (newContent !== currentContent) {
      isInternalUpdate.current = true;
      editor.commands.setContent(newContent, { emitUpdate: false });
      isInternalUpdate.current = false;
    }
  }, [html, plainText]);

  // 見出しレベル適用
  const applyHeadingLevel = useCallback((level: 1 | 2 | 3) => {
    if (!editor) return;
    // 現在のマークが同じレベルならトグルオフ
    const isActive = editor.isActive('headingLevel', { level });
    if (isActive) {
      editor.chain().focus().unsetMark('headingLevel').run();
    } else {
      // 他のレベルを解除してから新しいレベルを適用
      editor.chain().focus().unsetMark('headingLevel').setMark('headingLevel', { level }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="relative">
      {/* カスタムバブルメニュー: テキスト選択時に表示 */}
      <CustomBubbleMenu editor={editor} onApplyHeadingLevel={applyHeadingLevel} />

      {/* エディタ本体 */}
      <EditorContent
        editor={editor}
        className="body-rich-editor prose prose-sm max-w-none px-3 py-2 border border-slate-200 rounded-lg text-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent min-h-[80px]"
      />

      {/* ヒント */}
      <p className="text-[10px] text-slate-400 mt-1">
        ※ テキストを選択するとH1/H2/H3メニューが表示されます
      </p>
    </div>
  );
}

// エクスポート用ヘルパー関数
export { htmlToPlainText, plainTextToHtml };

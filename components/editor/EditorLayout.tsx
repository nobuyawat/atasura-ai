"use client";

import React, { useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Cloud,
  MoreVertical,
  Plus,
  ArrowRightLeft,
  Play,
  Layout,
  Type,
  GripVertical,
  Settings,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Share2,
  RefreshCw
} from 'lucide-react';

// --- 型定義 ---
type SyncStatus = 'synced' | 'script_ahead' | 'slide_ahead' | 'conflict';

interface Section {
  id: string;
  title: string;
  syncStatus: SyncStatus;
}

interface Chapter {
  id: string;
  title: string;
  sections: Section[];
}

interface ScriptBlock {
  id: string;
  type: 'bullet' | 'heading';
  content: string;
}

interface SlideData {
  title: string;
  bullets: string[];
  speakerNotes: string[];  // 導入トーク等の本文（2つ目以降のheading + bullets）
}

// --- モックデータ ---
const INITIAL_CHAPTERS: Chapter[] = [
  {
    id: 'ch-1',
    title: '第1章：導入と基本コンセプト',
    sections: [
      { id: 'sec-1-1', title: 'コースの目的', syncStatus: 'synced' },
      { id: 'sec-1-2', title: 'なぜこのスキルが必要か', syncStatus: 'script_ahead' },
      { id: 'sec-1-3', title: '全体像の把握', syncStatus: 'conflict' },
    ]
  },
  {
    id: 'ch-2',
    title: '第2章：実践的なワークフロー',
    sections: [
      { id: 'sec-2-1', title: '環境構築', syncStatus: 'synced' },
      { id: 'sec-2-2', title: '最初のステップ', syncStatus: 'slide_ahead' },
    ]
  }
];

const INITIAL_SCRIPT_BLOCKS: ScriptBlock[] = [
  { id: 'b1', type: 'heading', content: '本セクションの目標' },
  { id: 'b2', type: 'bullet', content: 'Web講座制作の全体フローを理解することができる' },
  { id: 'b3', type: 'bullet', content: '効率的な台本執筆のコツを掴む' },
  { id: 'b4', type: 'heading', content: '導入トーク' },
  { id: 'b5', type: 'bullet', content: '皆さん、こんにちは。本日はWeb講座の作り方について解説します。' },
  { id: 'b6', type: 'bullet', content: 'まずは、なぜ台本とスライドの同期が重要なのかを見ていきましょう。' },
];

// --- 台本→スライド変換ロジック ---
// 最初のheading = タイトル
// 最初のheading直後のbullets（最大4つ）= スライド本文
// 2つ目以降のheading + bullets = スピーカーノート
function convertScriptToSlide(blocks: ScriptBlock[]): SlideData {
  let title = 'タイトル未設定';
  const bullets: string[] = [];
  const speakerNotes: string[] = [];

  let foundFirstHeading = false;
  let inNotesSection = false;

  for (const block of blocks) {
    if (block.type === 'heading') {
      if (!foundFirstHeading) {
        // 最初のheading = タイトル
        title = block.content;
        foundFirstHeading = true;
      } else {
        // 2つ目以降のheading = ノートセクションの開始
        inNotesSection = true;
        if (block.content.trim()) {
          speakerNotes.push(`【${block.content}】`);
        }
      }
    } else if (block.type === 'bullet') {
      if (!inNotesSection && bullets.length < 5) {
        // スライド本文の箇条書き（最大5つ）
        bullets.push(block.content);
      } else {
        // ノートセクションのbullet
        if (block.content.trim()) {
          speakerNotes.push(block.content);
        }
      }
    }
  }

  console.log('[SLIDE_BUILD] title:', title, 'bullets:', bullets.length, 'notesLen:', speakerNotes.length);
  return { title, bullets, speakerNotes };
}

// --- サブコンポーネント ---
const StatusIcon = ({ status }: { status: SyncStatus }) => {
  switch (status) {
    case 'synced':
      return <CheckCircle2 className="w-4 h-4 text-[#10B981]" />;
    case 'script_ahead':
      return <Clock className="w-4 h-4 text-[#F59E0B]" />;
    case 'slide_ahead':
      return <Clock className="w-4 h-4 text-[#2563EB]" />;
    case 'conflict':
      return <AlertCircle className="w-4 h-4 text-[#EF4444]" />;
  }
};

// 同期ステータスバッジ
const SyncStatusBadge = ({ status }: { status: SyncStatus }) => {
  const config = {
    synced: { bg: 'bg-green-100', text: 'text-green-700', label: '同期済み' },
    script_ahead: { bg: 'bg-orange-100', text: 'text-orange-700', label: '台本が新しい' },
    slide_ahead: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'スライドが新しい' },
    conflict: { bg: 'bg-red-100', text: 'text-red-700', label: '衝突あり' },
  };
  const c = config[status];
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
};

export default function EditorLayout() {
  const [courseTitle, setCourseTitle] = useState("未経験から始めるReactエンジニア講義");
  const [activeSection, setActiveSection] = useState("sec-1-1");

  // 章・節のデータをstateで管理（ステータス連動のため）
  const [chapters, setChapters] = useState<Chapter[]>(INITIAL_CHAPTERS);

  // 台本ブロックをstateで管理
  const [scriptBlocks, setScriptBlocks] = useState<ScriptBlock[]>(INITIAL_SCRIPT_BLOCKS);

  // スライドデータをstateで管理
  const [slideData, setSlideData] = useState<SlideData>(() =>
    convertScriptToSlide(INITIAL_SCRIPT_BLOCKS)
  );

  // 同期ステータス（現在選択中の節）
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');

  // 同期中フラグ（アニメーション用）
  const [isSyncing, setIsSyncing] = useState(false);

  // 節のステータスを更新する関数
  const updateSectionStatus = useCallback((sectionId: string, newStatus: SyncStatus) => {
    console.log('[TREE_STATUS] Updating section:', sectionId, 'to:', newStatus);
    setChapters(prev => prev.map(chapter => ({
      ...chapter,
      sections: chapter.sections.map(section =>
        section.id === sectionId ? { ...section, syncStatus: newStatus } : section
      )
    })));
  }, []);

  // 台本ブロックの内容を更新
  const handleBlockChange = useCallback((blockId: string, newContent: string) => {
    console.log('[BLOCK_CHANGE] blockId:', blockId, 'newContent:', newContent, 'sectionId:', activeSection);
    setScriptBlocks(prev => {
      const updated = prev.map(block =>
        block.id === blockId ? { ...block, content: newContent } : block
      );
      console.log('[SYNC_STATE] scriptBlocks updated, count:', updated.length);
      return updated;
    });
    // 台本が変更されたので「台本が新しい」状態に
    if (syncStatus === 'synced') {
      console.log('[SYNC_STATE] status changing: synced -> script_ahead for section:', activeSection);
      setSyncStatus('script_ahead');
      updateSectionStatus(activeSection, 'script_ahead');
    }
  }, [syncStatus, activeSection, updateSectionStatus]);

  // 「スライドに反映」ボタンの処理
  const handleSyncToSlide = useCallback(() => {
    console.log('[SYNC_CLICK] Button clicked! sectionId:', activeSection, 'blocksCount:', scriptBlocks.length);
    console.log('[SYNC_CLICK] Current syncStatus:', syncStatus, 'isSyncing:', isSyncing);
    setIsSyncing(true);

    // 少し遅延させてアニメーション効果を出す
    setTimeout(() => {
      const newSlideData = convertScriptToSlide(scriptBlocks);
      console.log('[SYNC_CLICK] Converted slideData:', {
        title: newSlideData.title,
        bulletsCount: newSlideData.bullets.length,
        notesCount: newSlideData.speakerNotes.length
      });
      setSlideData(newSlideData);
      setSyncStatus('synced');
      updateSectionStatus(activeSection, 'synced');
      setIsSyncing(false);
      console.log('[SYNC_CLICK] Sync completed! sectionId:', activeSection);
    }, 500);
  }, [scriptBlocks, syncStatus, isSyncing, activeSection, updateSectionStatus]);

  // 新しいブロックを追加
  const handleAddBlock = useCallback(() => {
    const newBlock: ScriptBlock = {
      id: `b${Date.now()}`,
      type: 'bullet',
      content: ''
    };
    setScriptBlocks(prev => [...prev, newBlock]);
    setSyncStatus('script_ahead');
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#F9FAFB] text-slate-900 overflow-hidden">
      {/* --- ヘッダー (h-14) --- */}
      <header className="h-14 border-b bg-white flex items-center justify-between px-4 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-[#2563EB] p-1.5 rounded-lg">
            <Layout className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <input
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              className="font-semibold text-sm border-transparent hover:border-slate-200 border px-2 py-1 rounded transition-colors focus:outline-none focus:border-[#2563EB] w-80"
            />
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border rounded-full">
              <Cloud className="w-4 h-4 text-slate-400" />
              <span className="text-[11px] text-slate-500 font-medium">保存済み</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md transition-colors">
            <History className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-md transition-colors">
            <Share2 className="w-4 h-4" />
            共有
          </button>
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center cursor-pointer overflow-hidden border">
            <User className="w-5 h-5 text-slate-500" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* --- 左サイドバー (w-60) --- */}
        <aside className="w-60 border-r bg-white flex flex-col shrink-0">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="検索..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border-none rounded-md text-xs focus:ring-1 ring-[#2563EB] outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {chapters.map(chapter => (
              <div key={chapter.id} className="mb-4">
                <div className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <ChevronDown className="w-3 h-3" />
                  {chapter.title}
                </div>
                <div className="mt-1 space-y-0.5">
                  {chapter.sections.map(section => (
                    <div
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`
                        flex items-center justify-between px-2 py-2 rounded-md cursor-pointer transition-colors group
                        ${activeSection === section.id ? 'bg-blue-50 text-[#2563EB]' : 'hover:bg-slate-50 text-slate-600'}
                      `}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Type className={`w-4 h-4 shrink-0 ${activeSection === section.id ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                        <span className="text-sm truncate leading-tight">{section.title}</span>
                      </div>
                      <StatusIcon status={section.syncStatus} />
                    </div>
                  ))}
                  <button className="w-full flex items-center gap-2 px-2 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                    <Plus className="w-3 h-3" />
                    節を追加
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* --- 中央: 台本エディタ --- */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* 台本ヘッダー */}
          <div className="h-12 border-b flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>第1章</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-slate-900 font-medium">第1節：コースの目的</span>
              <SyncStatusBadge status={syncStatus} />
            </div>
            <button
              onClick={handleSyncToSlide}
              disabled={syncStatus === 'synced' || isSyncing}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm
                ${syncStatus === 'synced'
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#2563EB] text-white hover:bg-blue-600 active:scale-95'}
              `}
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRightLeft className="w-3.5 h-3.5" />
              )}
              {isSyncing ? '同期中...' : 'スライドに反映'}
            </button>
          </div>

          {/* エディタ本体 */}
          <div className="flex-1 overflow-y-auto px-12 py-10 max-w-3xl mx-auto w-full">
            <h1 className="text-3xl font-bold mb-8 outline-none">コースの目的</h1>
            <div className="space-y-1">
              {scriptBlocks.map((block) => (
                <div
                  key={block.id}
                  className="group relative flex items-start gap-2 -ml-8 px-2 py-1 rounded-md hover:bg-slate-50 transition-colors"
                >
                  <div className="opacity-0 group-hover:opacity-100 flex items-center mt-1 cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                  </div>
                  {block.type === 'heading' ? (
                    <input
                      type="text"
                      value={block.content}
                      onChange={(e) => handleBlockChange(block.id, e.target.value)}
                      placeholder="見出しを入力..."
                      className="font-bold text-lg mt-4 mb-2 text-slate-800 w-full outline-none bg-transparent"
                    />
                  ) : (
                    <input
                      type="text"
                      value={block.content}
                      onChange={(e) => handleBlockChange(block.id, e.target.value)}
                      placeholder="要点を入力..."
                      className="flex-1 py-1 text-slate-600 leading-relaxed outline-none bg-transparent"
                    />
                  )}
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded">
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddBlock}
                className="w-full pl-2 py-4 text-slate-400 text-sm cursor-pointer hover:bg-slate-50 transition-colors rounded-md mt-4 text-left"
              >
                + クリックしてブロックを追加...
              </button>
            </div>
          </div>
        </main>

        {/* --- 右: スライドプレビュー・編集 (w-480px) --- */}
        <aside className="w-[480px] border-l bg-slate-50 flex flex-col shrink-0 overflow-hidden">
          <div className="h-12 border-b bg-white flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-700">スライドプレビュー</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-[#2563EB] rounded font-bold uppercase tracking-tighter">
                HD 16:9
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500">
                <Settings className="w-4 h-4" />
              </button>
              <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500">
                <Play className="w-4 h-4 text-green-600" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center gap-6">
            {/* 16:9 カード - stateから描画 */}
            {(() => { console.log('[PREVIEW_RENDER] Rendering slide with:', slideData); return null; })()}
            <div className={`
              w-full aspect-video bg-white shadow-xl rounded-sm border border-slate-200
              overflow-hidden relative group cursor-pointer ring-2 ring-[#2563EB]
              transition-all duration-300
              ${isSyncing ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'}
            `}>
              <div className="absolute inset-0 flex flex-col p-8 bg-white">
                <div className="text-slate-400 text-[10px] font-mono uppercase tracking-widest mb-4">
                  Page 01
                </div>
                {/* タイトル */}
                <h2 className="text-2xl font-black text-slate-800 leading-tight mb-6">
                  {slideData.title}
                </h2>
                {/* 箇条書き */}
                <ul className="space-y-3 flex-1">
                  {slideData.bullets.map((bullet, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-2 h-2 rounded-full bg-[#2563EB] mt-2 shrink-0" />
                      <span className="text-sm text-slate-600 leading-relaxed">{bullet}</span>
                    </li>
                  ))}
                </ul>
                {/* デコレーション */}
                <div className="mt-auto pt-4 flex justify-center">
                  <div className="w-12 h-1 bg-[#2563EB] rounded-full" />
                </div>
              </div>
              <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors" />
            </div>

            {/* ページネーション */}
            <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-full border shadow-sm">
              <button
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 disabled:opacity-30"
                disabled
              >
                <ChevronDown className="w-5 h-5 rotate-90" />
              </button>
              <div className="text-sm font-medium">
                <span className="text-slate-900">1</span>
                <span className="text-slate-400 mx-1">/</span>
                <span className="text-slate-400">1</span>
              </div>
              <button
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 disabled:opacity-30"
                disabled
              >
                <ChevronDown className="w-5 h-5 -rotate-90" />
              </button>
            </div>

            {/* スピーカーノート（導入トーク等） */}
            {slideData.speakerNotes && slideData.speakerNotes.length > 0 && (
              <div className="w-full p-4 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700 font-medium mb-2 flex items-center gap-1">
                  🎤 スピーカーノート
                </p>
                <div className="text-[11px] text-amber-800 space-y-1 max-h-32 overflow-y-auto">
                  {slideData.speakerNotes.map((note, index) => (
                    <p key={index} className={note.startsWith('【') ? 'font-bold mt-2' : ''}>
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* 変換ルール説明 */}
            <div className="w-full p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700 font-medium mb-2">📝 変換ルール</p>
              <ul className="text-[11px] text-blue-600 space-y-1">
                <li>• 最初の見出し → スライドタイトル</li>
                <li>• 箇条書き（最大5つ）→ スライド本文</li>
                <li>• 2つ目以降の見出し＋本文 → スピーカーノート</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      {/* --- フッター (h-10) --- */}
      <footer className="h-10 border-t bg-white px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${syncStatus === 'synced' ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {syncStatus === 'synced' ? 'Synced' : 'Changes Pending'}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="text-[11px] text-slate-500">
            残りクレジット: <span className="font-bold text-slate-700">1,240</span> / 2,000
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">
            Professional Plan
          </div>
          <span className="text-[11px] text-slate-400 tracking-tighter">v1.2.4-build</span>
        </div>
      </footer>
    </div>
  );
}

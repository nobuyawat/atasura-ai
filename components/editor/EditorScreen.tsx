"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Cloud,
  MoreVertical,
  Plus,
  ArrowRightLeft,
  ArrowRight,
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
  RefreshCw,
  Sparkles,
  Edit3,
  X,
  FileText,
  HelpCircle,
  ZoomIn,
  Download,
  BookOpen,
  List,
  Image,
  FileDown,
  Printer,
  Upload,
  FolderUp,
  ExternalLink,
  Send,
} from 'lucide-react';
import {
  CourseData,
  Chapter,
  Section,
  ScriptBlock,
  SlideData,
  SyncStatus,
  BlockType,
  Slide,
  SectionContent,
  SlideSourceType,
  SlideVisual,
} from '@/lib/types';
import ScriptGenerationModal from './ScriptGenerationModal';
import ScriptBlockEditor from './ScriptBlockEditor';
import SlideModal from './SlideModal';
import DeckModal from './DeckModal';
import { BlockMenu } from '@/components/ui/DropdownMenu';
import { generateChapterSlides, generateSectionSlides } from '@/lib/scriptGenerator';
import { exportAllPages, exportAllScripts, exportAllPagesAsZip, exportAllScriptsAsZip, getTimestamp, sanitizeFilename, SectionScriptData } from '@/lib/exportUtils';
import {
  courseToNotebookLMText,
  NOTEBOOKLM_NOTEBOOK_URL,
} from '@/lib/notebooklmUtils';
import { TemplateSelector } from './TemplateSelector';
import { SlidePreviewLayout } from './SlidePreviewLayout';
import { SlideContentEditor } from './SlideContentEditor';
import { BaseTemplateId, getBaseTemplate, getMaxBulletCount, DEFAULT_TEMPLATE_ID } from '@/lib/base-templates';

// =====================================================
// サブコンポーネント
// =====================================================

const StatusIcon = ({ status }: { status: SyncStatus }) => {
  switch (status) {
    case 'synced':
      return <CheckCircle2 className="w-4 h-4 text-[#10B981]" />;
    case 'draft':
    case 'draft_generated':
      return <FileText className="w-4 h-4 text-slate-400" />;
    case 'script_ahead':
      return <Clock className="w-4 h-4 text-[#F59E0B]" />;
    case 'slide_ahead':
      return <Clock className="w-4 h-4 text-[#2563EB]" />;
    case 'conflict':
      return <AlertCircle className="w-4 h-4 text-[#EF4444]" />;
  }
};

const SyncStatusBadge = ({ status }: { status: SyncStatus }) => {
  const config: Record<SyncStatus, { bg: string; text: string; label: string }> = {
    synced: { bg: 'bg-green-100', text: 'text-green-700', label: '同期済み' },
    draft: { bg: 'bg-slate-100', text: 'text-slate-600', label: '下書き' },
    draft_generated: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'AI生成済み' },
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

// =====================================================
// 台本→スライド変換ロジック
// =====================================================
function convertBlocksToSlide(blocks: ScriptBlock[]): SlideData {
  let title = 'タイトル未設定';
  const bullets: string[] = [];
  const speakerNotes: string[] = [];

  let foundFirstHeading = false;
  let inNotesSection = false;

  for (const block of blocks) {
    if (block.type === 'heading1' || block.type === 'heading2') {
      if (!foundFirstHeading) {
        title = block.content || 'タイトル未設定';
        foundFirstHeading = true;
      } else {
        inNotesSection = true;
        if (block.content.trim()) {
          speakerNotes.push(`【${block.content}】`);
        }
      }
    } else if (block.type === 'bullet') {
      if (!inNotesSection && bullets.length < 5) {
        bullets.push(block.content);
      } else if (block.content.trim()) {
        speakerNotes.push(block.content);
      }
    } else if (block.type === 'body') {
      if (block.content.trim()) {
        speakerNotes.push(block.content);
      }
    }
  }

  console.log('[SLIDE_BUILD] title:', title, 'bullets:', bullets.length, 'notesLen:', speakerNotes.length);
  return { title, bullets, speakerNotes };
}

// DraftGenerationModal は ScriptGenerationModal に置き換え
// @see ./ScriptGenerationModal.tsx

// =====================================================
// Visual Prompt 自動生成（スライドコンテンツ→抽象的ビジュアル概念）
// =====================================================
function generateVisualPromptFromContent(title: string, bullets: string[], speakerNotes?: string): string {
  // スライド内容からキーワードを抽出して、ユーザーにわかりやすい日本語プロンプトを生成
  const parts: string[] = [];

  // タイトルから主題を抽出
  if (title && title.trim()) {
    parts.push(title.trim());
  }

  // 箇条書きからキーワードを抽出（最大3つ、短いものを優先）
  const shortBullets = bullets
    .filter(b => b.trim())
    .map(b => b.trim())
    .filter(b => b.length <= 30)
    .slice(0, 3);
  if (shortBullets.length > 0) {
    parts.push(shortBullets.join('、'));
  }

  // スピーカーノートからキーワードを補足（タイトル/箇条書きが薄い場合）
  if (parts.length === 0 && speakerNotes && speakerNotes.trim()) {
    // ノートの先頭から短いフレーズを抽出
    const noteSnippet = speakerNotes.trim().slice(0, 60).replace(/\n/g, ' ');
    parts.push(noteSnippet);
  }

  // 内容があればそれをベースにプロンプトを組み立て
  if (parts.length > 0) {
    const content = parts.join(' / ');
    return `${content} に関するイラスト・図解`;
  }

  // フォールバック
  return 'アイコン/図解/写真など';
}

// =====================================================
// メインコンポーネント
// =====================================================

interface EditorScreenProps {
  course: CourseData;
  onCourseUpdate: (course: CourseData) => void;
}

export default function EditorScreen({ course, onCourseUpdate }: EditorScreenProps) {
  // アクティブな章・節
  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    course.chapters[0]?.id || null
  );
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // 現在編集中の台本ブロック（節単位）
  const [currentBlocks, setCurrentBlocks] = useState<ScriptBlock[]>([]);

  // スライドデータ
  const [slideData, setSlideData] = useState<SlideData>({ title: '', bullets: [], speakerNotes: [] });

  // 同期ステータス
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('draft');
  const [isSyncing, setIsSyncing] = useState(false);

  // AI生成モーダル
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftTargetSection, setDraftTargetSection] = useState<{
    sectionId: string;
    sectionTitle: string;
    chapterTitle: string;
  } | null>(null);

  // ヘルプパネルの表示
  const [showHelp, setShowHelp] = useState(false);

  // スピーカーノート編集
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editingNotesText, setEditingNotesText] = useState('');

  // AIスライド生成状態
  const [isGeneratingSlides, setIsGeneratingSlides] = useState(false);
  const [slideGenerationError, setSlideGenerationError] = useState<string | null>(null);

  // 現在選択中のスライドインデックス
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // スライド編集モード
  const [isEditingSlide, setIsEditingSlide] = useState(false);
  const [editingSlideData, setEditingSlideData] = useState<Slide | null>(null);

  // スライド拡大モーダル
  const [showSlideModal, setShowSlideModal] = useState(false);
  const [slideModalIndex, setSlideModalIndex] = useState(0);

  // 特殊ビュー（表紙/目次）
  const [specialView, setSpecialView] = useState<'cover' | 'toc' | null>(null);

  // 表紙設定
  const [coverSettings, setCoverSettings] = useState({
    title: '',
    subtitle: '',
    author: '',
    showToc: true,
  });

  // デッキプレビューモーダル
  const [showDeckModal, setShowDeckModal] = useState(false);

  // 台本生成完了後の誘導表示（③④対応）
  const [showScriptCompletedGuide, setShowScriptCompletedGuide] = useState(false);

  // Visual Prompt編集モード
  const [isEditingVisualPrompt, setIsEditingVisualPrompt] = useState(false);
  const [editingVisualPrompt, setEditingVisualPrompt] = useState<string>('');
  const [showPromptHistory, setShowPromptHistory] = useState(false);

  // 画像アップロード用
  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const [imageUploadMode, setImageUploadMode] = useState<'cover' | 'contain'>('cover');

  // テンプレート選択（スライドがない場合の仮選択）
  const [pendingTemplateId, setPendingTemplateId] = useState<BaseTemplateId>(DEFAULT_TEMPLATE_ID);

  // NotebookLM インポート（PDF/ZIP両対応）
  const [isImportingSlides, setIsImportingSlides] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const slideFileInputRef = useRef<HTMLInputElement>(null);
  // 旧名との互換性
  const zipInputRef = slideFileInputRef;
  const isImportingZip = isImportingSlides;

  // PDF/ZIPファイルインポートハンドラ（統合版）
  const handleSlideFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';

    if (!isPdf && !isZip) {
      setImportError('PDFまたはZIPファイルを選択してください');
      return;
    }

    setIsImportingSlides(true);
    setImportError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', 'replace');
      formData.append('chapterId', course.chapters[0]?.id || 'chapter-1');
      formData.append('sectionId', course.chapters[0]?.sections[0]?.id || 'section-1');

      // PDF→専用変換API、ZIP→既存API
      const apiEndpoint = isPdf ? '/api/convert-pdf-to-slides' : '/api/import-notebooklm';

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'インポートに失敗しました');
      }

      // 成功したら最初の章の最初の節にスライドを設定
      if (data.slides && data.slides.length > 0) {
        const updatedCourse = { ...course };
        if (updatedCourse.chapters.length > 0 && updatedCourse.chapters[0].sections.length > 0) {
          updatedCourse.chapters[0].sections[0].slides = data.slides;
          updatedCourse.chapters[0].sections[0].syncStatus = 'synced';
          onCourseUpdate(updatedCourse);

          const fileType = isPdf ? 'PDF' : 'ZIP';
          alert(`NotebookLMスライドを${data.slides.length}枚取り込みました（${fileType}から変換）`);
        }
      }

    } catch (err: any) {
      console.error('[SlideImport] Error:', err);
      setImportError(err?.message || '不明なエラー');
    } finally {
      setIsImportingSlides(false);
      if (slideFileInputRef.current) {
        slideFileInputRef.current.value = '';
      }
    }
  }, [course, onCourseUpdate]);

  // 旧名との互換性
  const handleZipImport = handleSlideFileImport;

  // 台本セクションへのref（スクロール誘導用）
  const scriptSectionRef = useRef<HTMLDivElement>(null);

  // スライド編集エリア（中央）へのref（編集ボタンからスクロール用）
  const slideContentEditorRef = useRef<HTMLDivElement>(null);

  // 編集中のセクションID（フォーカス用）
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);

  // 現在のアクティブな章
  const activeChapter = useMemo(() =>
    course.chapters.find(c => c.id === activeChapterId),
    [course.chapters, activeChapterId]
  );

  // 現在のアクティブな節
  const activeSection = useMemo(() =>
    activeChapter?.sections.find(s => s.id === activeSectionId),
    [activeChapter, activeSectionId]
  );

  // 現在のセクションのスライド一覧
  const currentSlides = useMemo(() => {
    if (!activeSection?.slides || activeSection.slides.length === 0) {
      return null;
    }
    return activeSection.slides.sort((a, b) => a.order - b.order);
  }, [activeSection]);

  // 現在選択中のスライド
  const activeSlide = useMemo(() => {
    if (!currentSlides) return null;
    return currentSlides[activeSlideIndex] || currentSlides[0];
  }, [currentSlides, activeSlideIndex]);

  // スライド切替時に imageDisplayMode をスライドデータから復元
  useEffect(() => {
    if (activeSlide?.imageDisplayMode) {
      setImageUploadMode(activeSlide.imageDisplayMode);
    } else {
      // 未設定の場合はデフォルト（cover）にリセット
      setImageUploadMode('cover');
    }
  }, [activeSlide?.slideId]); // slideIdが変わったときのみ発火

  // 現在のスライドのテンプレートID（スライドがある場合はそれを優先、なければ仮選択を使用）
  const currentTemplateId: BaseTemplateId = activeSlide?.templateId || pendingTemplateId;

  // 中央エディタのブロックから本文テキストを抽出（スライドプレビューへリアルタイム反映用）
  const currentBodyText = useMemo(() => {
    const bodyBlocks = currentBlocks.filter(b => b.type === 'body');
    return bodyBlocks.map(b => b.content).join('\n').trim();
  }, [currentBlocks]);

  // =====================================================
  // 中央エディタからリアルタイムでスライドプレビュー用データを構築
  // これにより、中央エディタの編集がプレビューに即座に反映される
  // =====================================================
  const livePreviewData = useMemo(() => {
    // heading2 → タイトル
    const heading2Block = currentBlocks.find(b => b.type === 'heading2');
    const title = heading2Block?.content || '';

    // bullet → 箇条書き（テンプレートに応じた最大数）
    const maxBullets = getMaxBulletCount(currentTemplateId, activeSlide?.columnCount);
    const bulletBlocks = currentBlocks.filter(b => b.type === 'bullet');
    const bullets = bulletBlocks.map(b => b.content).filter(c => c.trim()).slice(0, maxBullets);

    // body → 本文テキスト
    const bodyBlocks = currentBlocks.filter(b => b.type === 'body');
    const bodyText = bodyBlocks.map(b => b.content).join('\n').trim();

    // note → スピーカーノート用
    const noteBlocks = currentBlocks.filter(b => b.type === 'note');
    const noteText = noteBlocks.map(b => b.content).join('\n').trim();

    return {
      title,
      bullets,
      bodyText,
      noteText,
      hasContent: title || bullets.length > 0 || bodyText,
    };
  }, [currentBlocks]);

  // 全ての章にセクションが1つもないかどうか（初期状態検知用）
  const hasNoSections = useMemo(() => {
    return course.chapters.every(ch => ch.sections.length === 0);
  }, [course.chapters]);

  // =====================================================
  // 章タイトル更新（目次 ↔ 台本 見出し1 双方向同期）
  // =====================================================
  const updateChapterTitle = useCallback((chapterId: string, newTitle: string) => {
    console.log('[SYNC] Chapter title updated:', chapterId, newTitle);
    const updatedCourse = {
      ...course,
      chapters: course.chapters.map(ch =>
        ch.id === chapterId ? { ...ch, title: newTitle } : ch
      ),
      updatedAt: new Date()
    };
    onCourseUpdate(updatedCourse);
  }, [course, onCourseUpdate]);

  // =====================================================
  // 章追加（編集画面から新しい章を追加）
  // =====================================================
  const addChapter = useCallback(() => {
    const newChapterIndex = course.chapters.length + 1;
    const newChapter: Chapter = {
      id: `ch-${newChapterIndex}-${Date.now()}`,
      title: '',  // 空のまま。ユーザー入力で確定（placeholder表示）
      sections: [],
    };

    const updatedCourse = {
      ...course,
      chapters: [...course.chapters, newChapter],
      updatedAt: new Date(),
    };
    onCourseUpdate(updatedCourse);

    // 追加した章にフォーカスするため、現在のセクション選択を解除
    setActiveSectionId(null);
    setActiveChapterId(newChapter.id);
    setSpecialView(null);
    console.log('[CHAPTER] Added new chapter:', newChapter.id);
  }, [course, onCourseUpdate]);

  // =====================================================
  // 小見出し追加
  // =====================================================
  const addSection = useCallback((chapterId: string) => {
    const chapter = course.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    const newSection: Section = {
      id: `sec-${chapterId}-${Date.now()}`,
      title: '',  // 空のまま。ユーザー入力で確定
      syncStatus: 'draft',
      blocks: [
        { id: `block-${Date.now()}`, type: 'heading2', content: '' }  // 空のまま
      ]
    };

    const updatedCourse = {
      ...course,
      chapters: course.chapters.map(ch =>
        ch.id === chapterId
          ? { ...ch, sections: [...ch.sections, newSection] }
          : ch
      ),
      updatedAt: new Date()
    };
    onCourseUpdate(updatedCourse);

    // 新しい節を選択
    setActiveSectionId(newSection.id);
    setCurrentBlocks(newSection.blocks);
    setSyncStatus('draft');
    console.log('[SECTION] Added new section:', newSection.id);
  }, [course, onCourseUpdate]);

  // =====================================================
  // 小見出し削除
  // =====================================================
  const deleteSection = useCallback((chapterId: string, sectionId: string) => {
    // 確認ダイアログ
    if (!window.confirm('この小見出しを削除しますか？\n※ 削除すると元に戻せません')) {
      return;
    }

    const updatedCourse = {
      ...course,
      chapters: course.chapters.map(ch =>
        ch.id === chapterId
          ? { ...ch, sections: ch.sections.filter(sec => sec.id !== sectionId) }
          : ch
      ),
      updatedAt: new Date()
    };
    onCourseUpdate(updatedCourse);

    // 削除した節が選択中だった場合、選択を解除
    if (activeSectionId === sectionId) {
      setActiveSectionId(null);
      setCurrentBlocks([]);
      setSyncStatus('draft');
    }

    console.log('[SECTION] Deleted section:', sectionId);
  }, [course, onCourseUpdate, activeSectionId]);

  // =====================================================
  // 小見出し編集開始（selectSectionより後で呼ぶ）
  // =====================================================
  const startEditSection = useCallback((sectionId: string) => {
    // 編集モードをセット（UIでフォーカスをトリガー）
    setEditingSectionId(sectionId);
    // 次のレンダリングでフォーカスするため、少し遅延
    setTimeout(() => {
      setEditingSectionId(null);
    }, 100);
    console.log('[SECTION] Start editing:', sectionId);
  }, []);

  // =====================================================
  // 小見出しタイトル更新（目次 ↔ 台本 見出し2 双方向同期）
  // =====================================================
  const updateSectionTitle = useCallback((sectionId: string, newTitle: string) => {
    console.log('[SYNC] Section title updated:', sectionId, newTitle);

    // course内の節タイトルを更新
    const updatedCourse = {
      ...course,
      chapters: course.chapters.map(ch => ({
        ...ch,
        sections: ch.sections.map(sec =>
          sec.id === sectionId ? { ...sec, title: newTitle } : sec
        )
      })),
      updatedAt: new Date()
    };
    onCourseUpdate(updatedCourse);

    // currentBlocksのheading2も同期
    if (activeSectionId === sectionId) {
      setCurrentBlocks(prev =>
        prev.map(block =>
          block.type === 'heading2' && prev.indexOf(block) === prev.findIndex(b => b.type === 'heading2')
            ? { ...block, content: newTitle }
            : block
        )
      );
    }
  }, [course, onCourseUpdate, activeSectionId]);

  // =====================================================
  // 節を選択
  // =====================================================
  const selectSection = useCallback((chapterId: string, sectionId: string) => {
    const chapter = course.chapters.find(c => c.id === chapterId);
    const section = chapter?.sections.find(s => s.id === sectionId);
    if (!section) return;

    setActiveChapterId(chapterId);
    setActiveSectionId(sectionId);
    setCurrentBlocks(section.blocks);
    setSyncStatus(section.syncStatus);
    setSpecialView(null); // 表紙/目次ビューを解除

    if (section.slideData) {
      setSlideData(section.slideData);
    } else {
      setSlideData(convertBlocksToSlide(section.blocks));
    }

    console.log('[SELECT] Section selected:', sectionId);
  }, [course]);

  // =====================================================
  // ブロック内容更新
  // 【修正】heading2判定をblockIdベースに変更 + course即時更新
  // =====================================================
  const handleBlockChange = useCallback((blockId: string, newContent: string) => {
    console.log('[BLOCK_CHANGE] blockId:', blockId, 'newContent:', newContent);

    setCurrentBlocks(prev => {
      const updated = prev.map(block =>
        block.id === blockId ? { ...block, content: newContent } : block
      );

      // heading2の場合、節タイトルも同期
      // 【修正】blockIdでインデックスを取得（参照ではなくID比較）
      const changedBlock = prev.find(b => b.id === blockId);
      const firstHeading2Index = prev.findIndex(b => b.type === 'heading2');
      const changedBlockIndex = prev.findIndex(b => b.id === blockId);
      const isFirstHeading2 = changedBlock?.type === 'heading2' &&
        firstHeading2Index !== -1 &&
        firstHeading2Index === changedBlockIndex;

      console.log('[BLOCK_CHANGE] heading2 check:', { firstHeading2Index, changedBlockIndex, isFirstHeading2 });

      // course側も即時更新（セクション切り替え時にデータが消えないように）
      if (activeSectionId) {
        const newSectionTitle = isFirstHeading2 ? newContent : undefined;

        const updatedCourse = {
          ...course,
          chapters: course.chapters.map(ch => ({
            ...ch,
            sections: ch.sections.map(sec =>
              sec.id === activeSectionId
                ? {
                    ...sec,
                    blocks: updated,
                    ...(newSectionTitle !== undefined && { title: newSectionTitle })
                  }
                : sec
            )
          })),
          updatedAt: new Date()
        };
        console.log('[BLOCK_CHANGE] Updating course, section:', activeSectionId, 'isFirstHeading2:', isFirstHeading2);
        onCourseUpdate(updatedCourse);
      }

      return updated;
    });

    if (syncStatus === 'synced') {
      setSyncStatus('script_ahead');
    }
  }, [syncStatus, activeSectionId, course, onCourseUpdate]);

  // =====================================================
  // ブロック追加
  // 【修正】追加時もcourse側を即時更新
  // =====================================================
  const addBlock = useCallback((type: BlockType = 'bullet') => {
    const newBlock: ScriptBlock = {
      id: `block-${Date.now()}`,
      type,
      content: ''
    };

    setCurrentBlocks(prev => {
      const newBlocks = [...prev, newBlock];

      // course側も即時更新
      if (activeSectionId) {
        const updatedCourse = {
          ...course,
          chapters: course.chapters.map(ch => ({
            ...ch,
            sections: ch.sections.map(sec =>
              sec.id === activeSectionId
                ? { ...sec, blocks: newBlocks }
                : sec
            )
          })),
          updatedAt: new Date()
        };
        console.log('[ADD_BLOCK] Updating course, section:', activeSectionId, 'newBlockCount:', newBlocks.length);
        onCourseUpdate(updatedCourse);
      }

      return newBlocks;
    });

    if (syncStatus === 'synced') {
      setSyncStatus('script_ahead');
    }
  }, [syncStatus, activeSectionId, course, onCourseUpdate]);

  // =====================================================
  // ブロック一括更新（DnD・タイプ変更用）
  // 【修正】currentBlocks変更時にcourse側も即時更新（セクション切替で消えない）
  // =====================================================
  const handleBlocksChange = useCallback((newBlocks: ScriptBlock[]) => {
    console.log('[BLOCKS_CHANGE] Updating blocks, activeSectionId:', activeSectionId, 'count:', newBlocks.length);
    setCurrentBlocks(newBlocks);

    // course側のblocksも即時更新（セクション切り替え時にデータが消えないように）
    if (activeSectionId) {
      // heading2 → 節タイトル同期
      const firstHeading2 = newBlocks.find(b => b.type === 'heading2');
      const newSectionTitle = firstHeading2?.content || '';

      const updatedCourse = {
        ...course,
        chapters: course.chapters.map(ch => ({
          ...ch,
          sections: ch.sections.map(sec =>
            sec.id === activeSectionId
              ? {
                  ...sec,
                  blocks: newBlocks,
                  title: newSectionTitle,  // 節タイトルも同期
                }
              : sec
          )
        })),
        updatedAt: new Date()
      };
      console.log('[BLOCKS_CHANGE] Updating course, section:', activeSectionId, 'newTitle:', newSectionTitle);
      onCourseUpdate(updatedCourse);
    }

    if (syncStatus === 'synced') {
      setSyncStatus('script_ahead');
    }
  }, [syncStatus, activeSectionId, course, onCourseUpdate]);

  // =====================================================
  // スライドに反映
  // =====================================================
  const handleSyncToSlide = useCallback(() => {
    if (!activeSectionId) return;

    console.log('[SYNC_CLICK] Syncing to slide...');
    setIsSyncing(true);

    setTimeout(() => {
      const newSlideData = convertBlocksToSlide(currentBlocks);
      setSlideData(newSlideData);
      setSyncStatus('synced');

      // courseデータも更新
      const updatedCourse = {
        ...course,
        chapters: course.chapters.map(ch => ({
          ...ch,
          sections: ch.sections.map(sec =>
            sec.id === activeSectionId
              ? { ...sec, blocks: currentBlocks, slideData: newSlideData, syncStatus: 'synced' as SyncStatus }
              : sec
          )
        })),
        updatedAt: new Date()
      };
      onCourseUpdate(updatedCourse);

      setIsSyncing(false);
      console.log('[SYNC_CLICK] Sync completed!');
    }, 500);
  }, [activeSectionId, currentBlocks, course, onCourseUpdate]);

  // =====================================================
  // スピーカーノート編集
  // =====================================================
  const startEditingNotes = useCallback(() => {
    setEditingNotesText(slideData.speakerNotes.join('\n'));
    setIsEditingNotes(true);
  }, [slideData.speakerNotes]);

  const saveNotes = useCallback(() => {
    const newNotes = editingNotesText.split('\n').filter(line => line.trim());
    const newSlideData = { ...slideData, speakerNotes: newNotes };
    setSlideData(newSlideData);

    // courseデータも更新
    if (activeSectionId) {
      const updatedCourse = {
        ...course,
        chapters: course.chapters.map(ch => ({
          ...ch,
          sections: ch.sections.map(sec =>
            sec.id === activeSectionId
              ? { ...sec, slideData: newSlideData }
              : sec
          )
        })),
        updatedAt: new Date()
      };
      onCourseUpdate(updatedCourse);
    }

    setIsEditingNotes(false);
    console.log('[NOTES] Saved speaker notes');
  }, [editingNotesText, slideData, activeSectionId, course, onCourseUpdate]);

  const cancelEditingNotes = useCallback(() => {
    setIsEditingNotes(false);
    setEditingNotesText('');
  }, []);

  // =====================================================
  // AIスライド生成（章一括）
  // =====================================================
  const handleGenerateChapterSlides = useCallback(async (chapterId: string) => {
    const chapter = course.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    console.log('[SLIDE_GEN] Starting chapter slide generation:', chapter.title);
    setIsGeneratingSlides(true);
    setSlideGenerationError(null);

    try {
      // セクションコンテンツを構築
      const sectionContents: SectionContent[] = chapter.sections.map(sec => ({
        sectionId: sec.id,
        sectionTitle: sec.title,
        blocks: sec.blocks,
        purposeText: sec.blocks.find(b => b.aiPrompt?.intent)?.aiPrompt?.intent,
        durationMinutes: sec.blocks.find(b => b.aiPrompt?.durationRatio)?.aiPrompt?.durationRatio
          ? Math.round((sec.blocks.find(b => b.aiPrompt?.durationRatio)?.aiPrompt?.durationRatio || 0) * (course.totalDuration || 60))
          : undefined,
      }));

      const slides = await generateChapterSlides({
        courseTitle: course.title,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        sections: sectionContents,
        totalDuration: course.totalDuration,
        generateImages: false,  // 画像生成は別レーンで行う
        templateId: pendingTemplateId,  // 選択中のテンプレートを適用
      });

      console.log('[SLIDE_GEN] Generated', slides.length, 'slides');

      // courseデータを更新（各セクションにスライドを配分）
      const updatedCourse = {
        ...course,
        chapters: course.chapters.map(ch => {
          if (ch.id !== chapterId) return ch;
          return {
            ...ch,
            chapterSlides: {
              chapterId: ch.id,
              slides: slides,
              generatedAt: new Date(),
            },
            sections: ch.sections.map(sec => ({
              ...sec,
              slides: slides.filter(s => s.sectionId === sec.id),
            })),
          };
        }),
        updatedAt: new Date(),
      };
      onCourseUpdate(updatedCourse);

      // 最初のスライドを選択
      setActiveSlideIndex(0);

    } catch (error: any) {
      console.error('[SLIDE_GEN] Error:', error);
      setSlideGenerationError(error.message || 'スライド生成に失敗しました');
    } finally {
      setIsGeneratingSlides(false);
    }
  }, [course, onCourseUpdate, pendingTemplateId]);

  // =====================================================
  // AIスライド生成（節単位再生成）
  // =====================================================
  const handleRegenerateSectionSlides = useCallback(async (sectionId: string) => {
    const chapter = course.chapters.find(ch => ch.sections.some(s => s.id === sectionId));
    const section = chapter?.sections.find(s => s.id === sectionId);
    if (!chapter || !section) return;

    // lockedなスライドがあれば警告
    const lockedSlides = section.slides?.filter(s => s.locked) || [];
    if (lockedSlides.length > 0) {
      if (!window.confirm(`この節には${lockedSlides.length}枚のロックされたスライドがあります。\nロックされていないスライドのみ再生成しますか？`)) {
        return;
      }
    }

    console.log('[SLIDE_GEN] Regenerating section slides:', section.title);
    setIsGeneratingSlides(true);
    setSlideGenerationError(null);

    try {
      const sectionContent: SectionContent = {
        sectionId: section.id,
        sectionTitle: section.title,
        blocks: section.blocks,
        purposeText: section.blocks.find(b => b.aiPrompt?.intent)?.aiPrompt?.intent,
      };

      const newSlides = await generateSectionSlides({
        courseTitle: course.title,
        chapterTitle: chapter.title,
        section: sectionContent,
        totalDuration: course.totalDuration,
        generateImages: false,  // 画像生成は別レーンで行う
        templateId: pendingTemplateId,  // 選択中のテンプレートを適用
      });

      // 既存のlockedスライドは保持、それ以外は新しいスライドに置換
      const lockedExisting = section.slides?.filter(s => s.locked) || [];
      const mergedSlides = [...lockedExisting, ...newSlides.map(s => ({ ...s, order: lockedExisting.length + s.order }))];

      // courseデータを更新
      const updatedCourse = {
        ...course,
        chapters: course.chapters.map(ch => ({
          ...ch,
          sections: ch.sections.map(sec =>
            sec.id === sectionId
              ? { ...sec, slides: mergedSlides }
              : sec
          ),
        })),
        updatedAt: new Date(),
      };
      onCourseUpdate(updatedCourse);

    } catch (error: any) {
      console.error('[SLIDE_GEN] Error:', error);
      setSlideGenerationError(error.message || '再生成に失敗しました');
    } finally {
      setIsGeneratingSlides(false);
    }
  }, [course, onCourseUpdate, pendingTemplateId]);

  // =====================================================
  // 画像単体生成（スライドテキストとは独立）
  // =====================================================
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Visual Promptを指定して画像生成
  // contextMode: 'decorative'（デフォルト）または 'contextual'（文脈可視化）
  const handleGenerateSlideImage = useCallback(async (
    slideId: string,
    customVisualPrompt?: string,
    contextMode: 'decorative' | 'contextual' = 'decorative'
  ) => {
    if (!activeSectionId) return;

    // 対象スライドを取得
    const section = activeChapter?.sections.find(s => s.id === activeSectionId);
    const slide = section?.slides?.find(s => s.slideId === slideId);
    if (!slide) return;

    console.log('[IMAGE_GEN] Generating image for slide:', slide.title);
    console.log('[IMAGE_GEN] ContextMode:', contextMode);
    setIsGeneratingImage(true);

    try {
      // カスタムプロンプト > スライドのvisualPrompt > imageIntent > 自動生成 > デフォルト
      const visualPrompt = customVisualPrompt ||
        slide.visualPrompt ||
        slide.imageIntent ||
        generateVisualPromptFromContent(slide.title, slide.bullets, slide.speakerNotes);

      console.log('[IMAGE_GEN] Using visualPrompt:', visualPrompt);

      // リクエストボディ作成
      const requestBody: {
        slideId: string;
        sectionId: string;
        visualPrompt: string;
        contextMode?: 'decorative' | 'contextual';
        slideTitle?: string;
        slideBullets?: string[];
      } = {
        slideId: slide.slideId,
        sectionId: activeSectionId,
        visualPrompt,
      };

      // contextualモードの場合、スライド本文も送信
      if (contextMode === 'contextual') {
        requestBody.contextMode = 'contextual';
        requestBody.slideTitle = slide.title;
        requestBody.slideBullets = slide.bullets;
        console.log('[IMAGE_GEN] Sending contextual data:', {
          title: slide.title,
          bullets: slide.bullets,
        });
      }

      const response = await fetch('/api/generate-slide-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      console.log('[IMAGE_GEN] Result:', result.imageStatus);

      // 履歴に追加（成功時のみ、重複チェック）
      const currentHistory = slide.visualPromptHistory || [];
      const newHistory = currentHistory.includes(visualPrompt)
        ? currentHistory
        : [...currentHistory, visualPrompt].slice(-10); // 最大10件

      // スライドを更新
      const updatedCourse = {
        ...course,
        chapters: course.chapters.map(ch => ({
          ...ch,
          sections: ch.sections.map(sec =>
            sec.id === activeSectionId
              ? {
                  ...sec,
                  slides: sec.slides?.map(s =>
                    s.slideId === slideId
                      ? {
                          ...s,
                          visualPrompt,
                          visualPromptHistory: result.imageStatus === 'success' ? newHistory : s.visualPromptHistory,
                          imageStatus: result.imageStatus,
                          imageBase64: result.imageBase64,
                          imageMimeType: result.imageMimeType,
                          imageErrorMessage: result.errorMessage,
                        }
                      : s
                  ),
                }
              : sec
          ),
        })),
        updatedAt: new Date(),
      };
      onCourseUpdate(updatedCourse);

      // 編集モードをリセット
      setIsEditingVisualPrompt(false);
      setEditingVisualPrompt('');

      if (result.imageStatus !== 'success') {
        console.error('[IMAGE_GEN] Failed:', result.errorMessage);
      }

    } catch (error: any) {
      console.error('[IMAGE_GEN] Error:', error);
    } finally {
      setIsGeneratingImage(false);
    }
  }, [activeSectionId, activeChapter, course, onCourseUpdate]);

  // Visual Promptを編集開始
  const handleStartEditingVisualPrompt = useCallback((slide: Slide) => {
    // 現在のプロンプトまたは自動生成プロンプトをセット
    // 優先順位: 既存のvisualPrompt > imageIntent > スライド内容から自動生成
    const currentPrompt = slide.visualPrompt ||
      slide.imageIntent ||
      generateVisualPromptFromContent(slide.title, slide.bullets, slide.speakerNotes);
    setEditingVisualPrompt(currentPrompt);
    setIsEditingVisualPrompt(true);
    setShowPromptHistory(false);
  }, []);

  // Visual Promptを履歴から選択
  const handleSelectPromptFromHistory = useCallback((prompt: string) => {
    setEditingVisualPrompt(prompt);
    setShowPromptHistory(false);
  }, []);

  // =====================================================
  // テンプレート変更処理
  // =====================================================

  // スライドのテンプレートを変更
  const handleTemplateChange = useCallback((slideId: string, templateId: BaseTemplateId) => {
    console.log('[handleTemplateChange] slideId:', slideId, 'templateId:', templateId);
    if (!activeSectionId) return;

    const updatedCourse = {
      ...course,
      chapters: course.chapters.map(ch => ({
        ...ch,
        sections: ch.sections.map(sec =>
          sec.id === activeSectionId
            ? {
                ...sec,
                slides: sec.slides?.map(s =>
                  s.slideId === slideId
                    ? { ...s, templateId, updatedAt: new Date() }
                    : s
                ),
              }
            : sec
        ),
      })),
      updatedAt: new Date(),
    };
    onCourseUpdate(updatedCourse);
  }, [activeSectionId, course, onCourseUpdate]);

  // 全スライドにテンプレートを適用
  const handleApplyTemplateToAll = useCallback((templateId: BaseTemplateId) => {
    if (!activeSectionId || !currentSlides) return;

    const updatedCourse = {
      ...course,
      chapters: course.chapters.map(ch => ({
        ...ch,
        sections: ch.sections.map(sec =>
          sec.id === activeSectionId
            ? {
                ...sec,
                slides: sec.slides?.map(s => ({
                  ...s,
                  templateId,
                  updatedAt: new Date(),
                })),
              }
            : sec
        ),
      })),
      updatedAt: new Date(),
    };
    onCourseUpdate(updatedCourse);
  }, [activeSectionId, currentSlides, course, onCourseUpdate]);

  // =====================================================
  // 画像アップロード処理
  // =====================================================
  const handleImageUpload = useCallback(async (slideId: string, file: File) => {
    if (!activeSectionId) return;

    // 画像ファイルのみ許可
    if (!file.type.startsWith('image/')) {
      console.error('[IMAGE_UPLOAD] Invalid file type:', file.type);
      return;
    }

    // ファイルサイズ制限 (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      console.error('[IMAGE_UPLOAD] File too large:', file.size);
      alert('ファイルサイズは10MB以下にしてください');
      return;
    }

    console.log('[IMAGE_UPLOAD] Processing file:', file.name, file.type);

    try {
      // FileをBase64に変換
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (!base64) return;

        // data:image/png;base64,xxxx の形式からbase64部分を抽出
        const base64Data = base64.split(',')[1] || base64;

        // SlideVisualオブジェクトを作成
        const newVisual: SlideVisual = {
          type: 'uploaded',
          src: base64Data,
          mimeType: file.type,
          uploadedFileName: file.name,
        };

        // スライドを更新
        const updatedCourse = {
          ...course,
          chapters: course.chapters.map(ch => ({
            ...ch,
            sections: ch.sections.map(sec =>
              sec.id === activeSectionId
                ? {
                    ...sec,
                    slides: sec.slides?.map(s =>
                      s.slideId === slideId
                        ? {
                            ...s,
                            visual: newVisual,
                            // レガシーフィールドもクリア（混乱防止）
                            imageBase64: undefined,
                            imageMimeType: undefined,
                            imageStatus: 'success' as const,
                            imageErrorMessage: undefined,
                          }
                        : s
                    ),
                  }
                : sec
            ),
          })),
          updatedAt: new Date(),
        };
        onCourseUpdate(updatedCourse);
        console.log('[IMAGE_UPLOAD] Success:', file.name);
      };

      reader.onerror = () => {
        console.error('[IMAGE_UPLOAD] FileReader error');
        alert('画像の読み込みに失敗しました');
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[IMAGE_UPLOAD] Error:', error);
      alert('画像のアップロードに失敗しました');
    }
  }, [activeSectionId, course, onCourseUpdate]);

  // アップロードボタンクリック時
  const handleImageUploadClick = useCallback((slideId: string) => {
    // hidden inputにslideIdを設定してクリック
    if (imageUploadInputRef.current) {
      imageUploadInputRef.current.dataset.slideId = slideId;
      imageUploadInputRef.current.click();
    }
  }, []);

  // input[type=file]のonChange
  const handleImageFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const slideId = e.target.dataset.slideId;
    if (file && slideId) {
      handleImageUpload(slideId, file);
    }
    // inputをリセット（同じファイルを再選択可能にする）
    e.target.value = '';
  }, [handleImageUpload]);

  // 画像を削除（noneに戻す）
  const handleImageRemove = useCallback((slideId: string) => {
    if (!activeSectionId) return;

    const newVisual: SlideVisual = { type: 'none' };

    const updatedCourse = {
      ...course,
      chapters: course.chapters.map(ch => ({
        ...ch,
        sections: ch.sections.map(sec =>
          sec.id === activeSectionId
            ? {
                ...sec,
                slides: sec.slides?.map(s =>
                  s.slideId === slideId
                    ? {
                        ...s,
                        visual: newVisual,
                        imageBase64: undefined,
                        imageMimeType: undefined,
                        imageStatus: undefined,
                      }
                    : s
                ),
              }
            : sec
        ),
      })),
      updatedAt: new Date(),
    };
    onCourseUpdate(updatedCourse);
  }, [activeSectionId, course, onCourseUpdate]);

  // スライドから表示する画像ソースを取得（新visual優先、レガシー互換）
  const getSlideImageSrc = useCallback((slide: Slide): string | null => {
    // 新しいvisualオブジェクトがある場合
    if (slide.visual && slide.visual.type !== 'none' && slide.visual.src) {
      const mimeType = slide.visual.mimeType || 'image/png';
      return `data:${mimeType};base64,${slide.visual.src}`;
    }
    // レガシー: imageBase64がある場合
    if (slide.imageBase64) {
      const mimeType = slide.imageMimeType || 'image/png';
      return `data:${mimeType};base64,${slide.imageBase64}`;
    }
    return null;
  }, []);

  // 画像があるかどうか判定
  const hasSlideImage = useCallback((slide: Slide): boolean => {
    // 新しいvisualオブジェクトがある場合
    if (slide.visual && slide.visual.type !== 'none' && slide.visual.src) {
      return true;
    }
    // レガシー: imageBase64がある場合（成功時のみ）
    if (slide.imageStatus === 'success' && slide.imageBase64) {
      return true;
    }
    return false;
  }, []);

  // =====================================================
  // スライド編集（タイトル/箇条書き/ノート）
  // 編集ボタンを押したら中央のSlideContentEditorにスクロール
  // =====================================================
  const handleSlideEdit = useCallback((slide: Slide) => {
    // 選択スライドを設定
    setActiveSlideIndex(currentSlides?.findIndex(s => s.slideId === slide.slideId) ?? 0);
    // 中央のスライド編集エリアにスクロール
    setTimeout(() => {
      slideContentEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [currentSlides]);

  const handleSaveSlideEdit = useCallback(() => {
    if (!editingSlideData || !activeSectionId) return;

    const updatedSlide: Slide = {
      ...editingSlideData,
      editedByUser: true,
      updatedAt: new Date(),
    };

    // courseデータを更新
    const updatedCourse = {
      ...course,
      chapters: course.chapters.map(ch => ({
        ...ch,
        sections: ch.sections.map(sec =>
          sec.id === activeSectionId
            ? {
                ...sec,
                slides: sec.slides?.map(s =>
                  s.slideId === updatedSlide.slideId ? updatedSlide : s
                ),
              }
            : sec
        ),
      })),
      updatedAt: new Date(),
    };
    onCourseUpdate(updatedCourse);

    setIsEditingSlide(false);
    setEditingSlideData(null);
  }, [editingSlideData, activeSectionId, course, onCourseUpdate]);

  // インラインスライド編集（モーダルなしで直接更新）
  const handleInlineSlideUpdate = useCallback((updatedSlide: Slide) => {
    if (!activeSectionId) return;

    // courseデータを更新
    const updatedCourse = {
      ...course,
      chapters: course.chapters.map(ch => ({
        ...ch,
        sections: ch.sections.map(sec =>
          sec.id === activeSectionId
            ? {
                ...sec,
                slides: sec.slides?.map(s =>
                  s.slideId === updatedSlide.slideId ? updatedSlide : s
                ),
              }
            : sec
        ),
      })),
      updatedAt: new Date(),
    };
    onCourseUpdate(updatedCourse);
  }, [activeSectionId, course, onCourseUpdate]);

  const handleToggleSlideLock = useCallback((slideId: string) => {
    if (!activeSectionId) return;

    const updatedCourse = {
      ...course,
      chapters: course.chapters.map(ch => ({
        ...ch,
        sections: ch.sections.map(sec =>
          sec.id === activeSectionId
            ? {
                ...sec,
                slides: sec.slides?.map(s =>
                  s.slideId === slideId
                    ? { ...s, locked: !s.locked, updatedAt: new Date() }
                    : s
                ),
              }
            : sec
        ),
      })),
      updatedAt: new Date(),
    };
    onCourseUpdate(updatedCourse);
  }, [activeSectionId, course, onCourseUpdate]);

  // =====================================================
  // AI叩き台生成
  // =====================================================
  const openDraftModal = useCallback((sectionId: string, sectionTitle: string, chapterTitle: string) => {
    console.log('[MODAL_OPEN]', { sectionId, sectionTitle, chapterTitle, showDraftModal: true });
    setDraftTargetSection({ sectionId, sectionTitle, chapterTitle });
    setShowDraftModal(true);
  }, []);

  // 新モーダルからの台本生成完了ハンドラ
  const handleScriptGenerated = useCallback((result: {
    blocks: ScriptBlock[];
    slideData: SlideData;
  }) => {
    console.log('[AI_SCRIPT] Script generated!', result);

    // 中央エディタに台本ブロックを反映
    setCurrentBlocks(result.blocks);

    // 右のスライドプレビューを更新
    setSlideData(result.slideData);

    // ステータス更新
    setSyncStatus('draft_generated');

    // courseデータも更新
    if (activeSectionId) {
      const updatedCourse = {
        ...course,
        chapters: course.chapters.map(ch => ({
          ...ch,
          sections: ch.sections.map(sec =>
            sec.id === activeSectionId
              ? {
                  ...sec,
                  blocks: result.blocks,
                  slideData: result.slideData,
                  syncStatus: 'draft_generated' as SyncStatus
                }
              : sec
          )
        })),
        updatedAt: new Date()
      };
      onCourseUpdate(updatedCourse);
    }

    // モーダルを閉じる
    setShowDraftModal(false);
    setDraftTargetSection(null);

    // 台本生成完了ガイドを表示（③④対応）
    setShowScriptCompletedGuide(true);

    // 生成後、台本セクションへスクロール誘導
    setTimeout(() => {
      scriptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [activeSectionId, course, onCourseUpdate]);

  // =====================================================
  // レンダリング
  // =====================================================
  return (
    <div className="flex flex-col h-screen bg-[#F9FAFB] text-slate-900 overflow-hidden">
      {/* 🔴 開発用ビルドバッジ - 反映確認用 */}
      <div
        className="fixed top-2 right-2 z-[9999] px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full shadow-lg"
        style={{ pointerEvents: 'none' }}
      >
        BUILD: 2026-01-31-1130
      </div>

      {/* ヘッダー */}
      <header className="h-14 border-b bg-white flex items-center justify-between px-4 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-[#2563EB] p-1.5 rounded-lg">
            <Layout className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-800">
              {course.title}
            </span>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border rounded-full">
              <Cloud className="w-4 h-4 text-slate-400" />
              <span className="text-[11px] text-slate-500 font-medium">保存済み</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              showHelp ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            使い方
          </button>
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
        {/* 左サイドバー：目次 */}
        <aside className="w-64 border-r bg-white flex flex-col shrink-0">
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
            {/* 表紙・目次（固定） */}
            <div className="mb-4 space-y-1">
              {/* 表紙ボタン + 仕上がり確認導線 */}
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setSpecialView('cover');
                    setActiveSectionId(null);
                  }}
                  className={`
                    w-full flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors
                    ${specialView === 'cover' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}
                  `}
                >
                  <BookOpen className={`w-4 h-4 ${specialView === 'cover' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-sm font-medium">表紙</span>
                  {/* スライド生成済み数を表示 */}
                  {(() => {
                    const totalSlides = course.chapters.reduce((acc, ch) => acc + ch.sections.reduce((a, s) => a + (s.slides?.length || 0), 0), 0);
                    return totalSlides > 0 ? (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        {totalSlides}枚
                      </span>
                    ) : null;
                  })()}
                </button>
                {/* 仕上がり確認デッキへの導線（スライドが生成されている場合のみ表示） */}
                {course.chapters.reduce((acc, ch) => acc + ch.sections.reduce((a, s) => a + (s.slides?.length || 0), 0), 0) > 0 && (
                  <button
                    onClick={() => {
                      setSpecialView('cover');
                      setActiveSectionId(null);
                      // 少し遅延してからデッキモーダルを開く
                      setTimeout(() => setShowDeckModal(true), 100);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 ml-2 text-[10px] text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    <span className="font-medium">🎬 仕上がり確認デッキ</span>
                    <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setSpecialView('toc');
                  setActiveSectionId(null);
                }}
                className={`
                  w-full flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors
                  ${specialView === 'toc' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}
                `}
              >
                <List className={`w-4 h-4 ${specialView === 'toc' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-sm font-medium">目次</span>
              </button>
              <div className="h-px bg-slate-200 my-2" />
            </div>

            {course.chapters.map((chapter, chapterIndex) => (
              <div key={chapter.id} className="mb-4">
                {/* 章タイトル（編集可能・双方向同期） */}
                <div className="flex items-center gap-1 px-2 py-1">
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                  <input
                    value={chapter.title}
                    onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                    className="flex-1 text-xs font-bold text-slate-600 bg-transparent border-none outline-none focus:bg-blue-50 rounded px-1"
                    placeholder={`第${chapterIndex + 1}章`}
                  />
                  {/* 章の生成済みステータス */}
                  {(() => {
                    const totalSlides = chapter.sections.reduce((acc, sec) => acc + (sec.slides?.length || 0), 0);
                    const sectionsWithSlides = chapter.sections.filter(sec => sec.slides && sec.slides.length > 0).length;
                    if (totalSlides > 0) {
                      return (
                        <span className="flex-shrink-0 text-[8px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                          {sectionsWithSlides}/{chapter.sections.length}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                {/* 章一括AIスライド生成ボタン */}
                <button
                  onClick={() => handleGenerateChapterSlides(chapter.id)}
                  disabled={isGeneratingSlides || chapter.sections.length === 0}
                  className={`
                    w-full flex items-center justify-center gap-1.5 px-2 py-1.5 mx-2 mb-1 rounded-md text-[10px] font-medium transition-all
                    ${isGeneratingSlides
                      ? 'bg-purple-100 text-purple-400 cursor-wait'
                      : chapter.sections.length === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600 shadow-sm'
                    }
                  `}
                  style={{ width: 'calc(100% - 16px)' }}
                  title="AIでスライドを自動生成します"
                >
                  {isGeneratingSlides && activeChapterId === chapter.id ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" />
                      AIスライド作成 / 反映（章一括）
                    </>
                  )}
                </button>
                {/* 節一覧 */}
                <div className="mt-1 space-y-0.5">
                  {chapter.sections.map(section => (
                    <div
                      key={section.id}
                      onClick={() => selectSection(chapter.id, section.id)}
                      onDoubleClick={() => openDraftModal(section.id, section.title, chapter.title)}
                      className={`
                        flex items-center justify-between px-2 py-2 rounded-md cursor-pointer transition-colors group
                        ${activeSectionId === section.id ? 'bg-blue-50 text-[#2563EB]' : 'hover:bg-slate-50 text-slate-600'}
                      `}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Type className={`w-4 h-4 shrink-0 ${activeSectionId === section.id ? 'text-[#2563EB]' : 'text-slate-400'}`} />
                        <span className={`text-sm truncate leading-tight ${!section.title ? 'text-slate-400 italic' : ''}`}>
                          {section.title || '見出しを入力...'}
                        </span>
                        {/* スライド生成済みバッジ */}
                        {section.slides && section.slides.length > 0 && (
                          <span className="flex-shrink-0 text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                            {section.slides.length}枚
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDraftModal(section.id, section.title, chapter.title);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-purple-100 rounded"
                          title="AIで台本の叩き台を生成"
                        >
                          <Sparkles className="w-3 h-3 text-purple-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerateSectionSlides(section.id);
                          }}
                          disabled={isGeneratingSlides}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-purple-100 rounded"
                          title="スライドを再生成"
                        >
                          <RefreshCw className={`w-3 h-3 text-indigo-500 ${isGeneratingSlides ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="opacity-0 group-hover:opacity-100">
                          <BlockMenu
                            onEdit={() => {
                              selectSection(chapter.id, section.id);
                              startEditSection(section.id);
                            }}
                            onDelete={() => deleteSection(chapter.id, section.id)}
                          />
                        </div>
                        <StatusIcon status={section.syncStatus} />
                      </div>
                    </div>
                  ))}
                  {/* 小見出し追加ボタン（セクションがない場合は強調表示） */}
                  <button
                    onClick={() => addSection(chapter.id)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-all rounded-lg
                      ${hasNoSections
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold shadow-lg shadow-blue-200 hover:from-blue-600 hover:to-indigo-600 animate-pulse'
                        : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 text-xs'}
                    `}
                  >
                    <Plus className={hasNoSections ? "w-4 h-4" : "w-3 h-3"} />
                    {hasNoSections ? '＋ ここをクリックしてスタート' : '小見出しを追加'}
                  </button>
                  {/* 初期状態のガイドメッセージ */}
                  {hasNoSections && chapter.id === course.chapters[0]?.id && (
                    <p className="text-xs text-blue-600 mt-2 px-2 font-medium text-center">
                      👆 まずはここをクリックしてください
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* 章追加ボタン（常設） */}
            <div className="mt-2 px-2 pb-2">
              <div className="h-px bg-slate-200 mb-2" />
              <button
                onClick={addChapter}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all border border-dashed border-slate-300 hover:border-blue-400"
              >
                <Plus className="w-4 h-4" />
                章を追加
              </button>
            </div>
          </div>
        </aside>

        {/* 中央：台本エディタ */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          {activeSectionId ? (
            <>
              {/* 台本ヘッダー */}
              <div className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>{activeChapter?.title}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-slate-900 font-medium">{activeSection?.title}</span>
                  <SyncStatusBadge status={syncStatus} />
                </div>
                <div className="flex items-center gap-2">
                  {/* AIスライド作成/反映（統合ボタン） */}
                  <button
                    onClick={() => {
                      if (activeSectionId) {
                        // まず同期してからスライド生成
                        handleSyncToSlide();
                        handleRegenerateSectionSlides(activeSectionId);
                      }
                    }}
                    disabled={isGeneratingSlides || isSyncing}
                    className={`
                      flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition-all shadow-md
                      ${isGeneratingSlides || isSyncing
                        ? 'bg-purple-100 text-purple-400 cursor-wait'
                        : 'bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700 active:scale-95 shadow-lg shadow-purple-200/50'}
                    `}
                    title="AIでスライドを自動生成します"
                  >
                    {isGeneratingSlides || isSyncing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {isGeneratingSlides ? '生成中...' : isSyncing ? '反映中...' : 'AIスライド作成 / 反映'}
                  </button>
                </div>
              </div>

              {/* エディタ本体 */}
              <div ref={scriptSectionRef} className="flex-1 overflow-y-auto">
                <div className="px-8 py-6 max-w-3xl mx-auto w-full space-y-6">
                  {/* ===== 上部: スライド編集エリア（最終反映） ===== */}
                  <div ref={slideContentEditorRef}>
                    {currentSlides && currentSlides.length > 0 && activeSlide && (
                      <SlideContentEditor
                        slide={activeSlide}
                        onSlideUpdate={handleInlineSlideUpdate}
                        disabled={isGeneratingSlides}
                        templateId={currentTemplateId}
                      />
                    )}
                  </div>

                  {/* 操作手順ナビゲーション（常に表示） */}
                  <div className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-xs font-bold text-slate-700 mb-3">📋 操作手順</p>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded shrink-0">1</span>
                        <span className="text-slate-600">右パネルの5つのテンプレートから選びましょう</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded shrink-0">2</span>
                        <span className="text-slate-600">台本の叩き台を作成しましょう（下の「叩き台作成」ボタン）</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded shrink-0">3</span>
                        <span className="text-slate-600">伝えたい内容を自由に入力しましょう</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded shrink-0">4</span>
                        <span className="text-slate-600">AIスライド生成 → 表示形式・画像を調整</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded shrink-0">5</span>
                        <span className="text-slate-600">表紙デッキに戻って全体を確認</span>
                      </div>
                    </div>
                  </div>

                  {/* ===== 区切り ===== */}
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-3 text-xs text-slate-400 font-medium">
                        台本・メモ（スライドには反映されません）
                      </span>
                    </div>
                  </div>

                  {/* ===== AI台本生成ボタン（Step2 - 最上部で目立つ位置） ===== */}
                  {activeSection && activeChapter && (
                    <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border-2 border-purple-300 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold text-white bg-purple-500 px-2 py-0.5 rounded">Step 2</span>
                        <span className="text-xs font-bold text-purple-700">AIで台本の叩き台を自動生成</span>
                      </div>
                      <button
                        data-testid="draft-ai-button"
                        onClick={() => {
                          console.log('[AI_BUTTON_CLICKED]', activeSection.id);
                          openDraftModal(activeSection.id, activeSection.title, activeChapter.title);
                        }}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white text-sm font-bold cursor-pointer transition-all rounded-lg shadow-lg shadow-purple-200/50 flex items-center justify-center gap-2"
                        title="AIで台本の叩き台を自動生成します"
                      >
                        <Sparkles className="w-4 h-4" />
                        台本の叩き台を作成（AI）
                      </button>
                      <p className="text-[10px] text-purple-500 text-center mt-2">
                        骨子をもとにAIが話す内容を提案します
                      </p>
                    </div>
                  )}

                  {/* ===== 台本生成完了後の誘導ガイド（③④対応） ===== */}
                  {showScriptCompletedGuide && currentBlocks.length > 0 && (
                    <div
                      ref={scriptSectionRef}
                      className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-400 p-4 animate-pulse-once"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">✅</span>
                          <span className="text-sm font-bold text-green-700">台本の叩き台が生成されました！</span>
                        </div>
                        <button
                          onClick={() => setShowScriptCompletedGuide(false)}
                          className="text-green-600 hover:text-green-800 text-xs"
                        >
                          閉じる
                        </button>
                      </div>
                      <div className="bg-white rounded-lg p-3 mb-3 border border-green-200">
                        <p className="text-xs text-slate-600 mb-2">
                          下記の骨子＆台本エリアで内容を確認・編集してください。
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium">💡 ヒント:</span>
                          <span>不要な箇条書きを削除したり、表現を調整できます</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-white bg-indigo-500 px-2 py-0.5 rounded">次のステップ</span>
                          <span className="text-xs font-medium text-indigo-700">内容を確認したら「AIスライド作成 / 反映」でスライドを生成</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-indigo-500" />
                      </div>
                    </div>
                  )}

                  {/* ===== 下部: 骨子＆台本エリア（折りたたみ可能） ===== */}
                  <div className={`rounded-lg border p-4 transition-all ${
                    showScriptCompletedGuide && currentBlocks.length > 0
                      ? 'bg-green-50/30 border-green-300 ring-2 ring-green-200'
                      : 'bg-slate-50/50 border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-bold text-slate-700">骨子＆台本</span>
                      {showScriptCompletedGuide && currentBlocks.length > 0 && (
                        <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium animate-pulse">
                          👇 生成済み - 確認・編集してください
                        </span>
                      )}
                      {!showScriptCompletedGuide && (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full">
                          折りたたみ可能
                        </span>
                      )}
                    </div>
                    <ScriptBlockEditor
                      blocks={currentBlocks}
                      syncStatus={syncStatus}
                      onBlocksChange={handleBlocksChange}
                      onAddBlock={addBlock}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : specialView === 'cover' ? (
            /* 表紙編集UI */
            <div className="flex-1 overflow-y-auto">
              <div className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-3 text-sm font-bold text-indigo-700">
                  <BookOpen className="w-5 h-5" />
                  表紙設定
                </div>
              </div>
              <div className="p-8 max-w-2xl mx-auto space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">講座タイトル</label>
                  <input
                    type="text"
                    value={coverSettings.title || course.title}
                    onChange={(e) => setCoverSettings({ ...coverSettings, title: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="講座タイトルを入力"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">サブタイトル（任意）</label>
                  <input
                    type="text"
                    value={coverSettings.subtitle}
                    onChange={(e) => setCoverSettings({ ...coverSettings, subtitle: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="サブタイトル（任意）"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">作成者名（任意）</label>
                  <input
                    type="text"
                    value={coverSettings.author}
                    onChange={(e) => setCoverSettings({ ...coverSettings, author: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="作成者名"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                  <div>
                    <p className="font-medium text-slate-800">目次スライドを含める</p>
                    <p className="text-xs text-slate-500">一括作成時に目次ページを追加します</p>
                  </div>
                  <button
                    onClick={() => setCoverSettings({ ...coverSettings, showToc: !coverSettings.showToc })}
                    className={`
                      w-12 h-6 rounded-full transition-colors relative
                      ${coverSettings.showToc ? 'bg-indigo-600' : 'bg-slate-300'}
                    `}
                  >
                    <span
                      className={`
                        absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                        ${coverSettings.showToc ? 'translate-x-7' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-slate-700 mb-3">生成済みスライド統計</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-700">
                        {course.chapters.reduce((acc, ch) => acc + ch.sections.filter(s => s.slides && s.slides.length > 0).length, 0)}
                      </p>
                      <p className="text-xs text-blue-600">生成済み小見出し</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-700">
                        {course.chapters.reduce((acc, ch) => acc + ch.sections.reduce((a, s) => a + (s.slides?.length || 0), 0), 0)}
                      </p>
                      <p className="text-xs text-green-600">総スライド数</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-700">
                        {course.chapters.reduce((acc, ch) => acc + ch.sections.reduce((a, s) => a + (s.slides?.filter(sl => sl.imageStatus === 'success').length || 0), 0), 0)}
                      </p>
                      <p className="text-xs text-purple-600">画像生成済み</p>
                    </div>
                  </div>
                </div>

                {/* デッキ一括作成ボタン */}
                <div className="pt-6 border-t mt-6">
                  <button
                    onClick={() => setShowDeckModal(true)}
                    disabled={course.chapters.reduce((acc, ch) => acc + ch.sections.reduce((a, s) => a + (s.slides?.length || 0), 0), 0) === 0}
                    className={`
                      w-full flex items-center justify-center gap-2 px-6 py-4 rounded-lg text-lg font-bold transition-all
                      ${course.chapters.reduce((acc, ch) => acc + ch.sections.reduce((a, s) => a + (s.slides?.length || 0), 0), 0) > 0
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }
                    `}
                  >
                    <BookOpen className="w-6 h-6" />
                    完成デッキを作成・プレビュー
                  </button>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    表紙 {coverSettings.showToc ? '+ 目次 ' : ''}+ 全スライドを1つのデッキにまとめます
                  </p>
                </div>

                {/* NotebookLM 連携セクション (開発者モード限定) */}
                {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
                <div className="pt-6 border-t mt-6">
                  <p className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    NotebookLM 連携
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">DEV</span>
                  </p>

                  {/* ① NotebookLMへソース送信 */}
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg mb-4">
                    <p className="text-xs text-indigo-700 mb-3 font-medium">
                      ① 本アプリの内容をNotebookLMに送信
                    </p>
                    <p className="text-xs text-indigo-600 mb-3">
                      講座データをNotebookLM投入用フォーマットに変換してクリップボードにコピーします。
                      その後、NotebookLMを開いてソースとして追加してください。
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const sourceText = courseToNotebookLMText(course);
                          await navigator.clipboard.writeText(sourceText);
                          alert('NotebookLM用ソーステキストをクリップボードにコピーしました！\n\nNotebookLMで「+ ソースを追加」→「コピーしたテキスト」から貼り付けてください。');
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        ソースをコピー
                      </button>
                      <button
                        onClick={() => window.open(NOTEBOOKLM_NOTEBOOK_URL, '_blank')}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm font-medium transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        NotebookLM
                      </button>
                    </div>
                  </div>

                  {/* ② NotebookLMからPDF/ZIPインポート */}
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 mb-3 font-medium">
                      ② NotebookLMから完成スライドを取り込み
                    </p>
                    <p className="text-xs text-amber-600 mb-3">
                      NotebookLMでスライドを生成後、ダウンロードした<strong>PDF</strong>をそのままアップロードできます。
                      （ZIPファイルも対応）
                    </p>
                    <input
                      ref={slideFileInputRef}
                      type="file"
                      accept=".pdf,.zip"
                      onChange={handleSlideFileImport}
                      className="hidden"
                    />
                    <button
                      onClick={() => slideFileInputRef.current?.click()}
                      disabled={isImportingSlides}
                      className={`
                        w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                        ${isImportingSlides
                          ? 'bg-slate-200 text-slate-400 cursor-wait'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'}
                      `}
                    >
                      <Upload className="w-4 h-4" />
                      {isImportingSlides ? '変換・インポート中...' : 'PDF / ZIP を選択'}
                    </button>
                    {importError && (
                      <p className="text-xs text-red-600 mt-2 text-center">
                        エラー: {importError}
                      </p>
                    )}
                  </div>
                </div>
                )}

                {/* 一括ダウンロードセクション */}
                <div className="pt-6 border-t mt-6">
                  <p className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-2">
                    <FileDown className="w-4 h-4" />
                    一括ダウンロード
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {/* 通常形式（16:9スライド）— ZIP一括 */}
                    <button
                      onClick={async () => {
                        const allSlides: { slide: Slide; chapterTitle?: string; sectionTitle?: string }[] = [];
                        course.chapters.forEach(ch => {
                          ch.sections.forEach(sec => {
                            if (sec.slides) {
                              sec.slides.forEach(slide => {
                                allSlides.push({ slide, chapterTitle: ch.title, sectionTitle: sec.title });
                              });
                            }
                          });
                        });
                        if (allSlides.length === 0) return;
                        await exportAllPagesAsZip(allSlides, 'normal', course.title);
                      }}
                      disabled={course.chapters.reduce((acc, ch) => acc + ch.sections.reduce((a, s) => a + (s.slides?.length || 0), 0), 0) === 0}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-4 h-4" />
                      スライド一括保存（16:9 ZIP）
                    </button>

                    {/* ノート形式（A4縦）— ZIP一括 */}
                    <button
                      onClick={async () => {
                        const allSlides: { slide: Slide; chapterTitle?: string; sectionTitle?: string }[] = [];
                        course.chapters.forEach(ch => {
                          ch.sections.forEach(sec => {
                            if (sec.slides) {
                              sec.slides.forEach(slide => {
                                allSlides.push({ slide, chapterTitle: ch.title, sectionTitle: sec.title });
                              });
                            }
                          });
                        });
                        if (allSlides.length === 0) return;
                        await exportAllPagesAsZip(allSlides, 'note', course.title);
                      }}
                      disabled={course.chapters.reduce((acc, ch) => acc + ch.sections.reduce((a, s) => a + (s.slides?.length || 0), 0), 0) === 0}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Printer className="w-4 h-4" />
                      ノート形式で保存（A4縦 ZIP）
                    </button>

                    {/* 台本のみ（A4縦） - 中央エディタの長文台本を出力 — ZIP一括 */}
                    <button
                      onClick={async () => {
                        // 全セクションの台本データを収集（スピーカーノートではなく、実際の台本ブロック）
                        const allScripts: SectionScriptData[] = [];
                        course.chapters.forEach(ch => {
                          ch.sections.forEach(sec => {
                            // セクションにブロック（台本）があれば追加
                            if (sec.blocks && sec.blocks.length > 0) {
                              allScripts.push({
                                chapterTitle: ch.title,
                                sectionTitle: sec.title,
                                blocks: sec.blocks,
                              });
                            }
                          });
                        });
                        if (allScripts.length === 0) {
                          alert('台本が入力されているセクションがありません。');
                          return;
                        }
                        await exportAllScriptsAsZip(allScripts, course.title);
                      }}
                      disabled={course.chapters.reduce((acc, ch) => acc + ch.sections.reduce((a, s) => a + (s.blocks?.length || 0), 0), 0) === 0}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FileText className="w-4 h-4" />
                      台本のみ保存（A4縦 ZIP）
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    スライド・ノート形式はスライドが必要です / 台本は中央エディタの内容を出力します
                  </p>
                </div>
              </div>
            </div>
          ) : specialView === 'toc' ? (
            /* 目次プレビューUI */
            <div className="flex-1 overflow-y-auto">
              <div className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-sm z-10">
                <div className="flex items-center gap-3 text-sm font-bold text-indigo-700">
                  <List className="w-5 h-5" />
                  目次プレビュー
                </div>
              </div>
              <div className="p-8 max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-8 border">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">目次</h2>
                  <div className="space-y-4">
                    {course.chapters.map((chapter, chIdx) => (
                      <div key={chapter.id}>
                        <div className="flex items-baseline gap-3">
                          <span className="text-lg font-bold text-indigo-600">{chIdx + 1}.</span>
                          <span className="text-lg font-semibold text-slate-800">{chapter.title || `第${chIdx + 1}章`}</span>
                        </div>
                        <div className="ml-8 mt-2 space-y-1">
                          {chapter.sections.map((section, secIdx) => (
                            <div key={section.id} className="flex items-center gap-2 text-sm text-slate-600">
                              <span className="text-slate-400">{chIdx + 1}.{secIdx + 1}</span>
                              <span>{section.title || '（未入力）'}</span>
                              {section.slides && section.slides.length > 0 && (
                                <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                  {section.slides.length}枚
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-4 text-center">
                  この目次は「表紙」の設定で「目次を含める」をONにすると、一括作成時に自動挿入されます。
                </p>
              </div>
            </div>
          ) : (
            /* 節未選択時 */
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <Type className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">左の目次から小見出しを選択</p>
                <p className="text-sm">または「＋小見出しを追加」で新しいセクションを作成</p>
              </div>
            </div>
          )}
        </main>

        {/* 右：スライドプレビュー */}
        <aside className="w-[420px] border-l bg-slate-50 flex flex-col shrink-0 overflow-hidden">
          <div className="h-12 border-b bg-white flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-700">スライドプレビュー</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-[#2563EB] rounded font-bold uppercase tracking-tighter">
                HD 16:9
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* 拡大ボタン */}
              {currentSlides && currentSlides.length > 0 && (
                <button
                  onClick={() => {
                    setSlideModalIndex(activeSlideIndex);
                    setShowSlideModal(true);
                  }}
                  className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                  title="拡大表示"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              )}
              <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500">
                <Settings className="w-4 h-4" />
              </button>
              <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500">
                <Play className="w-4 h-4 text-green-600" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto flex flex-col items-center gap-4">
            {/* スライド生成エラー表示 */}
            {slideGenerationError && (
              <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {slideGenerationError}
                </p>
                <button
                  onClick={() => setSlideGenerationError(null)}
                  className="mt-2 text-[10px] text-red-600 hover:text-red-800"
                >
                  閉じる
                </button>
              </div>
            )}

            {/* スライド生成中インジケータ */}
            {isGeneratingSlides && (
              <div className="w-full p-4 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-center gap-3">
                <RefreshCw className="w-5 h-5 text-purple-600 animate-spin" />
                <span className="text-sm text-purple-700 font-medium">AIがスライドを生成中...</span>
              </div>
            )}

            {/* テンプレートセレクター（常時表示：セクション選択時） */}
            {activeSectionId && (
              <TemplateSelector
                selectedTemplateId={currentTemplateId}
                onSelectTemplate={(templateId) => {
                  // 常に仮選択状態を更新（UIに即座に反映）
                  setPendingTemplateId(templateId);

                  if (activeSlide) {
                    // スライドがある場合は既存のスライドにも適用
                    handleTemplateChange(activeSlide.slideId, templateId);
                  }
                  // スライドがない場合は仮選択のみ保持
                  // 新規スライド作成時にpendingTemplateIdが使われる
                }}
                onApplyToAll={currentSlides && currentSlides.length > 1 ? () => handleApplyTemplateToAll(currentTemplateId) : undefined}
                slideCount={currentSlides?.length || 0}
              />
            )}

            {/* AI生成スライドがある場合 */}
            {currentSlides && currentSlides.length > 0 ? (
              <>
                {/* ⑥ 小プレビュー削除：スライドナビはコンパクトなページネーションに変更 */}
                {currentSlides.length > 1 && (
                  <div className="w-full flex items-center justify-center gap-2 mb-2">
                    <button
                      onClick={() => setActiveSlideIndex(Math.max(0, activeSlideIndex - 1))}
                      disabled={activeSlideIndex === 0}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                      ◀
                    </button>
                    <div className="flex gap-1">
                      {currentSlides.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setActiveSlideIndex(index)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            activeSlideIndex === index ? 'bg-[#2563EB] scale-125' : 'bg-slate-300 hover:bg-slate-400'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => setActiveSlideIndex(Math.min(currentSlides.length - 1, activeSlideIndex + 1))}
                      disabled={activeSlideIndex === currentSlides.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                    >
                      ▶
                    </button>
                    <span className="text-xs text-slate-500 ml-2">{activeSlideIndex + 1} / {currentSlides.length}</span>
                  </div>
                )}

                {/* メインスライドカード（テンプレート対応）- 拡張表示 */}
                {activeSlide && (
                  <div
                    className={`
                      w-full aspect-video bg-white shadow-xl rounded-sm border border-slate-200
                      overflow-hidden relative group ring-2 ring-[#2563EB]
                      transition-all duration-300
                      ${isGeneratingSlides ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'}
                    `}
                  >
                    <SlidePreviewLayout
                      slide={activeSlide}
                      slideIndex={activeSlideIndex}
                      templateId={currentTemplateId}
                      hasImage={hasSlideImage(activeSlide)}
                      imageSrc={getSlideImageSrc(activeSlide)}
                      imageUploadMode={imageUploadMode}
                      isGeneratingImage={isGeneratingImage}
                      isGeneratingSlides={isGeneratingSlides}
                      isEditingVisualPrompt={isEditingVisualPrompt}
                      editingVisualPrompt={editingVisualPrompt}
                      showPromptHistory={showPromptHistory}
                      // スライドデータのみを使用（台本エリアとは非連動）
                      // livePreviewは使用しない = プレビューは常にslideデータと完全一致
                      onSlideEdit={() => handleSlideEdit(activeSlide)}
                      onImageUploadClick={() => handleImageUploadClick(activeSlide.slideId)}
                      onStartEditingVisualPrompt={() => handleStartEditingVisualPrompt(activeSlide)}
                      onImageUploadModeToggle={() => {
                        const newMode = imageUploadMode === 'cover' ? 'contain' : 'cover';
                        setImageUploadMode(newMode);
                        // スライドデータに永続化
                        if (activeSlide) {
                          handleInlineSlideUpdate({
                            ...activeSlide,
                            imageDisplayMode: newMode,
                            updatedAt: new Date(),
                          });
                        }
                      }}
                      onSetEditingVisualPrompt={setEditingVisualPrompt}
                      onSetIsEditingVisualPrompt={setIsEditingVisualPrompt}
                      onSetShowPromptHistory={setShowPromptHistory}
                      onSelectPromptFromHistory={handleSelectPromptFromHistory}
                      onGenerateImage={() => handleGenerateSlideImage(activeSlide.slideId, editingVisualPrompt)}
                    />
                    {/* ホバー時の編集オーバーレイ */}
                    {currentTemplateId !== 'base5' ? (
                      <div className="absolute left-0 top-0 bottom-0 w-[70%] bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                        <span className="text-xs bg-white/90 px-3 py-1.5 rounded-full shadow text-slate-700">
                          クリックして編集
                        </span>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                        <span className="text-xs bg-white/90 px-3 py-1.5 rounded-full shadow text-slate-700">
                          クリックして編集
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 画像アップロード用 hidden input */}
                <input
                  type="file"
                  ref={imageUploadInputRef}
                  onChange={handleImageFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {/* スライド操作ボタン */}
                {activeSlide && (
                  <div className="w-full flex items-center justify-between">
                    <button
                      onClick={() => handleToggleSlideLock(activeSlide.slideId)}
                      className={`
                        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                        ${activeSlide.locked
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }
                      `}
                    >
                      {activeSlide.locked ? '🔒 ロック解除' : '🔓 ロック'}
                    </button>
                    <button
                      onClick={() => handleRegenerateSectionSlides(activeSlide.sectionId)}
                      disabled={isGeneratingSlides || activeSlide.locked}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-md text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGeneratingSlides ? 'animate-spin' : ''}`} />
                      この節を再生成
                    </button>
                  </div>
                )}

                {/* AI生成スピーカーノート */}
                {activeSlide && activeSlide.speakerNotes && (
                  <div className="w-full p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs text-amber-700 font-medium flex items-center gap-1 mb-2">
                      🎤 スピーカーノート
                    </p>
                    <p className="text-[11px] text-amber-800 whitespace-pre-wrap">
                      {activeSlide.speakerNotes}
                    </p>
                    {activeSlide.imageIntent && (
                      <div className="mt-2 pt-2 border-t border-amber-200">
                        <p className="text-[9px] text-amber-600">
                          🖼️ 画像の意図: {activeSlide.imageIntent}
                        </p>
                        {/* 画像ステータス詳細 */}
                        <p className={`text-[9px] mt-1 ${
                          activeSlide.imageStatus === 'success' ? 'text-green-600' :
                          activeSlide.imageStatus === 'failed' ? 'text-red-600' :
                          activeSlide.imageStatus === 'skipped' ? 'text-slate-500' :
                          'text-purple-600'
                        }`}>
                          📊 ステータス: {
                            activeSlide.imageStatus === 'success' ? '✅ 生成成功' :
                            activeSlide.imageStatus === 'failed' ? `❌ 失敗 (${activeSlide.imageErrorMessage || '不明'})` :
                            activeSlide.imageStatus === 'skipped' ? '⏭️ スキップ' :
                            '⏳ 未処理'
                          }
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* 従来の表示（AI生成スライドがない場合のフォールバック） */
              <>
                {/* スライドカード（従来版） */}
                <div className={`
                  w-full aspect-video bg-white shadow-xl rounded-sm border border-slate-200
                  overflow-hidden relative group cursor-pointer ring-2 ring-[#2563EB]
                  transition-all duration-300
                  ${isSyncing ? 'opacity-50 scale-[0.98]' : 'opacity-100 scale-100'}
                `}>
                  <div className="absolute inset-0 flex flex-col p-6 bg-white">
                    <div className="text-slate-400 text-[9px] font-mono uppercase tracking-widest mb-3">
                      Page 01
                    </div>
                    <h2 className="text-xl font-black text-slate-800 leading-tight mb-4">
                      {slideData.title || 'タイトル未設定'}
                    </h2>
                    <ul className="space-y-2 flex-1">
                      {slideData.bullets.map((bullet, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] mt-1.5 shrink-0" />
                          <span className="text-xs text-slate-600 leading-relaxed">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-3 flex justify-center">
                      <div className="w-10 h-1 bg-[#2563EB] rounded-full" />
                    </div>
                  </div>
                </div>

                {/* ⑤ AI生成を促すメッセージは削除（目次側に同等機能があるため） */}
              </>
            )}

            {/* スピーカーノート（編集可能） - AI生成スライドがない場合のみ表示 */}
            {!currentSlides && (
              <div className="w-full p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
                    🎤 スピーカーノート
                  </p>
                  {isEditingNotes ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={saveNotes}
                        className="text-[10px] text-green-600 hover:text-green-800 flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        保存
                      </button>
                      <button
                        onClick={cancelEditingNotes}
                        className="text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startEditingNotes}
                      className="text-[10px] text-amber-600 hover:text-amber-800 flex items-center gap-1 px-2 py-0.5 hover:bg-amber-100 rounded transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      編集
                    </button>
                  )}
                </div>
                {isEditingNotes ? (
                  <textarea
                    value={editingNotesText}
                    onChange={(e) => setEditingNotesText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        cancelEditingNotes();
                      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                        saveNotes();
                      }
                    }}
                    placeholder="スピーカーノートを入力..."
                    className="w-full h-32 text-[11px] text-amber-800 bg-white border border-amber-300 rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                    autoFocus
                  />
                ) : slideData.speakerNotes.length > 0 ? (
                  <div className="text-[10px] text-amber-800 space-y-1 max-h-32 overflow-y-auto">
                    {slideData.speakerNotes.map((note, index) => (
                      <p key={index} className={note.startsWith('【') ? 'font-bold mt-1.5' : ''}>
                        {note}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-500 italic">
                    ノートはまだありません。「編集」をクリックして追加できます。
                  </p>
                )}
                <p className="text-[9px] text-amber-500 mt-2">
                  💡 Cmd/Ctrl+Enter で保存、Esc でキャンセル
                </p>
              </div>
            )}

          </div>
        </aside>

        {/* ヘルプパネル */}
        {showHelp && (
          <aside className="w-80 border-l bg-white flex flex-col shrink-0 overflow-hidden">
            <div className="h-12 border-b flex items-center justify-between px-4">
              <span className="text-sm font-bold text-slate-700">📖 使い方ガイド</span>
              <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-600 space-y-4">
              <div>
                <h4 className="font-bold text-slate-800 mb-2">① 構造から考える</h4>
                <p className="text-xs">いきなり台本を書かず、まず「章」と「小見出し」で構造を決めます。</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-2">② 目次 ↔ 台本は連動</h4>
                <p className="text-xs">左の目次と中央の台本は自動で同期されます。どちらを編集してもOK。</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-2">③ AI叩き台を活用</h4>
                <p className="text-xs">小見出しをダブルクリックまたは✨アイコンで、AI生成モーダルが開きます。</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-2">④ 🎤音声入力で思考整理</h4>
                <p className="text-xs">モーダル内で音声入力ができます。思いつくままに話してOK。AIが整理してくれます。</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-2">⑤ 骨子→台本の2段階生成</h4>
                <p className="text-xs">まず「骨子」を生成→確認・編集→「台本化」で中央エディタとスライドに反映。</p>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 mb-2">⑥ スライドに反映</h4>
                <p className="text-xs">編集後「スライドに反映」ボタンで右プレビューを更新できます。</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-800">
                  <span className="font-bold">💡 ポイント:</span><br />
                  AIは「叩き台」を作るだけ。最終的な言葉選びは必ず人間が行います。
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* フッター */}
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
            全体時間: <span className="font-bold text-slate-700">{course.totalDuration || 60}</span>分
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold text-slate-500 uppercase">
            Professional Plan
          </div>
          <span className="text-[11px] text-slate-400 tracking-tighter">v2.0.0-beta</span>
        </div>
      </footer>

      {/* AI台本生成モーダル（思考→骨子→台本フロー） */}
      {showDraftModal && draftTargetSection && (
        <ScriptGenerationModal
          sectionTitle={draftTargetSection.sectionTitle}
          chapterTitle={draftTargetSection.chapterTitle}
          courseTitle={course.title}
          totalDuration={course.totalDuration || 60}
          onClose={() => {
            setShowDraftModal(false);
            setDraftTargetSection(null);
          }}
          onComplete={handleScriptGenerated}
        />
      )}

      {/* スライド編集モーダル */}
      {isEditingSlide && editingSlideData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">スライドを編集</h3>
                <p className="text-xs text-slate-500">タイトル・箇条書き・ノートを編集できます</p>
              </div>
              <button
                onClick={() => {
                  setIsEditingSlide(false);
                  setEditingSlideData(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* モーダルボディ */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* タイトル */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  スライドタイトル
                </label>
                <input
                  type="text"
                  value={editingSlideData.title}
                  onChange={(e) => setEditingSlideData({ ...editingSlideData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="スライドのタイトルを入力"
                />
              </div>

              {/* 箇条書き */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  箇条書き（最大{getMaxBulletCount(editingSlideData.templateId || currentTemplateId, editingSlideData.columnCount)}行）
                </label>
                {editingSlideData.bullets.map((bullet, index) => (
                  <div key={index} className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 flex items-center justify-center text-xs text-slate-400 bg-slate-100 rounded">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={bullet}
                      onChange={(e) => {
                        const newBullets = [...editingSlideData.bullets];
                        newBullets[index] = e.target.value;
                        setEditingSlideData({ ...editingSlideData, bullets: newBullets });
                      }}
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      placeholder={`箇条書き ${index + 1}`}
                    />
                    <button
                      onClick={() => {
                        const newBullets = editingSlideData.bullets.filter((_, i) => i !== index);
                        const newLevels = (editingSlideData.bulletLevels || []).filter((_, i) => i !== index);
                        setEditingSlideData({ ...editingSlideData, bullets: newBullets, bulletLevels: newLevels.length > 0 ? newLevels : undefined });
                      }}
                      className="p-1 hover:bg-red-100 rounded text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {editingSlideData.bullets.length < getMaxBulletCount(editingSlideData.templateId || currentTemplateId, editingSlideData.columnCount) && (
                  <button
                    onClick={() => {
                      const newLevels = [...(editingSlideData.bulletLevels || editingSlideData.bullets.map(() => 2)), 2];
                      setEditingSlideData({
                        ...editingSlideData,
                        bullets: [...editingSlideData.bullets, ''],
                        bulletLevels: newLevels,
                      });
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                  >
                    <Plus className="w-3 h-3" />
                    箇条書きを追加
                  </button>
                )}
              </div>

              {/* スピーカーノート */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  スピーカーノート
                </label>
                <textarea
                  value={editingSlideData.speakerNotes}
                  onChange={(e) => setEditingSlideData({ ...editingSlideData, speakerNotes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
                  placeholder="このスライドで話す内容のメモ"
                />
              </div>

              {/* 画像の意図 */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  画像の意図（任意）
                </label>
                <input
                  type="text"
                  value={editingSlideData.imageIntent || ''}
                  onChange={(e) => setEditingSlideData({ ...editingSlideData, imageIntent: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  placeholder="例：図解、写真、アイコン、グラフなど"
                />
              </div>

              {/* ロック設定 */}
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-amber-800">AI上書き禁止</p>
                  <p className="text-[10px] text-amber-600">オンにすると、章一括再生成時にこのスライドは保護されます</p>
                </div>
                <button
                  onClick={() => setEditingSlideData({ ...editingSlideData, locked: !editingSlideData.locked })}
                  className={`
                    w-12 h-6 rounded-full transition-colors relative
                    ${editingSlideData.locked ? 'bg-amber-500' : 'bg-slate-300'}
                  `}
                >
                  <span
                    className={`
                      absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                      ${editingSlideData.locked ? 'translate-x-7' : 'translate-x-1'}
                    `}
                  />
                </button>
              </div>
            </div>

            {/* モーダルフッター */}
            <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsEditingSlide(false);
                  setEditingSlideData(null);
                }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveSlideEdit}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* スライド拡大モーダル */}
      {showSlideModal && currentSlides && currentSlides.length > 0 && (
        <SlideModal
          slides={currentSlides}
          initialIndex={slideModalIndex}
          chapterTitle={activeChapter?.title}
          sectionTitle={activeSection?.title}
          onClose={() => setShowSlideModal(false)}
          onRegenerate={(sectionId) => {
            setShowSlideModal(false);
            handleRegenerateSectionSlides(sectionId);
          }}
        />
      )}

      {/* デッキプレビューモーダル */}
      {showDeckModal && (
        <DeckModal
          course={course}
          coverSettings={coverSettings}
          onClose={() => setShowDeckModal(false)}
        />
      )}
    </div>
  );
}

/**
 * 台本生成ロジック（Gemini AI 連携版）
 *
 * /api/generate-outline: 骨子（アウトライン）生成
 * /api/generate-script: 台本テキスト生成
 */

// =====================================================
// 型定義
// =====================================================

export interface ScriptDraftInput {
  /** 小見出しタイトル（例：なぜ3Dデジタルなのか） */
  sectionTitle: string;
  /** 章タイトル */
  chapterTitle: string;
  /** 講座タイトル */
  courseTitle: string;
  /** 既存の箇条書き（中央エディタの内容） */
  existingBullets: string[];
  /** 補助条件テキスト（初心者向け / 事例多め など） */
  constraints: string;
  /** 音声入力テキスト */
  voiceMemo: string;
  /** 時間配分（分） */
  duration: number;
  /** 全体時間（分） */
  totalDuration?: number;
  /** 目的・伝えたいこと（モーダル入力） */
  purposeText?: string;
}

export interface OutlineOutput {
  outlineBullets: string[];
  slideBullets: string[];
  speakerNotesHint: string;
}

export interface ScriptDraftOutput {
  /** 生成された台本全文 */
  fullScript: string;
  /** スピーカーノート */
  speakerNotes: string;
  /** スライド用箇条書き */
  slideBullets: string[];
  /** 推定読み上げ時間（分） */
  estimatedDuration: number;
}

// =====================================================
// API呼び出し（骨子生成）
// =====================================================

/**
 * 骨子（アウトライン）を生成
 */
export async function generateOutline(input: ScriptDraftInput): Promise<OutlineOutput> {
  console.log('[SCRIPT_GENERATOR] Generating outline with AI...');

  const payload = {
    courseTitle: input.courseTitle,
    chapterTitle: input.chapterTitle,
    sectionTitle: input.sectionTitle,
    purposeText: input.purposeText || `「${input.sectionTitle}」について説明する`,
    durationMinutes: input.duration,
    totalMinutes: input.totalDuration || 60,
    ratio: input.duration / (input.totalDuration || 60),
    constraintsText: input.constraints,
    voiceMemoText: input.voiceMemo,
    existingBullets: input.existingBullets,
  };

  const response = await fetch('/api/generate-outline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[SCRIPT_GENERATOR] Outline generated:', data);
  return data;
}

// =====================================================
// API呼び出し（台本生成）
// =====================================================

/**
 * 台本テキストを生成（AI版）
 */
export async function generateScriptDraft(
  input: ScriptDraftInput,
  outlineDraft?: string[]
): Promise<ScriptDraftOutput> {
  console.log('[SCRIPT_GENERATOR] Generating script with AI...');

  // 骨子がなければ先に生成
  let outline = outlineDraft;
  if (!outline || outline.length === 0) {
    const outlineResult = await generateOutline(input);
    outline = outlineResult.outlineBullets;
  }

  const payload = {
    courseTitle: input.courseTitle,
    chapterTitle: input.chapterTitle,
    sectionTitle: input.sectionTitle,
    purposeText: input.purposeText || `「${input.sectionTitle}」について説明する`,
    durationMinutes: input.duration,
    totalMinutes: input.totalDuration || 60,
    ratio: input.duration / (input.totalDuration || 60),
    constraintsText: input.constraints,
    voiceMemoText: input.voiceMemo,
    outlineDraft: outline,
    existingBullets: input.existingBullets,
  };

  const response = await fetch('/api/generate-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data = await response.json();

  // 推定読み上げ時間を計算（日本語: 約180文字/分）
  const charCount = data.scriptText?.length || 0;
  const estimatedDuration = Math.ceil(charCount / 180);

  const output: ScriptDraftOutput = {
    fullScript: data.scriptText,
    speakerNotes: data.speakerNotes || '',
    slideBullets: data.slideBullets || [],
    estimatedDuration,
  };

  console.log('[SCRIPT_GENERATOR] Script generated:', output.fullScript.length, 'chars');
  return output;
}

// =====================================================
// 2段階生成（骨子 → 台本）
// =====================================================

export interface TwoStageGenerationResult {
  outline: OutlineOutput;
  script: ScriptDraftOutput;
}

/**
 * 2段階生成：骨子を生成して確認後、台本を生成
 */
export async function generateScriptTwoStage(
  input: ScriptDraftInput,
  editedOutline?: string[]
): Promise<TwoStageGenerationResult> {
  // Step 1: 骨子生成
  const outline = await generateOutline(input);

  // Step 2: 台本生成（編集された骨子があればそれを使用）
  const script = await generateScriptDraft(input, editedOutline || outline.outlineBullets);

  return { outline, script };
}

// =====================================================
// フォールバック（オフライン/テスト用）
// =====================================================

// =====================================================
// スライド生成 API呼び出し（Phase 1）
// =====================================================

import {
  SlideGenerationRequest,
  SlideGenerationResponse,
  GeneratedSlide,
  SectionContent,
  Slide,
} from '@/lib/types';
import { BaseTemplateId, DEFAULT_TEMPLATE_ID } from '@/lib/base-templates';

export interface ChapterSlideInput {
  courseTitle: string;
  chapterId: string;
  chapterTitle: string;
  sections: SectionContent[];
  totalDuration?: number;
  generateImages?: boolean;  // 画像生成ON/OFF
  templateId?: BaseTemplateId;  // テンプレートID（base1-base5）
}

export interface SectionSlideInput {
  courseTitle: string;
  chapterTitle: string;
  section: SectionContent;
  totalDuration?: number;
  generateImages?: boolean;  // 画像生成ON/OFF
  templateId?: BaseTemplateId;  // テンプレートID（base1-base5）
}

/**
 * 章一括でスライドを生成
 */
export async function generateChapterSlides(input: ChapterSlideInput): Promise<Slide[]> {
  console.log('[SLIDE_GENERATOR] Generating chapter slides for:', input.chapterTitle);
  console.log('[SLIDE_GENERATOR] Generate images:', input.generateImages);

  const payload: SlideGenerationRequest = {
    scope: 'chapter',
    courseTitle: input.courseTitle,
    chapterId: input.chapterId,
    chapterTitle: input.chapterTitle,
    sections: input.sections,
    totalDuration: input.totalDuration,
    generateImages: input.generateImages,
  };

  const response = await fetch('/api/generate-slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data: SlideGenerationResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'スライド生成に失敗しました');
  }

  // GeneratedSlide を Slide に変換
  // templateIdはinputから渡されるか、デフォルト値を使用
  const templateId: BaseTemplateId = input.templateId || DEFAULT_TEMPLATE_ID;
  const slides: Slide[] = data.slides.map((genSlide, index) => {
    console.log('[SLIDE_GENERATOR] Mapping slide:', genSlide.title, 'imageStatus:', genSlide.imageStatus, 'templateId:', templateId);
    return {
      slideId: `slide-${Date.now()}-${index}`,
      sectionId: genSlide.sectionId,
      order: genSlide.order,
      title: genSlide.title,
      bullets: genSlide.bullets,
      speakerNotes: genSlide.speakerNotes,
      layoutType: genSlide.layoutType,
      templateId,  // テンプレートIDを追加
      imageIntent: genSlide.imageIntent,
      imageBase64: genSlide.imageBase64,
      imageMimeType: genSlide.imageMimeType,
      imageStatus: genSlide.imageStatus,           // ← 追加
      imageErrorMessage: genSlide.imageErrorMessage, // ← 追加
      editedByUser: false,
      locked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  console.log('[SLIDE_GENERATOR] Generated', slides.length, 'slides');
  return slides;
}

/**
 * 節単位でスライドを生成（再生成用）
 */
export async function generateSectionSlides(input: SectionSlideInput): Promise<Slide[]> {
  console.log('[SLIDE_GENERATOR] Generating section slides for:', input.section.sectionTitle);
  console.log('[SLIDE_GENERATOR] Generate images:', input.generateImages);

  const payload: SlideGenerationRequest = {
    scope: 'section',
    courseTitle: input.courseTitle,
    chapterTitle: input.chapterTitle,
    section: input.section,
    totalDuration: input.totalDuration,
    generateImages: input.generateImages,
  };

  const response = await fetch('/api/generate-slides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data: SlideGenerationResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'スライド生成に失敗しました');
  }

  // GeneratedSlide を Slide に変換
  // templateIdはinputから渡されるか、デフォルト値を使用
  const templateId: BaseTemplateId = input.templateId || DEFAULT_TEMPLATE_ID;
  const slides: Slide[] = data.slides.map((genSlide, index) => {
    console.log('[SLIDE_GENERATOR] Mapping section slide:', genSlide.title, 'imageStatus:', genSlide.imageStatus, 'templateId:', templateId);
    return {
      slideId: `slide-${Date.now()}-${index}`,
      sectionId: input.section.sectionId,
      order: genSlide.order,
      title: genSlide.title,
      bullets: genSlide.bullets,
      speakerNotes: genSlide.speakerNotes,
      layoutType: genSlide.layoutType,
      templateId,  // テンプレートIDを追加
      imageIntent: genSlide.imageIntent,
      imageBase64: genSlide.imageBase64,
      imageMimeType: genSlide.imageMimeType,
      imageStatus: genSlide.imageStatus,           // ← 追加
      imageErrorMessage: genSlide.imageErrorMessage, // ← 追加
      editedByUser: false,
      locked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  console.log('[SLIDE_GENERATOR] Generated', slides.length, 'slides for section');
  return slides;
}

// =====================================================
// フォールバック（オフライン/テスト用）
// =====================================================

/**
 * ダミー台本生成（APIが使えない場合のフォールバック）
 */
export async function generateScriptDraftFallback(input: ScriptDraftInput): Promise<ScriptDraftOutput> {
  console.log('[SCRIPT_GENERATOR] Using fallback (dummy) generation');

  // 時間に応じた分量
  const targetLength = input.duration * 180;

  const sections = [
    `それでは、「${input.sectionTitle}」についてお話ししていきます。`,
    ``,
    ...input.existingBullets.map((bullet, i) => {
      const prefix = i === 0 ? 'まず' : i === 1 ? '次に' : 'そして';
      return `${prefix}、「${bullet}」についてです。これは非常に重要なポイントになります。`;
    }),
    ``,
    input.voiceMemo ? `補足として、${input.voiceMemo}` : '',
    ``,
    `以上が「${input.sectionTitle}」のポイントでした。`,
  ];

  const fullScript = sections.filter(Boolean).join('\n\n');

  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    fullScript,
    speakerNotes: `- ${input.sectionTitle}の要点を強調\n- 具体例を交えて説明`,
    slideBullets: input.existingBullets.slice(0, 4),
    estimatedDuration: Math.ceil(fullScript.length / 180),
  };
}

/**
 * NotebookLM 連携ユーティリティ
 *
 * 本アプリのデータを NotebookLM 投入用ソース原稿に変換する関数群
 */

import { CourseData, Chapter, Section, Slide, ScriptBlock } from './types';

// =====================================================
// NotebookLM投入用フォーマット
// =====================================================

/**
 * NotebookLM投入用のソーステキストを生成
 *
 * フォーマット:
 * TITLE: {講座タイトル}
 * CHAPTER: {章タイトル}
 * SECTION: {小見出しタイトル}
 *
 * SLIDE GOAL:
 * - {この小見出しで最終的に伝えたい結論 1行}
 *
 * KEY POINTS:
 * - {要点1}
 * - {要点2}
 * - {要点3}
 *
 * DETAIL:
 * - 例: {具体例}
 * - 数字: {数値や根拠}
 *
 * SPEAKER NOTES SUMMARY:
 * - {話す内容の要約（3〜6行）}
 */

export interface NotebookLMSourceInput {
  courseTitle: string;
  chapterTitle: string;
  sectionTitle: string;
  slideGoal: string;           // この小見出しで伝えたい結論
  keyPoints: string[];         // 要点（3〜5個）
  details: string[];           // 具体例・数字・根拠
  speakerNotesSummary: string; // スピーカーノート要約
}

/**
 * 単一セクション用のNotebookLMソーステキストを生成
 */
export function generateNotebookLMSource(input: NotebookLMSourceInput): string {
  const lines: string[] = [];

  lines.push(`TITLE: ${input.courseTitle}`);
  lines.push(`CHAPTER: ${input.chapterTitle}`);
  lines.push(`SECTION: ${input.sectionTitle}`);
  lines.push('');

  lines.push('SLIDE GOAL:');
  lines.push(`- ${input.slideGoal}`);
  lines.push('');

  lines.push('KEY POINTS:');
  input.keyPoints.forEach(point => {
    lines.push(`- ${point}`);
  });
  lines.push('');

  lines.push('DETAIL:');
  input.details.forEach(detail => {
    lines.push(`- ${detail}`);
  });
  lines.push('');

  lines.push('SPEAKER NOTES SUMMARY:');
  lines.push(input.speakerNotesSummary);

  return lines.join('\n');
}

/**
 * 複数セクションをまとめてNotebookLMソーステキストを生成
 */
export function generateNotebookLMSourceBatch(inputs: NotebookLMSourceInput[]): string {
  return inputs.map(input => generateNotebookLMSource(input)).join('\n\n---\n\n');
}

// =====================================================
// 本アプリのデータからNotebookLMソースを生成
// =====================================================

/**
 * 台本ブロックから要点を抽出
 */
function extractKeyPointsFromBlocks(blocks: ScriptBlock[]): string[] {
  const keyPoints: string[] = [];

  blocks.forEach(block => {
    if (block.type === 'bullet' && block.content.trim()) {
      keyPoints.push(block.content.trim());
    }
  });

  // 最大5個まで
  return keyPoints.slice(0, 5);
}

/**
 * 台本ブロックから本文を抽出（スピーカーノート用）
 */
function extractBodyFromBlocks(blocks: ScriptBlock[]): string {
  const bodyParts: string[] = [];

  blocks.forEach(block => {
    if (block.type === 'body' && block.content.trim()) {
      bodyParts.push(block.content.trim());
    }
  });

  // 長すぎる場合は要約（最初の500文字程度）
  const fullText = bodyParts.join('\n');
  if (fullText.length > 500) {
    return fullText.substring(0, 500) + '...';
  }
  return fullText || '（本文なし）';
}

/**
 * スライドデータからNotebookLMソースを生成
 */
function extractFromSlide(slide: Slide): {
  slideGoal: string;
  keyPoints: string[];
  details: string[];
  speakerNotesSummary: string;
} {
  return {
    slideGoal: slide.title || '（タイトル未設定）',
    keyPoints: slide.bullets.length > 0 ? slide.bullets : ['（要点なし）'],
    details: slide.imageIntent ? [`画像イメージ: ${slide.imageIntent}`] : [],
    speakerNotesSummary: slide.speakerNotes || '（スピーカーノートなし）',
  };
}

/**
 * セクションからNotebookLMソースを生成
 */
export function generateSourceFromSection(
  courseTitle: string,
  chapter: Chapter,
  section: Section
): NotebookLMSourceInput[] {
  const sources: NotebookLMSourceInput[] = [];

  // スライドがある場合はスライドから生成
  if (section.slides && section.slides.length > 0) {
    section.slides.forEach(slide => {
      // NotebookLMスライドは除外（既に完成スライドなので）
      if (slide.sourceType === 'notebooklm') return;

      const extracted = extractFromSlide(slide);
      sources.push({
        courseTitle,
        chapterTitle: chapter.title,
        sectionTitle: section.title,
        ...extracted,
      });
    });
  }
  // スライドがない場合は台本ブロックから生成
  else if (section.blocks && section.blocks.length > 0) {
    const keyPoints = extractKeyPointsFromBlocks(section.blocks);
    const speakerNotes = extractBodyFromBlocks(section.blocks);

    sources.push({
      courseTitle,
      chapterTitle: chapter.title,
      sectionTitle: section.title,
      slideGoal: section.title,
      keyPoints: keyPoints.length > 0 ? keyPoints : ['（要点なし）'],
      details: [],
      speakerNotesSummary: speakerNotes,
    });
  }

  return sources;
}

/**
 * 章全体からNotebookLMソースを生成
 */
export function generateSourceFromChapter(
  courseTitle: string,
  chapter: Chapter
): NotebookLMSourceInput[] {
  const sources: NotebookLMSourceInput[] = [];

  chapter.sections.forEach(section => {
    const sectionSources = generateSourceFromSection(courseTitle, chapter, section);
    sources.push(...sectionSources);
  });

  return sources;
}

/**
 * 講座全体からNotebookLMソースを生成
 */
export function generateSourceFromCourse(course: CourseData): NotebookLMSourceInput[] {
  const sources: NotebookLMSourceInput[] = [];

  course.chapters.forEach(chapter => {
    const chapterSources = generateSourceFromChapter(course.title, chapter);
    sources.push(...chapterSources);
  });

  return sources;
}

// =====================================================
// エクスポート用ヘルパー
// =====================================================

/**
 * 講座データからNotebookLM用テキストを直接生成
 */
export function courseToNotebookLMText(course: CourseData): string {
  const sources = generateSourceFromCourse(course);
  return generateNotebookLMSourceBatch(sources);
}

/**
 * 章データからNotebookLM用テキストを直接生成
 */
export function chapterToNotebookLMText(courseTitle: string, chapter: Chapter): string {
  const sources = generateSourceFromChapter(courseTitle, chapter);
  return generateNotebookLMSourceBatch(sources);
}

/**
 * セクションデータからNotebookLM用テキストを直接生成
 */
export function sectionToNotebookLMText(
  courseTitle: string,
  chapter: Chapter,
  section: Section
): string {
  const sources = generateSourceFromSection(courseTitle, chapter, section);
  return generateNotebookLMSourceBatch(sources);
}

// =====================================================
// NotebookLM ノートブックURL（固定）
// =====================================================

export const NOTEBOOKLM_NOTEBOOK_URL = 'https://notebooklm.google.com/notebook/2b468568-e7a5-4fc3-8118-512e215675a4';
export const NOTEBOOKLM_NOTEBOOK_NAME = 'Lecture Sync App｜完成スライド生成エンジン';

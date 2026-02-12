// =====================================================
// WEB講座オールインアプリ - 型定義
// 「思考プロセス準拠」のデータモデル
// =====================================================

// 同期ステータス
export type SyncStatus = 'draft' | 'draft_generated' | 'synced' | 'script_ahead' | 'slide_ahead' | 'conflict';

// ブロックタイプ（台本の構成要素）
// heading1: 章見出し, heading2: 小見出し, bullet: 箇条書き, body: 本文, note: 補足
export type BlockType = 'heading1' | 'heading2' | 'bullet' | 'body' | 'note';

// ブロックタイプのラベル（UI表示用）
export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  heading1: '章見出し',
  heading2: '小見出し',
  bullet: '箇条書き',
  body: '本文',
  note: '補足',
};

// 台本ブロック（台本エディタの最小単位）
export interface ScriptBlock {
  id: string;
  type: BlockType;
  content: string;
  // heading2の場合、AI生成に使う構成意図を保持
  aiPrompt?: {
    intent: string;        // この小見出しで伝えたい内容
    durationRatio: number; // 全体時間に対する割合（例: 10/45 = 0.22）
    conditions?: string;   // 補足条件
  };
}

// 節（Section）- 小見出し単位のデータ
export interface Section {
  id: string;
  title: string;           // 小見出しタイトル（台本のheading2と同期）
  syncStatus: SyncStatus;
  blocks: ScriptBlock[];   // この節に属する台本ブロック
  slideData?: SlideData;   // 生成されたスライドデータ（既存互換）
  slides?: Slide[];        // AI生成スライド（新モデル）
}

// 章（Chapter）- 大見出し単位のデータ
export interface Chapter {
  id: string;
  title: string;           // 章タイトル（台本のheading1と同期）
  sections: Section[];
  chapterSlides?: ChapterSlides;  // 章単位で生成したスライド
}

// スライドレイアウトタイプ（Phase 2で拡張予定）
export type SlideLayoutType =
  | 'title_bullets'    // 標準：タイトル＋箇条書き
  | 'title_only'       // タイトルのみ（章タイトル等）
  | 'two_column'       // 2カラム構成
  | 'quote'            // 引用・名言
  | 'diagram'          // 図解用
  | 'summary';         // まとめ

// 画像生成ステータス
export type ImageGenerationStatus = 'success' | 'failed' | 'skipped' | 'pending';

// スライドのソースタイプ
export type SlideSourceType = 'app' | 'notebooklm';

// Visual（画像）のタイプ
export type VisualType = 'none' | 'generated' | 'uploaded' | 'url';

// Visual（画像）オブジェクト
export interface SlideVisual {
  type: VisualType;
  src?: string;              // 画像URL or base64 or storage URL
  mimeType?: string;         // MIMEタイプ (image/png, image/jpeg等)
  prompt?: string;           // 生成時のプロンプト（generated時のみ）
  uploadedFileName?: string; // アップロード時の元ファイル名
}

// ベーステンプレートID（レイアウト切替用）
import type { BaseTemplateId } from './base-templates';

// 単一スライドデータ（新モデル）
export interface Slide {
  slideId: string;
  sectionId: string;          // 紐付く小見出しID
  order: number;              // 表示順序（0始まり）
  title: string;              // スライドタイトル
  bullets: string[];          // 箇条書き（最大5行）
  speakerNotes: string;       // スピーカーノート
  layoutType: SlideLayoutType;
  // === ベーステンプレート（レイアウト切替）===
  templateId?: BaseTemplateId; // ベーステンプレートID（未指定時はbase1）
  // === Visual（新構造）===
  visual?: SlideVisual;       // 画像情報（アップロード/生成/URL統合）
  // === 画像関連（レガシー - 互換性維持）===
  imagePrompt?: string;       // 画像生成用プロンプト
  imageIntent?: string;       // 画像の意図（図解/写真/アイコン等）
  visualPrompt?: string;      // ユーザー編集可能なVisual Prompt
  visualPromptHistory?: string[];  // Visual Prompt 履歴（過去のプロンプト）
  imageBase64?: string;       // 生成された画像（Base64）
  imageMimeType?: string;     // 画像のMIMEタイプ
  imageStatus?: ImageGenerationStatus;  // 画像生成ステータス
  imageErrorMessage?: string; // 画像生成エラーメッセージ
  editedByUser: boolean;      // ユーザー編集済みフラグ
  locked: boolean;            // AI上書き禁止フラグ
  createdAt: Date;
  updatedAt: Date;
  // NotebookLM統合用
  sourceType?: SlideSourceType;  // スライドの生成元（app: 本アプリ, notebooklm: 外部取り込み）
  pngDataUrl?: string;           // NotebookLM完成スライド画像（data:image/png;base64,...）
}

// 章全体のスライドコレクション
export interface ChapterSlides {
  chapterId: string;
  slides: Slide[];
  generatedAt?: Date;         // 最後にAI生成した日時
}

// スライドデータ（既存互換 - 将来的に Slide に移行）
export interface SlideData {
  title: string;
  bullets: string[];
  speakerNotes: string[];
}

// 講座全体のデータ
export interface CourseData {
  id: string;
  title: string;           // 講座テーマ
  totalDuration?: number;  // 全体時間（分）
  chapters: Chapter[];
  createdAt: Date;
  updatedAt: Date;
}

// アプリの画面状態
export type AppScreen = 'setup' | 'editor';

// アプリ全体の状態
export interface AppState {
  screen: AppScreen;
  course: CourseData | null;
  activeChapterId: string | null;
  activeSectionId: string | null;
}

// 初期設定画面の入力データ
export interface SetupFormData {
  courseTitle: string;
  totalDuration: number;
  chapterTitles: string[];
}

// AI叩き台生成のリクエスト
export interface DraftGenerationRequest {
  sectionId: string;
  intent: string;
  durationRatio: number;
  conditions?: string;
  courseContext: {
    courseTitle: string;
    chapterTitle: string;
    sectionTitle: string;
  };
}

// =====================================================
// 思考→骨子→台本 生成フロー用の型定義
// =====================================================

// 骨子生成のペイロード
export interface OutlineGenerationPayload {
  courseTitle: string;
  chapterTitle: string;
  sectionTitle: string;
  purposeText: string;      // 伝えたい内容（必須）
  durationMinutes: number;  // この小見出しの時間配分（分）
  totalMinutes: number;     // 講座全体の時間（分）
  ratio: number;            // 時間の割合（0〜1）
  constraintsText?: string; // 補足条件
  voiceMemoText?: string;   // 音声入力テキスト
}

// 骨子生成の結果
export interface OutlineGenerationResult {
  bullets: string[];        // 骨子（箇条書き 5〜10行程度）
  summary: string;          // 要約（2〜4行）
}

// 台本生成のペイロード
export interface ScriptGenerationPayload extends OutlineGenerationPayload {
  outlineDraft: string;     // ユーザー編集後の骨子
}

// 台本生成の結果
export interface ScriptGenerationResult {
  script: string;           // 台本本文
  slideTitle: string;       // スライドタイトル
  slideBullets: string[];   // スライド用箇条書き（最大4つ）
  speakerNotes: string;     // スピーカーノート
}

// 生成フローのステップ
export type GenerationStep = 'input' | 'outline' | 'script';

// モーダルの状態
export interface GenerationModalState {
  step: GenerationStep;
  // 入力値
  purposeText: string;
  durationMinutes: number;
  constraintsText: string;
  voiceMemoText: string;
  // 骨子生成結果（編集可能）
  outlineBullets: string;
  outlineSummary: string;
  // 生成状態
  isGeneratingOutline: boolean;
  isGeneratingScript: boolean;
  error: string | null;
}

// =====================================================
// スライド生成 API 用の型定義（Phase 1）
// =====================================================

// スライド生成の粒度
export type SlideGenerationScope = 'chapter' | 'section';

// セクション情報（スライド生成用）
export interface SectionContent {
  sectionId: string;
  sectionTitle: string;
  blocks: ScriptBlock[];     // 台本ブロック
  purposeText?: string;      // 伝えたい内容
  durationMinutes?: number;  // 想定時間
}

// スライド生成リクエスト（章一括）
export interface ChapterSlideGenerationRequest {
  scope: 'chapter';
  courseTitle: string;
  chapterId: string;
  chapterTitle: string;
  sections: SectionContent[];
  totalDuration?: number;
  generateImages?: boolean;  // 画像生成ON/OFFフラグ
}

// スライド生成リクエスト（節単位）
export interface SectionSlideGenerationRequest {
  scope: 'section';
  courseTitle: string;
  chapterTitle: string;
  section: SectionContent;
  totalDuration?: number;
  generateImages?: boolean;  // 画像生成ON/OFFフラグ
}

// スライド生成リクエスト（統合型）
export type SlideGenerationRequest =
  | ChapterSlideGenerationRequest
  | SectionSlideGenerationRequest;

// 生成されたスライド（API応答用）
export interface GeneratedSlide {
  sectionId: string;
  order: number;
  title: string;
  bullets: string[];
  speakerNotes: string;
  layoutType: SlideLayoutType;
  imageIntent?: string;
  imageBase64?: string;       // 生成された画像（Base64）
  imageMimeType?: string;     // 画像のMIMEタイプ
  imageStatus?: ImageGenerationStatus;  // 画像生成ステータス
  imageErrorMessage?: string; // 画像生成エラーメッセージ
}

// スライド生成レスポンス
export interface SlideGenerationResponse {
  success: boolean;
  slides: GeneratedSlide[];
  error?: string;
}

// =====================================================
// 画像ヘルパー関数（visual + レガシー互換）
// =====================================================

/**
 * スライドから表示用の画像ソース（data URL）を取得
 * 新しいvisualオブジェクトを優先、レガシーのimageBase64も対応
 */
export function getSlideImageSrc(slide: Slide): string | null {
  // 1. 新しいvisualオブジェクトがある場合
  if (slide.visual && slide.visual.type !== 'none' && slide.visual.src) {
    const mimeType = slide.visual.mimeType || 'image/png';
    return `data:${mimeType};base64,${slide.visual.src}`;
  }
  // 2. レガシー: imageBase64がある場合（成功時のみ）
  if (slide.imageStatus === 'success' && slide.imageBase64) {
    const mimeType = slide.imageMimeType || 'image/png';
    return `data:${mimeType};base64,${slide.imageBase64}`;
  }
  return null;
}

/**
 * スライドに表示可能な画像があるかどうか判定
 */
export function hasSlideImage(slide: Slide): boolean {
  // 1. 新しいvisualオブジェクトがある場合
  if (slide.visual && slide.visual.type !== 'none' && slide.visual.src) {
    return true;
  }
  // 2. レガシー: imageBase64がある場合（成功時のみ）
  if (slide.imageStatus === 'success' && slide.imageBase64) {
    return true;
  }
  return false;
}

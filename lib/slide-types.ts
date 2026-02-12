// =====================================================
// 新スライド生成システム - 型定義
// 方針: 軽量・安定・日本語100%
// =====================================================

/**
 * スライドレイアウトID
 * テンプレートの見た目を決定
 */
export type SlideLayoutId =
  | 'title_bullets'     // 標準: タイトル + 箇条書き
  | 'two_column'        // 2カラム: 左右に分割
  | 'quote'             // 引用: 大きな引用文
  | 'steps'             // ステップ: 手順を示す
  | 'comparison'        // 比較: 2つの対比
  | 'diagram_focus';    // 図解中心: 画像スペース大

/**
 * 新スライドデータ構造
 * 画像は完全に別レーンで管理
 */
export interface LightSlide {
  // === 識別 ===
  slideId: string;
  sectionId: string;      // 紐付く小見出しID
  order: number;          // 表示順序 (0始まり)

  // === コンテンツ (台本から抽出) ===
  title: string;          // スライドタイトル (台本の小見出しから)
  bullets: string[];      // 箇条書き (最大5行、台本から要点抽出)
  speakerNotes?: string;  // スピーカーノート (元台本文、任意)

  // === レイアウト ===
  layoutId: SlideLayoutId;

  // === 画像 (別レーン管理) ===
  visual?: {
    imageUrl?: string;           // 生成された画像URL
    imageBase64?: string;        // Base64データ
    imageMimeType?: string;      // MIMEタイプ
    imageGuide?: string;         // 画像生成ガイド文 (ユーザー入力)
    generationStatus: 'none' | 'pending' | 'success' | 'failed';
    errorMessage?: string;
  };

  // === メタデータ ===
  sourceType: 'app' | 'notebooklm';  // 生成元
  editedByUser: boolean;             // ユーザー編集済み
  locked: boolean;                   // AI上書き禁止
  createdAt: Date;
  updatedAt: Date;
}

/**
 * スライド生成リクエスト (軽量版)
 * 画像生成は含まない
 */
export interface LightSlideGenerationRequest {
  courseTitle: string;
  chapterTitle: string;
  sections: LightSectionInput[];
}

/**
 * セクション入力 (スライド生成用)
 */
export interface LightSectionInput {
  sectionId: string;
  sectionTitle: string;
  bullets: string[];      // 台本から抽出した箇条書き
  bodyText?: string;      // 台本本文 (あれば)
  notes?: string;         // 補足 (あれば)
}

/**
 * スライド生成レスポンス (軽量版)
 */
export interface LightSlideGenerationResponse {
  success: boolean;
  slides: LightSlideOutput[];
  error?: string;
}

/**
 * 生成されたスライド出力
 */
export interface LightSlideOutput {
  sectionId: string;
  order: number;
  title: string;
  bullets: string[];
  speakerNotes: string;
  layoutId: SlideLayoutId;
}

/**
 * レイアウト選択ロジック用のヒント
 */
export interface LayoutHint {
  bulletCount: number;      // 箇条書きの数
  avgBulletLength: number;  // 平均文字数
  hasComparison: boolean;   // 比較表現があるか
  hasSteps: boolean;        // 手順表現があるか
  hasQuote: boolean;        // 引用があるか
}

/**
 * レイアウトIDからレイアウト名を取得
 */
export const LAYOUT_LABELS: Record<SlideLayoutId, string> = {
  title_bullets: 'タイトル＋箇条書き',
  two_column: '2カラム',
  quote: '引用',
  steps: 'ステップ',
  comparison: '比較',
  diagram_focus: '図解中心',
};

/**
 * レイアウトの推奨条件
 */
export const LAYOUT_CONDITIONS: Record<SlideLayoutId, string> = {
  title_bullets: '基本レイアウト。箇条書き3〜5個に最適',
  two_column: '箇条書きが6個以上、または左右比較がある場合',
  quote: '重要なメッセージや引用を強調したい場合',
  steps: '手順や順序を示す場合（1. 2. 3. など）',
  comparison: 'AとBの比較、メリット/デメリットなど',
  diagram_focus: '図解や画像を大きく見せたい場合',
};

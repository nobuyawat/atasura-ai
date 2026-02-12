// =====================================================
// ベーステンプレート定義
// 汎用的で内容非依存のレイアウトフォーマット
// =====================================================

/**
 * ベーステンプレートID
 * - base1: 左テキスト70% / 右画像30%
 * - base2: 右テキスト70% / 左画像30%
 * - base3: 2カラム + 右アクセント画像
 * - base4: 2カラム + 左アクセント画像
 * - base5: フリーレイアウト（画像なし・カラム数選択可能: 1/2/3）
 */
export type BaseTemplateId = 'base1' | 'base2' | 'base3' | 'base4' | 'base5';

/**
 * テンプレートレイアウト設定
 */
export interface TemplateLayout {
  textPosition: 'left' | 'right' | 'full';
  textWidthPercent: number;
  imagePosition: 'left' | 'right' | 'accent-left' | 'accent-right' | 'none';
  imageWidthPercent: number;
  imageSize: 'full' | 'accent'; // full=縦100%, accent=小さめ装飾
}

/**
 * ベーステンプレート定義
 */
export interface BaseTemplate {
  id: BaseTemplateId;
  name: string;
  shortName: string;
  description: string;
  layout: TemplateLayout;
  // プレビュー用のアイコン表現
  preview: {
    leftBlock: 'text' | 'image' | 'none';
    rightBlock: 'text' | 'image' | 'none';
    leftWidth: number; // 0-100
    rightWidth: number; // 0-100
  };
}

/**
 * ベーステンプレート一覧
 */
export const BASE_TEMPLATES: BaseTemplate[] = [
  {
    id: 'base1',
    name: 'ベース1：左テキスト・右画像',
    shortName: '左文・右画',
    description: 'テキスト70% / 画像30%（縦100%）',
    layout: {
      textPosition: 'left',
      textWidthPercent: 70,
      imagePosition: 'right',
      imageWidthPercent: 30,
      imageSize: 'full',
    },
    preview: {
      leftBlock: 'text',
      rightBlock: 'image',
      leftWidth: 70,
      rightWidth: 30,
    },
  },
  {
    id: 'base2',
    name: 'ベース2：右テキスト・左画像',
    shortName: '左画・右文',
    description: '画像30% / テキスト70%（縦100%）',
    layout: {
      textPosition: 'right',
      textWidthPercent: 70,
      imagePosition: 'left',
      imageWidthPercent: 30,
      imageSize: 'full',
    },
    preview: {
      leftBlock: 'image',
      rightBlock: 'text',
      leftWidth: 30,
      rightWidth: 70,
    },
  },
  {
    id: 'base3',
    name: 'ベース3：2カラム＋右アクセント',
    shortName: '2列＋右飾',
    description: '2カラムテキスト＋右側にワンポイント画像',
    layout: {
      textPosition: 'full',
      textWidthPercent: 80,
      imagePosition: 'accent-right',
      imageWidthPercent: 20,
      imageSize: 'accent',
    },
    preview: {
      leftBlock: 'text',
      rightBlock: 'image',
      leftWidth: 80,
      rightWidth: 20,
    },
  },
  {
    id: 'base4',
    name: 'ベース4：2カラム＋左アクセント',
    shortName: '左飾＋2列',
    description: '左側にワンポイント画像＋2カラムテキスト',
    layout: {
      textPosition: 'full',
      textWidthPercent: 80,
      imagePosition: 'accent-left',
      imageWidthPercent: 20,
      imageSize: 'accent',
    },
    preview: {
      leftBlock: 'image',
      rightBlock: 'text',
      leftWidth: 20,
      rightWidth: 80,
    },
  },
  {
    id: 'base5',
    name: 'ベース5：フリーレイアウト',
    shortName: 'フリー',
    description: '画像なし・カラム数選択可能（1/2/3列）',
    layout: {
      textPosition: 'full',
      textWidthPercent: 100,
      imagePosition: 'none',
      imageWidthPercent: 0,
      imageSize: 'full',
    },
    preview: {
      leftBlock: 'text',
      rightBlock: 'none',
      leftWidth: 100,
      rightWidth: 0,
    },
  },
];

/**
 * テンプレートIDからテンプレート定義を取得
 */
export function getBaseTemplate(templateId: BaseTemplateId): BaseTemplate {
  return BASE_TEMPLATES.find((t) => t.id === templateId) || BASE_TEMPLATES[0];
}

/**
 * デフォルトテンプレートID
 */
export const DEFAULT_TEMPLATE_ID: BaseTemplateId = 'base1';

/**
 * テンプレート + スライドのcolumnCountから実効カラム数を取得
 * - base3/base4: 常に2カラム（テンプレート固定）
 * - base5: スライドのcolumnCount（1/2/3）デフォルト1
 * - base1/base2: 常に1カラム
 */
export function getEffectiveColumnCount(
  templateId: BaseTemplateId,
  slideColumnCount?: 1 | 2 | 3
): 1 | 2 | 3 {
  if (templateId === 'base3' || templateId === 'base4') return 2;
  if (templateId === 'base5') return slideColumnCount || 1;
  return 1;
}

/**
 * テンプレートとカラム数から箇条書きの最大行数を取得
 * - base5（フリー）: カラム数 × 5（1列=5, 2列=10, 3列=15）
 * - base1/base2/base3/base4: 常に5
 */
export function getMaxBulletCount(
  templateId: BaseTemplateId,
  slideColumnCount?: 1 | 2 | 3
): number {
  if (templateId === 'base5') {
    const cols = slideColumnCount || 1;
    return cols * 5;
  }
  return 5;
}

/**
 * 箇条書き配列をカラム分割するヘルパー
 * プレビュー・編集・エクスポート全てで同一ロジックを使用
 */
export function splitBulletsIntoColumns(
  bullets: string[],
  columnCount: 1 | 2 | 3
): string[][] {
  if (columnCount === 1) return [bullets];
  if (columnCount === 2) {
    const mid = Math.ceil(bullets.length / 2);
    return [bullets.slice(0, mid), bullets.slice(mid)];
  }
  // 3カラム
  const colSize = Math.ceil(bullets.length / 3);
  return [
    bullets.slice(0, colSize),
    bullets.slice(colSize, colSize * 2),
    bullets.slice(colSize * 2),
  ];
}

/**
 * 箇条書きの見出しレベルを取得するヘルパー
 * bulletLevels配列が未設定またはインデックス外の場合はデフォルト2を返す
 */
export function getBulletLevel(bulletLevels: number[] | undefined, index: number): 1 | 2 | 3 {
  const level = bulletLevels?.[index];
  if (level === 1 || level === 2 || level === 3) return level;
  return 2; // デフォルトは見出し2
}

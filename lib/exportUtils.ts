/**
 * PNG出力ユーティリティ
 *
 * - 通常形式: 16:9 スライドPNG
 * - ノート形式: A4縦 (上:スライド、下:スピーカーノート)
 * - 台本のみ: A4縦 テキストのみ
 */

import JSZip from 'jszip';
import { Slide, CourseData, getSlideImageSrc, hasSlideImage, ScriptBlock, BulletImage } from './types';
import { BaseTemplateId, getBaseTemplate, getBulletLevel, DEFAULT_TEMPLATE_ID, getEffectiveColumnCount, splitBulletsIntoColumns } from './base-templates';

// A4サイズ (300dpi相当)
const A4_WIDTH = 2480;
const A4_HEIGHT = 3508;

// 16:9 スライドサイズ
const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;

// 日本語対応フォント
const FONT_FAMILY = 'system-ui, -apple-system, "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';

// =====================================================
// bodyHtml パース用ヘルパー
// =====================================================

interface RichTextSegment {
  text: string;
  headingLevel?: 1 | 2 | 3;
}

interface RichTextLine {
  segments: RichTextSegment[];
}

/**
 * bodyHtml（TipTap出力）をCanvas描画用にパースする
 * <p>テキスト<span data-heading-level="1">見出し</span>テキスト</p>
 */
function parseBodyHtmlForCanvas(html: string): RichTextLine[] {
  if (!html) return [];

  const lines: RichTextLine[] = [];

  // <p>タグで分割（各段落が1行）
  const paragraphs = html.split(/<\/p>\s*<p[^>]*>/i);

  for (let para of paragraphs) {
    // 先頭/末尾の<p>タグを除去
    para = para.replace(/^<p[^>]*>/i, '').replace(/<\/p>$/i, '');

    // <br>を改行として扱う
    const subLines = para.split(/<br\s*\/?>/gi);

    for (const subLine of subLines) {
      const segments: RichTextSegment[] = [];

      // <span data-heading-level="N">...</span> とプレーンテキストに分割
      const regex = /<span[^>]*data-heading-level="(\d)"[^>]*>(.*?)<\/span>/gi;
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(subLine)) !== null) {
        // マッチ前のプレーンテキスト
        if (match.index > lastIndex) {
          const plainText = subLine.slice(lastIndex, match.index).replace(/<[^>]+>/g, '');
          if (plainText) {
            segments.push({ text: decodeHtmlEntities(plainText) });
          }
        }

        // 見出しレベル付きテキスト
        const level = parseInt(match[1], 10) as 1 | 2 | 3;
        const text = match[2].replace(/<[^>]+>/g, '');
        if (text) {
          segments.push({ text: decodeHtmlEntities(text), headingLevel: level });
        }

        lastIndex = match.index + match[0].length;
      }

      // 残りのプレーンテキスト
      if (lastIndex < subLine.length) {
        const plainText = subLine.slice(lastIndex).replace(/<[^>]+>/g, '');
        if (plainText) {
          segments.push({ text: decodeHtmlEntities(plainText) });
        }
      }

      if (segments.length > 0) {
        lines.push({ segments });
      } else {
        // 空行
        lines.push({ segments: [{ text: '' }] });
      }
    }
  }

  return lines;
}

/**
 * HTMLエンティティをデコード
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * bodyHtml（リッチテキスト）をCanvasに描画
 * 見出しレベルごとにフォントサイズ/太さ/色を切り替え
 */
function drawBodyHtmlToCanvas(
  ctx: CanvasRenderingContext2D,
  html: string,
  x: number,
  y: number,
  maxWidth: number,
  baseFontSize: number,
  lineHeight: number,
): number {
  const lines = parseBodyHtmlForCanvas(html);
  let currentY = y;

  for (const line of lines) {
    if (line.segments.length === 1 && line.segments[0].text === '') {
      currentY += lineHeight * 0.5;
      continue;
    }

    // 各セグメントを順番に描画
    let currentX = x;

    for (const segment of line.segments) {
      // セグメントのスタイルを設定
      let font: string;
      let color: string;

      if (segment.headingLevel === 1) {
        font = `bold ${Math.floor(baseFontSize * 1.15)}px ${FONT_FAMILY}`;
        color = '#1e293b';
      } else if (segment.headingLevel === 3) {
        font = `${Math.floor(baseFontSize * 0.85)}px ${FONT_FAMILY}`;
        color = '#64748b';
      } else if (segment.headingLevel === 2) {
        font = `500 ${baseFontSize}px ${FONT_FAMILY}`;
        color = '#475569';
      } else {
        // プレーンテキスト
        font = `${baseFontSize}px ${FONT_FAMILY}`;
        color = '#475569';
      }

      ctx.font = font;
      ctx.fillStyle = color;

      // テキストの折り返し描画
      const chars = segment.text.split('');
      let lineText = '';

      for (let i = 0; i < chars.length; i++) {
        const testLine = lineText + chars[i];
        const metrics = ctx.measureText(testLine);

        if (metrics.width > (maxWidth - (currentX - x)) && lineText !== '') {
          ctx.fillText(lineText, currentX, currentY);
          lineText = chars[i];
          currentY += lineHeight;
          currentX = x; // 新しい行は左端から
        } else {
          lineText = testLine;
        }
      }

      if (lineText) {
        ctx.fillText(lineText, currentX, currentY);
        currentX += ctx.measureText(lineText).width;
      }
    }

    currentY += lineHeight;
    // 次の行は左端から
  }

  return currentY;
}

// 箇条書き内画像のサイズ比率（Canvas描画用 - height比率）
const BULLET_IMAGE_SIZE_RATIO: Record<string, number> = {
  S: 0.06,  // height * 0.06
  M: 0.12,  // height * 0.12
  B: 0.18,  // height * 0.18
};

/**
 * base64/data URL画像をロードしてCanvasに描画する
 * カラム幅に収め、object-fit: contain相当
 */
async function drawBulletImageToCanvas(
  ctx: CanvasRenderingContext2D,
  bulletImage: BulletImage,
  x: number,
  y: number,
  maxWidth: number,
  slideHeight: number,
): Promise<{ drawnHeight: number }> {
  const sizeRatio = BULLET_IMAGE_SIZE_RATIO[bulletImage.size] || BULLET_IMAGE_SIZE_RATIO.M;
  const targetHeight = slideHeight * sizeRatio;

  try {
    const img = new (globalThis.Image || HTMLImageElement)();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = bulletImage.src;
    });

    // contain: 幅・高さ制限内に収める
    const scaleX = maxWidth / img.width;
    const scaleY = targetHeight / img.height;
    const scale = Math.min(scaleX, scaleY);
    const imgW = img.width * scale;
    const imgH = img.height * scale;

    // 左寄せで描画
    ctx.drawImage(img, x, y - imgH * 0.5, imgW, imgH);

    return { drawnHeight: imgH };
  } catch (e) {
    console.error('Failed to draw bullet image:', e);
    return { drawnHeight: targetHeight };
  }
}

/**
 * タイムスタンプを生成
 */
export function getTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
}

/**
 * ファイル名をサニタイズ
 */
export function sanitizeFilename(name: string, maxLength: number = 30): string {
  return name
    .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\-]/g, '_')
    .slice(0, maxLength);
}

/**
 * テキストを折り返して描画（Canvas用）
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = text.split('\n');
  let currentY = y;

  for (const paragraph of lines) {
    if (paragraph.trim() === '') {
      currentY += lineHeight * 0.5;
      continue;
    }

    const words = paragraph.split('');
    let line = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i];
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line, x, currentY);
        line = words[i];
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }

    if (line) {
      ctx.fillText(line, x, currentY);
      currentY += lineHeight;
    }
  }

  return currentY;
}

/**
 * スライドをCanvasに描画（テンプレートベース - Single Source of Truth）
 * プレビューと同一のレイアウトルールを適用
 */
async function drawSlideToCanvas(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  x: number,
  y: number,
  width: number,
  height: number,
  chapterTitle?: string,
  sectionTitle?: string
): Promise<void> {
  // テンプレート取得
  const templateId: BaseTemplateId = slide.templateId || DEFAULT_TEMPLATE_ID;

  // テンプレート別のレイアウト設定
  // base1: 左テキスト70% / 右画像30%
  // base2: 左画像30% / 右テキスト70%
  // base3: 2カラムテキスト80% / 右アクセント画像20%
  // base4: 左アクセント画像20% / 2カラムテキスト80%
  // base5: 全文テキスト（画像なし）
  let textWidthPercent: number;
  let imageWidthPercent: number;
  let textPosition: 'left' | 'right' | 'full';
  const columnCount = getEffectiveColumnCount(templateId, slide.columnCount);
  let isAccentImage = false;

  switch (templateId) {
    case 'base1':
      textWidthPercent = 70;
      imageWidthPercent = 30;
      textPosition = 'left';
      break;
    case 'base2':
      textWidthPercent = 70;
      imageWidthPercent = 30;
      textPosition = 'right';
      break;
    case 'base3':
      textWidthPercent = 80;
      imageWidthPercent = 20;
      textPosition = 'left';
      isAccentImage = true;
      break;
    case 'base4':
      textWidthPercent = 80;
      imageWidthPercent = 20;
      textPosition = 'right';
      isAccentImage = true;
      break;
    case 'base5':
      textWidthPercent = 100;
      imageWidthPercent = 0;
      textPosition = 'full';
      break;
    default:
      textWidthPercent = 70;
      imageWidthPercent = 30;
      textPosition = 'left';
  }

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, width, height);

  // 枠線
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  const padding = width * 0.04;
  const textWidth = width * (textWidthPercent / 100);
  const imageWidth = width * (imageWidthPercent / 100);

  // テキストエリアと画像エリアの位置を決定
  let textX: number;
  let imageX: number;

  if (textPosition === 'left' || textPosition === 'full') {
    textX = x;
    imageX = x + textWidth;
  } else {
    // textPosition === 'right' (base2, base4)
    textX = x + imageWidth;
    imageX = x;
  }

  // ===== テキストエリア描画 =====
  // ヘッダー
  ctx.fillStyle = '#94a3b8';
  ctx.font = `${Math.floor(width * 0.015)}px ${FONT_FAMILY}`;
  if (chapterTitle && sectionTitle) {
    ctx.fillText(`${chapterTitle} › ${sectionTitle}`, textX + padding, y + padding + 20);
  }

  // タイトル
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold ${Math.floor(width * 0.035)}px ${FONT_FAMILY}`;
  const titleY = y + padding + 60;
  const titleMaxWidth = textWidth - padding * 2;
  wrapText(ctx, slide.title || 'タイトル未設定', textX + padding, titleY, titleMaxWidth, width * 0.045);

  // 表示モード判定
  const displayMode = slide.displayMode || 'bullets';
  const isBodyMode = displayMode === 'body';

  // コンテンツ描画開始Y座標
  ctx.fillStyle = '#475569';
  let bulletY = titleY + width * 0.08;

  if (isBodyMode) {
    // ===== 本文モード: bodyHtml優先、なければプレーンテキスト =====
    if (slide.bodyHtml && slide.bodyHtml.trim()) {
      // bodyHtml（リッチテキスト）をCanvasに描画
      const bodyFontSize = Math.floor(width * 0.022);
      const bodyLineHeight = width * 0.03;
      drawBodyHtmlToCanvas(
        ctx,
        slide.bodyHtml,
        textX + padding,
        bulletY,
        titleMaxWidth,
        bodyFontSize,
        bodyLineHeight,
      );
    } else {
      // プレーンテキストフォールバック
      const bodyText = slide.bullets.join('\n');
      if (bodyText.trim()) {
        ctx.fillStyle = '#475569';
        ctx.font = `${Math.floor(width * 0.022)}px ${FONT_FAMILY}`;
        wrapText(ctx, bodyText, textX + padding, bulletY, titleMaxWidth, width * 0.03);
      }
    }
  } else {
    // ===== 箇条書きモード（既存） =====

    // カラムごとのドットカラー
    const exportDotColors = ['#2563eb', '#6366f1', '#8b5cf6'];

    // レベル別のスタイル設定（Canvas用）
    const getLevelFont = (level: 1 | 2 | 3, baseSize: number) => {
      if (level === 1) return { font: `bold ${Math.floor(baseSize * 1.2)}px ${FONT_FAMILY}`, color: '#1e293b', dotRadius: 6 };
      if (level === 3) return { font: `${Math.floor(baseSize * 0.85)}px ${FONT_FAMILY}`, color: '#64748b', dotRadius: 4 };
      return { font: `500 ${Math.floor(baseSize)}px ${FONT_FAMILY}`, color: '#475569', dotRadius: 5 };
    };

    if (columnCount > 1 && slide.bullets.length > 1) {
      // マルチカラムレイアウト（共通ヘルパー使用）
      const columns = splitBulletsIntoColumns(slide.bullets, columnCount);
      const columnWidth = (textWidth - padding * (columnCount + 1)) / columnCount;

      let globalOffset = 0;
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const colBullets = columns[colIdx];
        let colY = bulletY;
        const colX = textX + padding + (columnWidth + padding) * colIdx;
        const dotColor = exportDotColors[colIdx] || exportDotColors[0];

        for (let index = 0; index < colBullets.length; index++) {
          const bullet = colBullets[index];
          const globalIdx = globalOffset + index;
          const bulletImage = slide.bulletImages?.[globalIdx];

          // 画像行の場合
          if (bulletImage) {
            const { drawnHeight } = await drawBulletImageToCanvas(
              ctx, bulletImage, colX, colY, columnWidth, height
            );
            colY += drawnHeight + 10;
            continue;
          }

          // 空テキスト行はスキップ（画像プレースホルダ行）
          if (!bullet.trim()) continue;

          const level = getBulletLevel(slide.bulletLevels, globalIdx);
          const levelStyle = getLevelFont(level, width * 0.022);
          ctx.font = levelStyle.font;
          ctx.fillStyle = dotColor;
          ctx.beginPath();
          ctx.arc(colX + 8, colY - 5, levelStyle.dotRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = levelStyle.color;
          colY = wrapText(ctx, bullet, colX + 25, colY, columnWidth - 30, width * 0.028);
          colY += 10;
        }
        globalOffset += colBullets.length;
      }
    } else {
      // 通常の1カラムレイアウト
      for (let index = 0; index < slide.bullets.length; index++) {
        const bullet = slide.bullets[index];
        const bulletImage = slide.bulletImages?.[index];

        // 画像行の場合
        if (bulletImage) {
          const { drawnHeight } = await drawBulletImageToCanvas(
            ctx, bulletImage, textX + padding, bulletY, titleMaxWidth, height
          );
          bulletY += drawnHeight + 10;
          continue;
        }

        // 空テキスト行はスキップ（画像プレースホルダ行）
        if (!bullet.trim()) continue;

        const level = getBulletLevel(slide.bulletLevels, index);
        const levelStyle = getLevelFont(level, width * 0.022);
        ctx.font = levelStyle.font;
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(textX + padding + 8, bulletY - 5, levelStyle.dotRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = levelStyle.color;
        bulletY = wrapText(ctx, bullet, textX + padding + 25, bulletY, titleMaxWidth - 30, width * 0.03);
        bulletY += 10;
      }
    }
  }

  // ===== 画像エリア描画（base5以外） =====
  if (imageWidthPercent > 0) {
    // グラデーション背景
    const gradient = ctx.createLinearGradient(imageX, y, imageX + imageWidth, y + height);
    gradient.addColorStop(0, '#eff6ff');  // blue-50
    gradient.addColorStop(0.5, '#eef2ff'); // indigo-50
    gradient.addColorStop(1, '#faf5ff');  // purple-50
    ctx.fillStyle = gradient;
    ctx.fillRect(imageX, y, imageWidth, height);

    // 画像があれば描画
    const imageSrc = getSlideImageSrc(slide);
    if (hasSlideImage(slide) && imageSrc) {
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = imageSrc;
        });

        // 表示モード決定: slide.imageDisplayMode を最優先、未設定ならテンプレートデフォルト
        const useContainMode = slide.imageDisplayMode
          ? slide.imageDisplayMode === 'contain'
          : isAccentImage;

        if (useContainMode) {
          // contain モード: 画像全体を枠内に収める
          const imgPadding = imageWidth * 0.1;
          const maxImgWidth = imageWidth - imgPadding * 2;
          const maxImgHeight = isAccentImage ? height * 0.6 : height - imgPadding * 2;

          const scaleX = maxImgWidth / img.width;
          const scaleY = maxImgHeight / img.height;
          const scale = Math.min(scaleX, scaleY); // containモードで収める
          const imgW = img.width * scale;
          const imgH = img.height * scale;
          const imgX = imageX + (imageWidth - imgW) / 2;
          const imgY = y + (height - imgH) / 2;

          ctx.drawImage(img, imgX, imgY, imgW, imgH);
        } else {
          // cover モード: 枠を画像で覆う
          const imgPadding = imageWidth * 0.02;
          const maxImgWidth = imageWidth - imgPadding * 2;
          const maxImgHeight = height - imgPadding * 2;

          const scaleX = maxImgWidth / img.width;
          const scaleY = maxImgHeight / img.height;
          const scale = Math.max(scaleX, scaleY); // coverモード
          const imgW = img.width * scale;
          const imgH = img.height * scale;
          const imgDrawX = imageX + (imageWidth - imgW) / 2;
          const imgDrawY = y + (height - imgH) / 2;

          ctx.save();
          ctx.beginPath();
          ctx.rect(imageX, y, imageWidth, height);
          ctx.clip();
          ctx.drawImage(img, imgDrawX, imgDrawY, imgW, imgH);
          ctx.restore();
        }
      } catch (e) {
        console.error('Failed to draw image:', e);
      }
    }
  }
}

/**
 * 通常形式PNG出力（16:9スライド）
 */
export async function exportSlideAsNormalPng(
  slide: Slide,
  chapterTitle?: string,
  sectionTitle?: string,
  courseTitle?: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = SLIDE_WIDTH;
  canvas.height = SLIDE_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  await drawSlideToCanvas(ctx, slide, 0, 0, SLIDE_WIDTH, SLIDE_HEIGHT, chapterTitle, sectionTitle);

  return canvas.toDataURL('image/png');
}

/**
 * ノート形式PNG出力（A4縦: 上スライド、下ノート）
 */
export async function exportSlideAsNotePng(
  slide: Slide,
  pageNumber: number,
  totalPages: number,
  chapterTitle?: string,
  sectionTitle?: string,
  courseTitle?: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = A4_WIDTH;
  canvas.height = A4_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

  const margin = 100;
  const headerHeight = 120;
  const slideAreaHeight = 1400; // A4幅に合わせた16:9スライドの高さ
  const slideWidth = A4_WIDTH - margin * 2;
  const slideHeight = slideWidth * 9 / 16;
  const noteAreaY = headerHeight + slideHeight + 80;

  // ヘッダー
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold 48px ${FONT_FAMILY}`;
  ctx.fillText(courseTitle || '講座資料', margin, 70);

  ctx.fillStyle = '#64748b';
  ctx.font = `36px ${FONT_FAMILY}`;
  ctx.fillText(`Page ${pageNumber} / ${totalPages}`, A4_WIDTH - margin - 200, 70);

  // スライド描画
  await drawSlideToCanvas(
    ctx, slide,
    margin, headerHeight,
    slideWidth, slideHeight,
    chapterTitle, sectionTitle
  );

  // スピーカーノートセクション
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(margin, noteAreaY, A4_WIDTH - margin * 2, A4_HEIGHT - noteAreaY - margin);

  // ノートヘッダー
  ctx.fillStyle = '#92400e';
  ctx.font = `bold 48px ${FONT_FAMILY}`;
  ctx.fillText('🎤 スピーカーノート', margin + 40, noteAreaY + 70);

  // ノート本文（フォントサイズ改善: 可読性向上）
  // 300dpi換算で約16-18pt相当、line-height約1.6相当
  ctx.fillStyle = '#78350f';
  ctx.font = `44px ${FONT_FAMILY}`;
  const noteText = slide.speakerNotes || '（スピーカーノートなし）';
  wrapText(ctx, noteText, margin + 40, noteAreaY + 140, A4_WIDTH - margin * 2 - 80, 72);

  return canvas.toDataURL('image/png');
}

/**
 * 台本のみPNG出力（A4縦）- レガシー版（スピーカーノートベース）
 * @deprecated 新しい exportFullScriptPng を使用してください
 */
export async function exportScriptOnlyPng(
  slide: Slide,
  pageNumber: number,
  totalPages: number,
  chapterTitle?: string,
  sectionTitle?: string,
  courseTitle?: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = A4_WIDTH;
  canvas.height = A4_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

  const margin = 120;
  let currentY = margin;

  // ヘッダー
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold 56px ${FONT_FAMILY}`;
  ctx.fillText(courseTitle || '台本', margin, currentY);
  currentY += 80;

  // ページ番号
  ctx.fillStyle = '#64748b';
  ctx.font = `32px ${FONT_FAMILY}`;
  ctx.fillText(`Page ${pageNumber} / ${totalPages}`, margin, currentY);
  currentY += 60;

  // 章・節タイトル
  if (chapterTitle || sectionTitle) {
    ctx.fillStyle = '#475569';
    ctx.font = `36px ${FONT_FAMILY}`;
    ctx.fillText(`${chapterTitle || ''} › ${sectionTitle || ''}`, margin, currentY);
    currentY += 60;
  }

  // 区切り線
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, currentY);
  ctx.lineTo(A4_WIDTH - margin, currentY);
  ctx.stroke();
  currentY += 60;

  // スライドタイトル
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold 52px ${FONT_FAMILY}`;
  currentY = wrapText(ctx, slide.title || 'タイトル未設定', margin, currentY, A4_WIDTH - margin * 2, 70);
  currentY += 50;

  // 箇条書き（レベル別スタイル対応）
  slide.bullets.forEach((bullet, index) => {
    const level = getBulletLevel(slide.bulletLevels, index);
    const dotRadius = level === 1 ? 12 : level === 3 ? 8 : 10;
    const fontStyle = level === 1 ? `bold 48px ${FONT_FAMILY}` : level === 3 ? `36px ${FONT_FAMILY}` : `40px ${FONT_FAMILY}`;
    const textColor = level === 1 ? '#1e293b' : level === 3 ? '#64748b' : '#334155';

    ctx.font = fontStyle;
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(margin + 15, currentY - 12, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = textColor;
    currentY = wrapText(ctx, bullet, margin + 45, currentY, A4_WIDTH - margin * 2 - 50, 56);
    currentY += 20;
  });

  currentY += 40;

  // スピーカーノート（フォントサイズ改善: 可読性向上）
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(margin, currentY, A4_WIDTH - margin * 2, A4_HEIGHT - currentY - margin);

  ctx.fillStyle = '#92400e';
  ctx.font = `bold 48px ${FONT_FAMILY}`;
  ctx.fillText('🎤 話す内容', margin + 40, currentY + 70);

  // 300dpi換算で約16-18pt相当、line-height約1.6相当
  ctx.fillStyle = '#78350f';
  ctx.font = `46px ${FONT_FAMILY}`;
  const noteText = slide.speakerNotes || '（スピーカーノートなし）';
  wrapText(ctx, noteText, margin + 40, currentY + 140, A4_WIDTH - margin * 2 - 80, 76);

  return canvas.toDataURL('image/png');
}

/**
 * 台本データ（セクション単位）
 */
export interface SectionScriptData {
  chapterTitle: string;
  sectionTitle: string;
  blocks: ScriptBlock[];
}

/**
 * 台本専用PNG出力（A4縦）- 中央エディタの長文台本を出力
 * スピーカーノート（要約）ではなく、実際の台本（body/bullet/note）を出力
 */
export async function exportFullScriptPng(
  sectionData: SectionScriptData,
  pageNumber: number,
  totalPages: number,
  courseTitle?: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = A4_WIDTH;
  canvas.height = A4_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

  const margin = 120;
  let currentY = margin;

  // ヘッダー: 講座タイトル
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold 52px ${FONT_FAMILY}`;
  ctx.fillText(courseTitle || '台本', margin, currentY);
  currentY += 70;

  // ページ番号
  ctx.fillStyle = '#64748b';
  ctx.font = `32px ${FONT_FAMILY}`;
  ctx.fillText(`Page ${pageNumber} / ${totalPages}`, margin, currentY);
  currentY += 50;

  // 章・節タイトル
  ctx.fillStyle = '#475569';
  ctx.font = `36px ${FONT_FAMILY}`;
  ctx.fillText(`${sectionData.chapterTitle} › ${sectionData.sectionTitle}`, margin, currentY);
  currentY += 50;

  // 区切り線
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(margin, currentY);
  ctx.lineTo(A4_WIDTH - margin, currentY);
  ctx.stroke();
  currentY += 50;

  // セクションタイトル（heading2相当）
  ctx.fillStyle = '#1e293b';
  ctx.font = `bold 48px ${FONT_FAMILY}`;
  currentY = wrapText(ctx, sectionData.sectionTitle, margin, currentY, A4_WIDTH - margin * 2, 64);
  currentY += 40;

  // 台本ブロックを順番に出力
  for (const block of sectionData.blocks) {
    // ページ内に収まるかチェック（余白100px確保）
    if (currentY > A4_HEIGHT - 200) {
      // ページ境界を示す（実際は複数ページ対応が必要だが、簡易版として警告表示）
      ctx.fillStyle = '#ef4444';
      ctx.font = `italic 32px ${FONT_FAMILY}`;
      ctx.fillText('（続きは次ページ）', margin, currentY);
      break;
    }

    switch (block.type) {
      case 'heading1':
        // 章見出し
        ctx.fillStyle = '#1e40af';
        ctx.font = `bold 48px ${FONT_FAMILY}`;
        currentY = wrapText(ctx, block.content, margin, currentY, A4_WIDTH - margin * 2, 64);
        currentY += 30;
        break;

      case 'heading2':
        // 小見出し（既にセクションタイトルとして出力済みの場合はスキップ可）
        ctx.fillStyle = '#1e293b';
        ctx.font = `bold 44px ${FONT_FAMILY}`;
        currentY = wrapText(ctx, block.content, margin, currentY, A4_WIDTH - margin * 2, 60);
        currentY += 25;
        break;

      case 'bullet':
        // 箇条書き
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(margin + 15, currentY - 10, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#334155';
        ctx.font = `40px ${FONT_FAMILY}`;
        currentY = wrapText(ctx, block.content, margin + 40, currentY, A4_WIDTH - margin * 2 - 50, 54);
        currentY += 20;
        break;

      case 'body':
        // 本文（台本の主要部分）
        ctx.fillStyle = '#1e293b';
        ctx.font = `42px ${FONT_FAMILY}`;
        currentY = wrapText(ctx, block.content, margin, currentY, A4_WIDTH - margin * 2, 58);
        currentY += 25;
        break;

      case 'note':
        // 補足（薄い背景で区別）
        const noteBoxY = currentY - 15;
        const noteContent = block.content;

        // 補足の背景
        ctx.fillStyle = '#f1f5f9';
        const estimatedNoteHeight = Math.ceil(noteContent.length / 30) * 50 + 40;
        ctx.fillRect(margin, noteBoxY, A4_WIDTH - margin * 2, Math.min(estimatedNoteHeight, 300));

        ctx.fillStyle = '#64748b';
        ctx.font = `italic 36px ${FONT_FAMILY}`;
        ctx.fillText('💡 補足:', margin + 20, currentY + 5);
        currentY += 35;

        ctx.fillStyle = '#475569';
        ctx.font = `38px ${FONT_FAMILY}`;
        currentY = wrapText(ctx, noteContent, margin + 20, currentY, A4_WIDTH - margin * 2 - 40, 52);
        currentY += 30;
        break;

      default:
        // その他のタイプ
        ctx.fillStyle = '#64748b';
        ctx.font = `38px ${FONT_FAMILY}`;
        currentY = wrapText(ctx, block.content, margin, currentY, A4_WIDTH - margin * 2, 52);
        currentY += 20;
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * 全セクションの台本を一括ダウンロード
 */
export async function exportAllScripts(
  sections: SectionScriptData[],
  courseTitle: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const timestamp = getTimestamp();
  const baseName = sanitizeFilename(courseTitle);
  const total = sections.length;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    onProgress?.(i + 1, total);

    const dataUrl = await exportFullScriptPng(section, i + 1, total, courseTitle);
    const sectionName = sanitizeFilename(section.sectionTitle, 20);
    const filename = `${baseName}_台本_${String(i + 1).padStart(3, '0')}_${sectionName}_${timestamp}.png`;

    downloadDataUrl(dataUrl, filename);

    // ブラウザが処理できるよう少し待つ
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

/**
 * DataURLからダウンロード実行
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/**
 * 全ページを一括ダウンロード
 */
export async function exportAllPages(
  slides: { slide: Slide; chapterTitle?: string; sectionTitle?: string }[],
  mode: 'normal' | 'note' | 'script',
  courseTitle: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const timestamp = getTimestamp();
  const baseName = sanitizeFilename(courseTitle);
  const total = slides.length;

  for (let i = 0; i < slides.length; i++) {
    const { slide, chapterTitle, sectionTitle } = slides[i];
    onProgress?.(i + 1, total);

    let dataUrl: string;
    let suffix: string;

    if (mode === 'normal') {
      dataUrl = await exportSlideAsNormalPng(slide, chapterTitle, sectionTitle, courseTitle);
      suffix = 'slide';
    } else if (mode === 'note') {
      dataUrl = await exportSlideAsNotePng(slide, i + 1, total, chapterTitle, sectionTitle, courseTitle);
      suffix = 'note';
    } else {
      dataUrl = await exportScriptOnlyPng(slide, i + 1, total, chapterTitle, sectionTitle, courseTitle);
      suffix = 'script';
    }

    const slideTitle = sanitizeFilename(slide.title || 'slide', 20);
    const filename = `${baseName}_${String(i + 1).padStart(3, '0')}_${slideTitle}_${suffix}_${timestamp}.png`;

    downloadDataUrl(dataUrl, filename);

    // ブラウザが処理できるよう少し待つ
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

// =====================================================
// ZIP一括ダウンロード
// =====================================================

/**
 * DataURLをUint8Arrayに変換（ZIP用）
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
}

/**
 * ZIPのBlobからダウンロード実行
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  // メモリ解放
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 全ページをZIPで一括ダウンロード
 */
export async function exportAllPagesAsZip(
  slides: { slide: Slide; chapterTitle?: string; sectionTitle?: string }[],
  mode: 'normal' | 'note' | 'script',
  courseTitle: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const timestamp = getTimestamp();
  const baseName = sanitizeFilename(courseTitle);
  const total = slides.length;

  for (let i = 0; i < slides.length; i++) {
    const { slide, chapterTitle, sectionTitle } = slides[i];
    onProgress?.(i + 1, total);

    let dataUrl: string;
    let suffix: string;

    if (mode === 'normal') {
      dataUrl = await exportSlideAsNormalPng(slide, chapterTitle, sectionTitle, courseTitle);
      suffix = 'slide';
    } else if (mode === 'note') {
      dataUrl = await exportSlideAsNotePng(slide, i + 1, total, chapterTitle, sectionTitle, courseTitle);
      suffix = 'note';
    } else {
      dataUrl = await exportScriptOnlyPng(slide, i + 1, total, chapterTitle, sectionTitle, courseTitle);
      suffix = 'script';
    }

    const slideTitle = sanitizeFilename(slide.title || 'slide', 20);
    const filename = `${String(i + 1).padStart(3, '0')}_${slideTitle}_${suffix}.png`;

    // 逐次ZIPに追加（メモリ効率のため都度変換）
    zip.file(filename, dataUrlToUint8Array(dataUrl));
  }

  // ZIP生成 & ダウンロード
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `${baseName}_${mode}_${timestamp}.zip`;
  downloadBlob(zipBlob, zipFilename);
}

/**
 * 全台本をZIPで一括ダウンロード
 */
export async function exportAllScriptsAsZip(
  sections: SectionScriptData[],
  courseTitle: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  const timestamp = getTimestamp();
  const baseName = sanitizeFilename(courseTitle);
  const total = sections.length;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    onProgress?.(i + 1, total);

    const dataUrl = await exportFullScriptPng(section, i + 1, total, courseTitle);
    const sectionName = sanitizeFilename(section.sectionTitle, 20);
    const filename = `${String(i + 1).padStart(3, '0')}_${sectionName}_台本.png`;

    zip.file(filename, dataUrlToUint8Array(dataUrl));
  }

  // ZIP生成 & ダウンロード
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `${baseName}_台本_${timestamp}.zip`;
  downloadBlob(zipBlob, zipFilename);
}

/**
 * DeckModal用：DataURL配列からZIPで一括ダウンロード
 * （html-to-imageで生成済みのDataURLを直接受け取る）
 */
export async function exportDataUrlsAsZip(
  items: { dataUrl: string; filename: string }[],
  zipFilename: string
): Promise<void> {
  const zip = new JSZip();

  for (const item of items) {
    zip.file(item.filename, dataUrlToUint8Array(item.dataUrl));
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, zipFilename);
}

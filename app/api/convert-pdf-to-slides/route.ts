/**
 * PDF→PNG→スライド変換API
 *
 * POST /api/convert-pdf-to-slides
 *
 * - NotebookLMからダウンロードしたPDFを受け取る
 * - pdftoppm (poppler) で各ページをPNGに変換
 * - スライドオブジェクトの配列を返す
 *
 * 前提条件:
 * - サーバーにpopplerがインストールされていること
 * - `brew install poppler` (macOS)
 * - `apt-get install poppler-utils` (Ubuntu/Debian)
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Slide, SlideSourceType } from '@/lib/types';

const execAsync = promisify(exec);

// レスポンスの型
interface ConvertResponse {
  success: boolean;
  slides?: Slide[];
  error?: string;
  debug?: {
    pdfSize: number;
    pageCount: number;
    outputResolution: number;
    conversionTimeMs: number;
  };
}

// 一時ディレクトリを作成
async function createTempDir(): Promise<string> {
  const tempBase = os.tmpdir();
  const dirName = `pdf-convert-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tempDir = path.join(tempBase, dirName);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
}

// 一時ディレクトリを削除
async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (e) {
    console.warn('[convert-pdf] Cleanup failed:', e);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ConvertResponse>> {
  console.log('[convert-pdf] === POST REQUEST ===');
  const startTime = Date.now();
  let tempDir: string | null = null;

  try {
    // マルチパートフォームデータを取得
    const formData = await request.formData();
    const pdfFile = formData.get('file') as File | null;
    const chapterId = formData.get('chapterId') as string || 'chapter-1';
    const sectionId = formData.get('sectionId') as string || 'section-1';
    const resolutionStr = formData.get('resolution') as string || '200';
    const resolution = parseInt(resolutionStr, 10) || 200;

    console.log('[convert-pdf] ChapterId:', chapterId);
    console.log('[convert-pdf] SectionId:', sectionId);
    console.log('[convert-pdf] Resolution:', resolution, 'DPI');

    if (!pdfFile) {
      console.error('[convert-pdf] No PDF file provided');
      return NextResponse.json({
        success: false,
        error: 'PDFファイルが見つかりません',
      }, { status: 400 });
    }

    console.log('[convert-pdf] File name:', pdfFile.name);
    console.log('[convert-pdf] File size:', pdfFile.size, 'bytes');
    console.log('[convert-pdf] File type:', pdfFile.type);

    // PDFファイルかチェック
    if (!pdfFile.type.includes('pdf') && !pdfFile.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({
        success: false,
        error: 'PDFファイルのみ対応しています',
      }, { status: 400 });
    }

    // 一時ディレクトリを作成
    tempDir = await createTempDir();
    const pdfPath = path.join(tempDir, 'input.pdf');
    const outputPrefix = path.join(tempDir, 'slide');

    console.log('[convert-pdf] Temp dir:', tempDir);

    // PDFを一時ファイルに保存
    const arrayBuffer = await pdfFile.arrayBuffer();
    await fs.writeFile(pdfPath, Buffer.from(arrayBuffer));

    console.log('[convert-pdf] PDF saved to:', pdfPath);

    // pdftoppmでPNGに変換
    // -png: PNG形式で出力
    // -r: 解像度（DPI）
    const command = `pdftoppm -png -r ${resolution} "${pdfPath}" "${outputPrefix}"`;
    console.log('[convert-pdf] Running command:', command);

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
      if (stderr) {
        console.log('[convert-pdf] pdftoppm stderr:', stderr);
      }
    } catch (execError: any) {
      console.error('[convert-pdf] pdftoppm error:', execError.message);

      // pdftoppmが見つからない場合
      if (execError.message.includes('not found') || execError.message.includes('command not found')) {
        return NextResponse.json({
          success: false,
          error: 'PDF変換ツール(poppler)がインストールされていません。サーバー管理者に連絡してください。',
        }, { status: 500 });
      }

      throw execError;
    }

    // 生成されたPNGファイルを取得
    const files = await fs.readdir(tempDir);
    const pngFiles = files
      .filter(f => f.endsWith('.png'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    console.log('[convert-pdf] Generated PNG files:', pngFiles.length);

    if (pngFiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'PDF変換に失敗しました。ページが見つかりません。',
      }, { status: 500 });
    }

    // スライドを生成
    const slides: Slide[] = [];
    const now = new Date();

    for (let i = 0; i < pngFiles.length; i++) {
      const pngFilename = pngFiles[i];
      const pngPath = path.join(tempDir, pngFilename);

      console.log(`[convert-pdf] Processing ${i + 1}/${pngFiles.length}: ${pngFilename}`);

      // PNGをBase64に変換
      const pngBuffer = await fs.readFile(pngPath);
      const base64 = pngBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      // スライドオブジェクトを作成
      const slide: Slide = {
        slideId: `notebooklm-pdf-${Date.now()}-${i}`,
        sectionId: sectionId,
        order: i,
        title: `スライド ${i + 1}`,
        bullets: [],
        speakerNotes: '',
        layoutType: 'title_only',
        editedByUser: false,
        locked: false,
        createdAt: now,
        updatedAt: now,
        // NotebookLM固有フィールド
        sourceType: 'notebooklm' as SlideSourceType,
        pngDataUrl: dataUrl,
      };

      slides.push(slide);
    }

    const conversionTime = Date.now() - startTime;
    console.log('[convert-pdf] Conversion completed in', conversionTime, 'ms');
    console.log('[convert-pdf] Generated slides:', slides.length);

    // クリーンアップ
    await cleanupTempDir(tempDir);

    return NextResponse.json({
      success: true,
      slides: slides,
      debug: {
        pdfSize: pdfFile.size,
        pageCount: slides.length,
        outputResolution: resolution,
        conversionTimeMs: conversionTime,
      },
    });

  } catch (error: any) {
    console.error('[convert-pdf] Exception:', error?.message);
    console.error('[convert-pdf] Stack:', error?.stack?.substring(0, 500));

    // クリーンアップ
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }

    return NextResponse.json({
      success: false,
      error: error?.message || '不明なエラーが発生しました',
    }, { status: 500 });
  }
}

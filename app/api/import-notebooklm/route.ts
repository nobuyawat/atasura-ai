/**
 * NotebookLM スライド取り込みAPI
 *
 * POST /api/import-notebooklm
 *
 * - ZIPファイルを受け取り、中のPNG画像をスライドとして返す
 * - ファイル名の昇順（001.png, 002.png, ...）でスライド順を決定
 * - notes.json があればスピーカーノートとして読み込む
 * - mode="replace" で既存スライドを完全置換
 */

import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { Slide, SlideSourceType } from '@/lib/types';

// リクエストボディの型
interface ImportRequest {
  mode: 'replace';
  chapterId: string;
  sectionId: string;
}

// notes.json の型
interface NotesData {
  slides?: {
    [filename: string]: {
      title?: string;
      speakerNotes?: string;
    };
  };
}

// レスポンスの型
interface ImportResponse {
  success: boolean;
  slides?: Slide[];
  error?: string;
  debug?: {
    filesFound: string[];
    pngCount: number;
    hasNotesJson: boolean;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportResponse>> {
  console.log('[import-notebooklm] === POST REQUEST ===');

  try {
    // マルチパートフォームデータを取得
    const formData = await request.formData();
    const zipFile = formData.get('file') as File | null;
    const mode = formData.get('mode') as string || 'replace';
    const chapterId = formData.get('chapterId') as string || 'chapter-1';
    const sectionId = formData.get('sectionId') as string || 'section-1';

    console.log('[import-notebooklm] Mode:', mode);
    console.log('[import-notebooklm] ChapterId:', chapterId);
    console.log('[import-notebooklm] SectionId:', sectionId);

    if (!zipFile) {
      console.error('[import-notebooklm] No file provided');
      return NextResponse.json({
        success: false,
        error: 'ZIPファイルが見つかりません',
      }, { status: 400 });
    }

    console.log('[import-notebooklm] File name:', zipFile.name);
    console.log('[import-notebooklm] File size:', zipFile.size, 'bytes');
    console.log('[import-notebooklm] File type:', zipFile.type);

    // ZIPファイルを読み込む
    const arrayBuffer = await zipFile.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // ZIPの中身を確認
    const allFiles = Object.keys(zip.files);
    console.log('[import-notebooklm] Files in ZIP:', allFiles);

    // PNGファイルをフィルタリング（ディレクトリを除く）
    const pngFiles = allFiles
      .filter(name => {
        const lower = name.toLowerCase();
        return lower.endsWith('.png') && !zip.files[name].dir;
      })
      .sort((a, b) => {
        // ファイル名で昇順ソート（001.png, 002.png, ...）
        const aName = a.split('/').pop() || a;
        const bName = b.split('/').pop() || b;
        return aName.localeCompare(bName, undefined, { numeric: true });
      });

    console.log('[import-notebooklm] PNG files:', pngFiles);
    console.log('[import-notebooklm] PNG count:', pngFiles.length);

    if (pngFiles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'ZIPファイル内にPNG画像が見つかりません',
        debug: {
          filesFound: allFiles,
          pngCount: 0,
          hasNotesJson: false,
        },
      }, { status: 400 });
    }

    // notes.json を探す
    let notesData: NotesData = {};
    const notesJsonPath = allFiles.find(name =>
      name.toLowerCase().endsWith('notes.json')
    );
    if (notesJsonPath) {
      try {
        const notesContent = await zip.files[notesJsonPath].async('string');
        notesData = JSON.parse(notesContent);
        console.log('[import-notebooklm] notes.json found and parsed');
      } catch (e) {
        console.warn('[import-notebooklm] Failed to parse notes.json:', e);
      }
    }

    // スライドを生成
    const slides: Slide[] = [];
    const now = new Date();

    for (let i = 0; i < pngFiles.length; i++) {
      const pngPath = pngFiles[i];
      const filename = pngPath.split('/').pop() || pngPath;

      console.log(`[import-notebooklm] Processing ${i + 1}/${pngFiles.length}: ${filename}`);

      // PNG画像をBase64に変換
      const pngData = await zip.files[pngPath].async('base64');
      const dataUrl = `data:image/png;base64,${pngData}`;

      // notes.json からメタデータを取得
      const noteInfo = notesData.slides?.[filename] || {};
      const title = noteInfo.title || `スライド ${i + 1}`;
      const speakerNotes = noteInfo.speakerNotes || '';

      // スライドオブジェクトを作成
      const slide: Slide = {
        slideId: `notebooklm-slide-${Date.now()}-${i}`,
        sectionId: sectionId,
        order: i,
        title: title,
        bullets: [],  // NotebookLMスライドは箇条書きなし
        speakerNotes: speakerNotes,
        layoutType: 'title_only',  // 完成スライドなのでレイアウトは関係なし
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

    console.log('[import-notebooklm] Generated slides:', slides.length);
    console.log('[import-notebooklm] First slide title:', slides[0]?.title);

    return NextResponse.json({
      success: true,
      slides: slides,
      debug: {
        filesFound: allFiles,
        pngCount: pngFiles.length,
        hasNotesJson: !!notesJsonPath,
      },
    });

  } catch (error: any) {
    console.error('[import-notebooklm] Exception:', error?.message);
    console.error('[import-notebooklm] Stack:', error?.stack?.substring(0, 500));

    return NextResponse.json({
      success: false,
      error: error?.message || '不明なエラーが発生しました',
    }, { status: 500 });
  }
}

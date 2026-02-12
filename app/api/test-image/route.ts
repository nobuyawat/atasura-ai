import { NextRequest, NextResponse } from 'next/server';
import {
  generateSlideImage,
  testImageGeneration,
  listAvailableModels,
  ImageGenerationResult
} from '@/lib/gemini';

// =====================================================
// 画像生成テスト用エンドポイント
// GET /api/test-image → 実際に画像生成を実行
// GET /api/test-image?action=list-models → モデル一覧のみ
// POST /api/test-image → カスタムパラメータでテスト
// =====================================================

// GETリクエスト：画像生成テスト実行
export async function GET(request: NextRequest): Promise<NextResponse> {
  console.log('[test-image] === GET REQUEST ===');
  const timestamp = new Date().toISOString();

  const apiKey = process.env.GEMINI_API_KEY;
  const apiKeyExists = !!apiKey;
  const apiKeyPrefix = apiKey ? apiKey.substring(0, 10) + '...' : undefined;

  console.log('[test-image] API Key exists:', apiKeyExists);

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // action=list-models の場合はモデル一覧のみ
  if (action === 'list-models') {
    console.log('[test-image] Action: list-models');
    const models = await listAvailableModels();
    return NextResponse.json({
      success: true,
      action: 'list-models',
      models,
      testInfo: {
        timestamp,
        apiKeyExists,
        apiKeyPrefix,
      },
    });
  }

  // デフォルト：画像生成テスト実行
  console.log('[test-image] Action: generate-image (default)');

  try {
    const result = await testImageGeneration();

    console.log('[test-image] Result status:', result.status);

    // 成功時はbase64の一部も返す（確認用）
    const responseData: any = {
      success: result.status === 'success',
      result: {
        status: result.status,
        mimeType: result.mimeType,
        errorMessage: result.errorMessage,
        debugInfo: result.debugInfo,
      },
      availableModels: result.availableModels,
      testInfo: {
        timestamp,
        apiKeyExists,
        apiKeyPrefix,
      },
    };

    if (result.status === 'success' && result.base64) {
      responseData.result.base64Length = result.base64.length;
      responseData.result.base64Preview = result.base64.substring(0, 100) + '...';
      // 実際の画像も返す（テスト確認用）
      responseData.result.base64 = result.base64;
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('[test-image] Exception:', error?.message);
    return NextResponse.json({
      success: false,
      result: {
        status: 'failed',
        errorMessage: error?.message || '不明なエラー',
      },
      testInfo: {
        timestamp,
        apiKeyExists,
        apiKeyPrefix,
      },
    }, { status: 500 });
  }
}

// POSTリクエスト：カスタムパラメータでテスト
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[test-image] === POST REQUEST ===');
  const timestamp = new Date().toISOString();

  const apiKey = process.env.GEMINI_API_KEY;
  const apiKeyExists = !!apiKey;
  const apiKeyPrefix = apiKey ? apiKey.substring(0, 10) + '...' : undefined;

  try {
    const body = await request.json();
    const {
      visualPrompt = 'Modern flat icons representing business concepts with soft gradients',
    } = body;

    console.log('[test-image] visualPrompt:', visualPrompt);

    // visualPrompt のみを使用（title/bullets は混ぜない）
    const result = await generateSlideImage(visualPrompt);

    console.log('[test-image] Result status:', result.status);

    const responseData: any = {
      success: result.status === 'success',
      result: {
        status: result.status,
        mimeType: result.mimeType,
        errorMessage: result.errorMessage,
        debugInfo: result.debugInfo,
      },
      testInfo: {
        timestamp,
        apiKeyExists,
        apiKeyPrefix,
        testParams: { visualPrompt },
      },
    };

    if (result.status === 'success' && result.base64) {
      responseData.result.base64Length = result.base64.length;
      responseData.result.base64Preview = result.base64.substring(0, 100) + '...';
      responseData.result.base64 = result.base64;
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('[test-image] Exception:', error?.message);
    return NextResponse.json({
      success: false,
      result: {
        status: 'failed',
        errorMessage: error?.message || '不明なエラー',
      },
      testInfo: {
        timestamp,
        apiKeyExists,
        apiKeyPrefix,
      },
    }, { status: 500 });
  }
}

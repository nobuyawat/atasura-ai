/**
 * Gemini AI クライアント設定
 *
 * テキスト生成: Gemini 2.0 Flash
 * 画像生成: Imagen 4 (imagen-4.0-generate-001)
 * 環境変数: GEMINI_API_KEY
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ImageGenerationStatus } from './types';

// Gemini クライアント（シングルトン）
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

export function getGeminiModel(): GenerativeModel {
  if (!model) {
    const client = getGeminiClient();
    model = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4096,
      },
    });
  }
  return model;
}

/**
 * 利用可能なモデル一覧を取得（デバッグ用）
 */
export async function listAvailableModels(): Promise<{ all: string[]; imagen: string[] }> {
  console.log('[Gemini] Listing available models...');
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[Gemini] API key not set');
    return { all: [], imagen: [] };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Gemini] Failed to list models:', response.status, errorText);
      return { all: [], imagen: [] };
    }

    const data = await response.json();
    const models = (data.models || []).map((m: any) => m.name);

    // Imagen モデルをフィルタリング
    const imagenModels = models.filter((name: string) =>
      name.includes('imagen')
    );

    console.log('[Gemini] Total models:', models.length);
    console.log('[Gemini] Imagen models:', imagenModels);

    return { all: models, imagen: imagenModels };
  } catch (error: any) {
    console.error('[Gemini] Error listing models:', error?.message);
    return { all: [], imagen: [] };
  }
}

/** Gemini APIレスポンスにトークン情報を付加した型 */
export interface GeminiResponseWithTokens {
  text: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  durationMs: number;
}

/**
 * リトライ付きでGemini APIを呼び出す
 */
export async function callGeminiWithRetry(
  prompt: string,
  maxRetries: number = 2
): Promise<string> {
  const result = await callGeminiWithRetryAndTokens(prompt, maxRetries);
  return result.text;
}

/**
 * リトライ付きでGemini APIを呼び出す（トークン情報付き）
 * 裏側のトークンログ保存に使用
 */
export async function callGeminiWithRetryAndTokens(
  prompt: string,
  maxRetries: number = 2
): Promise<GeminiResponseWithTokens> {
  let lastError: Error | null = null;
  const startTime = Date.now();

  console.log('[Gemini] callGeminiWithRetry started, prompt length:', prompt.length);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Gemini] Attempt ${attempt + 1}/${maxRetries + 1}`);
      const geminiModel = getGeminiModel();
      console.log('[Gemini] Model obtained, calling generateContent...');
      const result = await geminiModel.generateContent(prompt);
      console.log('[Gemini] generateContent completed, getting response...');
      const response = await result.response;

      if (!response) {
        throw new Error('Gemini API returned null/undefined response');
      }

      const text = response.text();
      console.log('[Gemini] Response text length:', text?.length || 0);

      if (!text) {
        throw new Error('Gemini API returned empty text');
      }

      // トークン使用量をログ出力
      const usageMetadata = (response as any).usageMetadata;
      if (usageMetadata) {
        console.log('[Gemini] Token usage:', JSON.stringify(usageMetadata));
      }

      return {
        text,
        usageMetadata: usageMetadata ? {
          promptTokenCount: usageMetadata.promptTokenCount,
          candidatesTokenCount: usageMetadata.candidatesTokenCount,
          totalTokenCount: usageMetadata.totalTokenCount,
        } : undefined,
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('[Gemini] Error occurred:', error?.message || error);
      console.error('[Gemini] Error status:', error?.status, 'code:', error?.code);
      lastError = error;
      const status = error?.status || error?.code;

      // 429, 503, 529 はリトライ対象
      if ([429, 503, 529].includes(status) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[Gemini] Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  console.error('[Gemini] All retries exhausted');
  throw lastError || new Error('Unknown error during Gemini API call');
}

/** generateJSONの結果（トークン情報付き） */
export interface GenerateJSONResultWithTokens<T> {
  data: T;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  durationMs: number;
}

/**
 * JSONをパースし、失敗したら再試行
 */
export async function generateJSON<T>(
  prompt: string,
  retryPromptSuffix: string = '\n\n重要: 必ずJSONのみで応答してください。説明文は不要です。'
): Promise<T> {
  const result = await generateJSONWithTokens<T>(prompt, retryPromptSuffix);
  return result.data;
}

/**
 * JSONをパースし、失敗したら再試行（トークン情報付き）
 */
export async function generateJSONWithTokens<T>(
  prompt: string,
  retryPromptSuffix: string = '\n\n重要: 必ずJSONのみで応答してください。説明文は不要です。'
): Promise<GenerateJSONResultWithTokens<T>> {
  console.log('[Gemini] generateJSON started');

  let response = await callGeminiWithRetryAndTokens(prompt);
  console.log('[Gemini] First attempt raw text received, length:', response.text?.length || 0);

  try {
    const parsed = parseJSONFromText<T>(response.text);
    console.log('[Gemini] JSON parse successful on first attempt');
    return {
      data: parsed,
      usageMetadata: response.usageMetadata,
      durationMs: response.durationMs,
    };
  } catch (parseError: any) {
    console.log('[Gemini] JSON parse failed:', parseError?.message);
    console.log('[Gemini] Raw text preview:', response.text?.substring(0, 200));
    console.log('[Gemini] Retrying with stricter prompt');

    response = await callGeminiWithRetryAndTokens(prompt + retryPromptSuffix);
    console.log('[Gemini] Second attempt raw text received, length:', response.text?.length || 0);

    const parsed = parseJSONFromText<T>(response.text);
    console.log('[Gemini] JSON parse successful on second attempt');
    return {
      data: parsed,
      usageMetadata: response.usageMetadata,
      durationMs: response.durationMs,
    };
  }
}

// =====================================================
// 画像生成（Imagen 4 正規API）
// =====================================================

// 画像生成結果の型
export interface ImageGenerationResult {
  status: ImageGenerationStatus;
  base64?: string;
  mimeType?: string;
  errorMessage?: string;
  debugInfo?: {
    model: string;
    endpoint: string;
    httpStatus?: number;
    errorBody?: string;
  };
}

// Imagen 4 モデル（高速版を優先）
const IMAGEN_MODEL_FAST = 'imagen-4.0-fast-generate-001';
const IMAGEN_MODEL_STANDARD = 'imagen-4.0-generate-001';
const IMAGEN_MODEL_ULTRA = 'imagen-4.0-ultra-generate-001';

// 使用するモデル（fast を第一優先）
const IMAGEN_MODEL = IMAGEN_MODEL_FAST;

/**
 * スライド用画像を生成（Imagen 4 正規API）
 *
 * 重要：画像生成は visualPrompt のみを使用する
 * title/bullets/bodyText を混ぜると日本語文字化けの原因になる
 *
 * @param visualPrompt 画像専用プロンプト（英語推奨）
 * @returns 画像生成結果（ステータス付き）
 */
export async function generateSlideImage(
  visualPrompt: string
): Promise<ImageGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  // エンドポイント（Imagen 4 の predict メソッド）
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`;

  console.log('');
  console.log('='.repeat(70));
  console.log('[Imagen4] === IMAGE GENERATION START ===');
  console.log('[Imagen4] Model:', IMAGEN_MODEL);
  console.log('[Imagen4] Endpoint:', endpoint);
  console.log('[Imagen4] Visual Prompt:', visualPrompt);

  if (!apiKey) {
    console.error('[Imagen4] ❌ API key not set');
    return {
      status: 'failed',
      errorMessage: 'GEMINI_API_KEY未設定',
      debugInfo: { model: IMAGEN_MODEL, endpoint },
    };
  }
  console.log('[Imagen4] API key:', apiKey.substring(0, 10) + '...');

  // 画像生成プロンプト（最小要件版）
  // visualPromptは既に英訳済み（route.tsで翻訳）
  // 固定要件は最小限に抑え、Imagenが要件文を描画するのを防ぐ
  const prompt = `${visualPrompt}

Single image, single scene. Clear main subject, high detail. No watermark.`;

  // dev時のみ最終プロンプト全文をログ出力
  if (process.env.NODE_ENV === 'development') {
    console.log('[Imagen4] ===== FULL PROMPT START =====');
    console.log(prompt);
    console.log('[Imagen4] ===== FULL PROMPT END =====');
  }
  console.log('[Imagen4] Prompt length:', prompt.length);

  // Imagen 4 リクエストボディ
  const requestBody = {
    instances: [
      { prompt }
    ],
    parameters: {
      sampleCount: 1,
      // aspectRatio: '16:9',  // サポートされていない場合はコメントアウト
      // 安全フィルタ（block_low_and_above のみサポート）
      safetySetting: 'block_low_and_above',
    }
  };

  console.log('[Imagen4] Request body:', JSON.stringify(requestBody, null, 2));
  console.log('[Imagen4] Calling Imagen 4 API...');

  try {
    const startTime = Date.now();
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    const elapsed = Date.now() - startTime;

    console.log('[Imagen4] Response received in', elapsed, 'ms');
    console.log('[Imagen4] HTTP Status:', response.status, response.statusText);

    // レスポンスボディを取得
    const responseText = await response.text();
    console.log('[Imagen4] Response body length:', responseText.length);

    if (!response.ok) {
      // === 失敗時：詳細ログ ===
      console.error('[Imagen4] ❌ API ERROR');
      console.error('[Imagen4] HTTP Status:', response.status);
      console.error('[Imagen4] Response body (full):');
      console.error(responseText.substring(0, 2000));
      console.log('='.repeat(70));

      // エラーメッセージを抽出
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(responseText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson.error?.status) {
          errorMessage = `${errorJson.error.status}: ${errorJson.error.message || 'Unknown'}`;
        }
      } catch {
        errorMessage = responseText.substring(0, 200);
      }

      return {
        status: 'failed',
        errorMessage: errorMessage,
        debugInfo: {
          model: IMAGEN_MODEL,
          endpoint,
          httpStatus: response.status,
          errorBody: responseText.substring(0, 1000),
        },
      };
    }

    // === 成功時：レスポンスをパース ===
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[Imagen4] Failed to parse response JSON');
      return {
        status: 'failed',
        errorMessage: 'Response JSON parse failed',
        debugInfo: {
          model: IMAGEN_MODEL,
          endpoint,
          httpStatus: response.status,
          errorBody: responseText.substring(0, 500),
        },
      };
    }

    console.log('[Imagen4] Response JSON keys:', Object.keys(data));

    // predictions から画像を取得
    const predictions = data.predictions || [];
    console.log('[Imagen4] Predictions count:', predictions.length);

    if (predictions.length > 0) {
      const prediction = predictions[0];
      console.log('[Imagen4] Prediction keys:', Object.keys(prediction));

      // bytesBase64Encoded に画像データが入る
      if (prediction.bytesBase64Encoded) {
        const base64 = prediction.bytesBase64Encoded;
        console.log('[Imagen4] ✅ SUCCESS! Image generated');
        console.log('[Imagen4] Base64 length:', base64.length);
        console.log('[Imagen4] Base64 preview:', base64.substring(0, 50) + '...');
        console.log('='.repeat(70));

        return {
          status: 'success',
          base64: base64,
          mimeType: prediction.mimeType || 'image/png',
          debugInfo: {
            model: IMAGEN_MODEL,
            endpoint,
            httpStatus: response.status,
          },
        };
      }

      // 他のキーを探索
      console.log('[Imagen4] Prediction content:', JSON.stringify(prediction, null, 2).substring(0, 500));
    }

    // 画像が見つからない
    console.error('[Imagen4] ❌ No image data in response');
    console.error('[Imagen4] Full response:', JSON.stringify(data, null, 2).substring(0, 1500));
    console.log('='.repeat(70));

    return {
      status: 'failed',
      errorMessage: '応答に画像データなし (predictions empty or no bytesBase64Encoded)',
      debugInfo: {
        model: IMAGEN_MODEL,
        endpoint,
        httpStatus: response.status,
        errorBody: JSON.stringify(data).substring(0, 500),
      },
    };

  } catch (error: any) {
    console.error('[Imagen4] ❌ EXCEPTION');
    console.error('[Imagen4] Error name:', error?.name);
    console.error('[Imagen4] Error message:', error?.message);
    console.error('[Imagen4] Error stack:', error?.stack?.substring(0, 500));
    console.log('='.repeat(70));

    return {
      status: 'failed',
      errorMessage: error?.message || '不明な例外',
      debugInfo: {
        model: IMAGEN_MODEL,
        endpoint,
      },
    };
  }
}

/**
 * 画像生成のテスト関数（デバッグ用）
 * 実際に画像生成を実行してbase64を返す
 */
export async function testImageGeneration(): Promise<ImageGenerationResult & { availableModels?: { all: string[]; imagen: string[] } }> {
  console.log('[TEST] === Image Generation Test Start ===');

  // まず利用可能なモデルを確認
  const models = await listAvailableModels();
  console.log('[TEST] Imagen models available:', models.imagen);

  // 実際に画像生成を実行（visualPrompt のみ）
  const result = await generateSlideImage(
    'Modern flat icons representing digital marketing concepts like charts, social media, and analytics'
  );

  console.log('[TEST] Final result status:', result.status);
  if (result.status === 'success') {
    console.log('[TEST] ✅ Image generated successfully');
    console.log('[TEST] Base64 length:', result.base64?.length);
  } else {
    console.log('[TEST] ❌ Image generation failed');
    console.log('[TEST] Error:', result.errorMessage);
  }

  return {
    ...result,
    availableModels: models,
  };
}

/**
 * テキストからJSONを抽出してパース
 */
function parseJSONFromText<T>(text: string): T {
  let cleaned = text.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = cleaned.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(jsonStr) as T;
    }

    throw new Error(`Failed to parse JSON: ${cleaned.substring(0, 200)}...`);
  }
}

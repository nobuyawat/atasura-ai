/**
 * 画像生成専用API
 *
 * 2つのモード：
 * - decorative（デフォルト）: visualPrompt のみ使用、装飾的イラスト
 * - contextual: スライド本文から文脈を抽出、アーカイブ/ドキュメンタリー調
 *
 * 重要：
 * - 日本語→英語翻訳してからImagenへ送信
 * - 商標ワードは適切に言い換え（歴史的文脈を保持）
 * - 再生成に対応
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateSlideImage, callGeminiWithRetryAndTokens } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { logGenerationTokens, checkCredits, checkFreePlanLimit, consumeCredits, type GenerationActionType } from '@/lib/credits';

// 画像生成モード
export type ImageContextMode = 'decorative' | 'contextual';

/**
 * 商標ワードの変換マップ（歴史的文脈を保持）
 */
const TRADEMARK_CONVERSIONS: Record<string, string> = {
  'オリンピック': 'historic Olympic Games era',
  'Olympics': 'historic Olympic Games era',
  '五輪': 'historic Olympic Games era',
  'ロゴ': 'iconic emblem',
  'logo': 'iconic emblem',
  'ブランド': 'renowned label',
  'brand': 'renowned label',
};

/**
 * 日本語の画像イメージ文を英語に翻訳（decorativeモード用）
 * - 商標ワード（ロゴ、オリンピック等）は言い換え
 * - 1-2文に要約
 * - 最後に "No text." を付与
 */
/** 翻訳結果にトークン情報を付加 */
interface TranslationResult {
  text: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  durationMs?: number;
}

async function translateVisualPromptDecorative(visualPromptJa: string): Promise<TranslationResult> {
  // 既に英語のみの場合はそのまま返す（簡易判定）
  const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(visualPromptJa);
  if (!hasJapanese) {
    // 英語のみなら "No text." だけ追加
    const text = visualPromptJa.trim().endsWith('No text.')
      ? visualPromptJa
      : `${visualPromptJa.trim()} No text.`;
    return { text };
  }

  const translationPrompt = `Translate the following Japanese image description into a short English prompt for image generation.

Rules:
- Make it 1-2 sentences describing a single clear scene with a main subject
- Be specific: include subject, action, setting, mood
- Avoid trademarked terms:
  - "ロゴ" or "logo" → "emblem-like abstract symbol"
  - "オリンピック" or "Olympics" → "international sports festival"
  - "ブランド名" → describe the style instead
- Output ONLY the final English prompt (no quotes, no explanation)
- End with "No text."

Japanese input:
${visualPromptJa}

English output:`;

  try {
    const result = await callGeminiWithRetryAndTokens(translationPrompt, 1);
    const cleaned = result.text.trim().replace(/^["']|["']$/g, '');

    // "No text." がなければ追加
    const text = !cleaned.toLowerCase().includes('no text')
      ? `${cleaned} No text.`
      : cleaned;

    return {
      text,
      usageMetadata: result.usageMetadata,
      durationMs: result.durationMs,
    };
  } catch (error) {
    console.error('[translateVisualPrompt] Translation failed, using original:', error);
    // 翻訳失敗時は元のまま + No text.
    return { text: `${visualPromptJa} No text.` };
  }
}

/**
 * contextualモード用のプロンプト生成
 * - スライド本文から時代・文脈を抽出
 * - アーカイブ/ドキュメンタリー調のスタイル指定
 * - 商標ワードは歴史的文脈を保持して変換
 */
async function generateContextualPrompt(
  visualPromptJa: string,
  slideTitle: string,
  slideBullets: string[]
): Promise<TranslationResult> {
  // スライドコンテキストを結合
  const slideContext = [slideTitle, ...slideBullets].join('\n');

  const contextPrompt = `You are an expert at creating image prompts for documentary/archival photography.

Given a slide about a topic, generate a specific English image prompt that captures the historical or contextual meaning.

## Slide Title:
${slideTitle}

## Slide Content:
${slideBullets.join('\n')}

## User's Visual Request (Japanese):
${visualPromptJa}

## Rules:
1. Create a prompt for archival/documentary style photography
2. Include specific era, time period, or historical context when relevant
3. Use descriptive terms like: "archival photograph", "vintage documentary", "historical moment", "period photograph"
4. For trademark terms, preserve historical context:
   - "オリンピック/Olympics" → "historic Olympic Games ceremony" or "1964 Tokyo Olympics era photograph"
   - "ファッション史" → "fashion history documentary photograph"
5. Be specific about:
   - Subject: who/what is in the image
   - Era: when (decade, year, period)
   - Style: documentary, archival, candid, formal
   - Setting: location, environment
   - Mood: nostalgic, historic, authentic
6. Output 2-3 sentences maximum
7. End with "No text. Archival documentary photograph."

## Output (English only):`;

  try {
    const result = await callGeminiWithRetryAndTokens(contextPrompt, 1);
    let cleaned = result.text.trim().replace(/^["']|["']$/g, '');

    // 商標ワードの追加チェックと変換
    for (const [jp, en] of Object.entries(TRADEMARK_CONVERSIONS)) {
      if (cleaned.includes(jp)) {
        cleaned = cleaned.replace(new RegExp(jp, 'g'), en);
        console.log(`[contextual] Trademark converted: ${jp} → ${en}`);
      }
    }

    // 必須サフィックスの確認
    if (!cleaned.toLowerCase().includes('no text')) {
      cleaned = `${cleaned} No text. Archival documentary photograph.`;
    }

    return {
      text: cleaned,
      usageMetadata: result.usageMetadata,
      durationMs: result.durationMs,
    };
  } catch (error) {
    console.error('[generateContextualPrompt] Failed, falling back to decorative:', error);
    // フォールバック: decorativeモードと同じ翻訳
    return translateVisualPromptDecorative(visualPromptJa);
  }
}

export interface SlideImageRequest {
  slideId: string;
  sectionId: string;
  visualPrompt: string;
  // contextualモード用（オプション）
  contextMode?: ImageContextMode;
  slideTitle?: string;
  slideBullets?: string[];
  sessionId?: string; // クレジットシステム用セッションID
}

export interface SlideImageResponse {
  success: boolean;
  slideId: string;
  sectionId: string;
  imageStatus: 'success' | 'failed' | 'pending';
  imageBase64?: string;
  imageMimeType?: string;
  errorMessage?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SlideImageResponse>> {
  console.log('[generate-slide-image] === API Called ===');

  try {
    // ユーザー認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const body: SlideImageRequest = await request.json();
    const sessionId = body.sessionId;

    const contextMode: ImageContextMode = body.contextMode || 'decorative';

    console.log('[generate-slide-image] SlideId:', body.slideId);
    console.log('[generate-slide-image] ContextMode:', contextMode);
    console.log('[generate-slide-image] VisualPrompt:', body.visualPrompt);

    // dev時のみcontextual用のコンテキストをログ
    if (process.env.NODE_ENV === 'development' && contextMode === 'contextual') {
      console.log('[generate-slide-image] SlideTitle:', body.slideTitle);
      console.log('[generate-slide-image] SlideBullets:', body.slideBullets);
    }

    if (!body.slideId) {
      return NextResponse.json(
        {
          success: false,
          slideId: body.slideId || '',
          sectionId: body.sectionId || '',
          imageStatus: 'failed',
          errorMessage: 'slideIdは必須です',
        },
        { status: 400 }
      );
    }

    // クレジット残高チェック + 1クレジット消費
    if (userId) {
      const freePlanCheck = await checkFreePlanLimit(userId);
      if (!freePlanCheck.allowed) {
        return NextResponse.json(
          {
            success: false, slideId: body.slideId, sectionId: body.sectionId,
            imageStatus: 'failed', errorMessage: '無料プランの上限に達しました。',
          },
          { status: 402 }
        );
      }
      if (freePlanCheck.plan !== 'free') {
        const creditCheck = await checkCredits(userId, 1);
        if (!creditCheck.hasCredits) {
          console.log(`[generate-slide-image] Insufficient credits: user=${userId}, remaining=${creditCheck.creditsRemaining}`);
          return NextResponse.json(
            {
              success: false, slideId: body.slideId, sectionId: body.sectionId,
              imageStatus: 'failed', errorMessage: '今月のクレジットを使い切りました。',
            },
            { status: 402 }
          );
        }

        // クレジットを1消費（アトミック減算）
        const consumeResult = await consumeCredits(userId, 1, sessionId);
        if (!consumeResult.success) {
          console.error(`[generate-slide-image] Credit consumption failed: user=${userId}, error=${consumeResult.error}`);
          return NextResponse.json(
            {
              success: false, slideId: body.slideId, sectionId: body.sectionId,
              imageStatus: 'failed',
              errorMessage: consumeResult.error === 'insufficient_credits'
                ? '今月のクレジットを使い切りました。'
                : 'クレジット消費に失敗しました。',
            },
            { status: consumeResult.error === 'insufficient_credits' ? 402 : 500 }
          );
        }
        console.log(`[generate-slide-image] Credit consumed: user=${userId}, credits_before=${creditCheck.creditsRemaining}, cost=1, credits_after=${consumeResult.creditsRemaining}`);
      }
    }

    // visualPrompt がない場合はデフォルトプロンプト
    const visualPromptJa = body.visualPrompt || 'ビジネス向けのシンプルなイラスト';

    // dev時のみ日本語プロンプトをログ
    if (process.env.NODE_ENV === 'development') {
      console.log('[generate-slide-image] visualPromptJa (UI表示):', visualPromptJa);
    }

    // モードに応じてプロンプト生成
    let translationResult: TranslationResult;

    if (contextMode === 'contextual' && body.slideTitle) {
      // contextualモード: スライド本文から文脈を抽出してアーカイブ調に
      console.log('[generate-slide-image] Generating contextual prompt...');
      translationResult = await generateContextualPrompt(
        visualPromptJa,
        body.slideTitle,
        body.slideBullets || []
      );
    } else {
      // decorativeモード（デフォルト）: 従来通りの翻訳のみ
      console.log('[generate-slide-image] Using decorative mode translation...');
      translationResult = await translateVisualPromptDecorative(visualPromptJa);
    }

    const visualPromptEn = translationResult.text;

    // 翻訳のトークンログ保存（非ブロッキング）
    if (userId && translationResult.usageMetadata) {
      logGenerationTokens({
        sessionId: sessionId || undefined,
        userId,
        actionType: 'image_prompt_translation' as GenerationActionType,
        inputTokens: translationResult.usageMetadata.promptTokenCount,
        outputTokens: translationResult.usageMetadata.candidatesTokenCount,
        totalTokens: translationResult.usageMetadata.totalTokenCount,
        model: 'gemini-2.0-flash',
        promptLength: visualPromptJa.length,
        responseLength: visualPromptEn.length,
        durationMs: translationResult.durationMs,
        success: true,
      }).catch(err => console.error('[generate-slide-image] Translation token log failed:', err));
    }

    // dev時のみ翻訳後プロンプトをログ
    if (process.env.NODE_ENV === 'development') {
      console.log('[generate-slide-image] visualPromptEn (生成後):', visualPromptEn);
    }

    console.log('[generate-slide-image] Final visualPrompt (EN):', visualPromptEn);
    console.log('[generate-slide-image] Mode:', contextMode);

    // 画像生成（英語プロンプトを渡す）
    const imageStartTime = Date.now();
    const result = await generateSlideImage(visualPromptEn);
    const imageDurationMs = Date.now() - imageStartTime;

    console.log('[generate-slide-image] Result status:', result.status);

    // 画像生成のトークンログ保存（Imagen APIにはトークン概念がないが、呼び出し記録として）
    if (userId) {
      logGenerationTokens({
        sessionId: sessionId || undefined,
        userId,
        actionType: 'image_generation' as GenerationActionType,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        model: 'imagen-4.0-fast-generate-001',
        promptLength: visualPromptEn.length,
        responseLength: result.base64?.length || 0,
        durationMs: imageDurationMs,
        success: result.status === 'success',
        errorMessage: result.status !== 'success' ? result.errorMessage : undefined,
      }).catch(err => console.error('[generate-slide-image] Image token log failed:', err));
    }

    if (result.status === 'success' && result.base64) {
      console.log('[generate-slide-image] ✅ Success, base64 length:', result.base64.length);
      return NextResponse.json({
        success: true,
        slideId: body.slideId,
        sectionId: body.sectionId,
        imageStatus: 'success',
        imageBase64: result.base64,
        imageMimeType: result.mimeType || 'image/png',
      });
    } else {
      console.log('[generate-slide-image] ❌ Failed:', result.errorMessage);
      return NextResponse.json({
        success: false,
        slideId: body.slideId,
        sectionId: body.sectionId,
        imageStatus: 'failed',
        errorMessage: result.errorMessage || '画像生成に失敗しました',
      });
    }

  } catch (error: any) {
    console.error('[generate-slide-image] === ERROR ===');
    console.error('[generate-slide-image] Message:', error?.message);

    return NextResponse.json(
      {
        success: false,
        slideId: '',
        sectionId: '',
        imageStatus: 'failed',
        errorMessage: error?.message || '画像生成中にエラーが発生しました',
      },
      { status: 500 }
    );
  }
}

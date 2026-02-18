/**
 * 骨子（アウトライン）生成 API
 * POST /api/generate-outline
 *
 * Gemini 2.0 Flash を使用して、講座の骨子を生成
 * クレジットシステム: 成功時のみ消費（冪等キー付き）
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateJSONWithTokens } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { logGenerationTokens, incrementFreeScriptUses, preGenerationCheck, consumeCreditsIdempotent, getCreditsRemaining, type GenerationActionType } from '@/lib/credits';
import { randomUUID } from 'crypto';

// 入力の型定義
interface OutlineRequest {
  courseTitle: string;
  chapterTitle: string;
  sectionTitle: string;
  purposeText: string;
  durationMinutes: number;
  totalMinutes: number;
  ratio: number;
  constraintsText?: string;
  voiceMemoText?: string;
  existingBullets?: string[];
  sessionId?: string; // クレジットシステム用セッションID
  requestId?: string; // 冪等キー（フロントから渡す）
}

// 出力の型定義
interface OutlineResponse {
  outlineBullets: string[];
  slideBullets: string[];
  speakerNotesHint: string;
}

export async function POST(request: NextRequest) {
  console.log('[generate-outline] === API Route called ===');

  // リクエストIDを早期に確定（冪等キー）
  let body: OutlineRequest;
  let requestId: string;

  try {
    // ユーザー認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    console.log('[generate-outline] Parsing request body...');
    body = await request.json();
    requestId = body.requestId || randomUUID();
    const sessionId = body.sessionId;
    console.log('[generate-outline] Request body parsed, purposeText length:', body.purposeText?.length || 0, 'requestId:', requestId);

    // バリデーション
    if (!body.purposeText?.trim()) {
      console.log('[generate-outline] Validation failed: purposeText is empty');
      return NextResponse.json(
        { error: '目的・伝えたいことを入力してください', creditsConsumed: false },
        { status: 400 }
      );
    }

    // 生成前チェック（クレジット消費はしない、残高と上限の確認のみ）
    let userPlan = 'free';
    if (userId) {
      const check = await preGenerationCheck(userId, 1);
      userPlan = check.plan;
      if (!check.allowed && check.errorResponse) {
        console.log(`[generate-outline] Pre-check failed: user=${userId}, code=${check.errorResponse.code}`);
        return NextResponse.json(
          { ...check.errorResponse, creditsConsumed: false },
          { status: check.errorResponse.status }
        );
      }
    }

    // プロンプト構築
    console.log('[generate-outline] Building prompt...');
    const prompt = buildOutlinePrompt(body);
    console.log('[generate-outline] Prompt built, length:', prompt.length);

    // Gemini API呼び出し（クレジット未消費の状態で実行）
    console.log('[generate-outline] Calling Gemini API...');
    const result = await generateJSONWithTokens<OutlineResponse>(prompt);
    console.log('[generate-outline] Gemini API returned successfully');

    // 結果の検証
    if (!result.data.outlineBullets || !Array.isArray(result.data.outlineBullets)) {
      throw new Error('Invalid response: outlineBullets is missing or not an array');
    }

    // === 生成成功 → ここでクレジット消費 ===
    let creditsConsumed = false;
    let creditsRemaining: number | undefined;

    if (userId) {
      if (userPlan === 'free') {
        // 無料プラン: 回数インクリメント
        incrementFreeScriptUses(userId).catch(err =>
          console.error('[generate-outline] Free script uses increment failed:', err)
        );
      } else {
        // 有料プラン: 冪等クレジット消費
        const consumeResult = await consumeCreditsIdempotent(
          userId, requestId, 1, 'generate_outline',
          {
            courseTitle: body.courseTitle,
            chapterTitle: body.chapterTitle,
            sectionTitle: body.sectionTitle,
            durationMinutes: body.durationMinutes,
          },
          sessionId
        );
        creditsConsumed = consumeResult.creditsConsumed;
        creditsRemaining = consumeResult.creditsRemaining;
        console.log(`[generate-outline] Credit consumed after success: user=${userId}, consumed=${creditsConsumed}, remaining=${creditsRemaining}`);
      }

      // トークンログ保存（非ブロッキング → Supabase generation_logs）
      logGenerationTokens({
        sessionId: sessionId || undefined,
        userId,
        actionType: 'outline_generation' as GenerationActionType,
        inputTokens: result.usageMetadata?.promptTokenCount,
        outputTokens: result.usageMetadata?.candidatesTokenCount,
        totalTokens: result.usageMetadata?.totalTokenCount,
        model: 'gemini-2.0-flash',
        promptLength: prompt.length,
        responseLength: JSON.stringify(result.data).length,
        durationMs: result.durationMs,
        success: true,
      }).catch(err => console.error('[generate-outline] Token log failed:', err));
    }

    // トークン使用量ログ（Vercel Logs用 構造化出力）
    console.log(`[generate-outline] Token usage: user=${userId || 'anon'}, route=generate-outline, prompt_tokens=${result.usageMetadata?.promptTokenCount ?? 0}, output_tokens=${result.usageMetadata?.candidatesTokenCount ?? 0}, total_tokens=${result.usageMetadata?.totalTokenCount ?? 0}, duration_ms=${result.durationMs}`);

    console.log('[generate-outline] Generated outline:', result.data.outlineBullets.length, 'items');

    return NextResponse.json({
      ...result.data,
      creditsConsumed,
      remainingCredits: creditsRemaining,
    });
  } catch (error: any) {
    console.error('[generate-outline] === ERROR ===');
    console.error('[generate-outline] Error message:', error?.message);
    console.error('[generate-outline] Error status:', error?.status);
    console.error('[generate-outline] Error code:', error?.code);

    // エラーメッセージの分類（クレジットは消費されていない旨を必ず伝える）
    const status = error?.status || error?.code;
    if ([429, 503, 529].includes(status)) {
      console.log('[generate-outline] Returning 503 (server busy)');
      return NextResponse.json(
        { error: 'AIサーバーが混雑しています。少し待ってから再試行してください。クレジットは消費されていません。', creditsConsumed: false },
        { status: 503 }
      );
    }

    if (error.message?.includes('GEMINI_API_KEY')) {
      console.log('[generate-outline] Returning 500 (API key missing)');
      return NextResponse.json(
        { error: 'APIキーが設定されていません。管理者にお問い合わせください。', creditsConsumed: false },
        { status: 500 }
      );
    }

    console.log('[generate-outline] Returning 500 (generic error)');
    return NextResponse.json(
      { error: '生成に失敗しました。クレジットは消費されていません。入力内容を短くして再試行してください。', creditsConsumed: false },
      { status: 500 }
    );
  }
}

/**
 * 骨子生成用プロンプトを構築
 */
function buildOutlinePrompt(input: OutlineRequest): string {
  const {
    courseTitle,
    chapterTitle,
    sectionTitle,
    purposeText,
    durationMinutes,
    totalMinutes,
    ratio,
    constraintsText,
    voiceMemoText,
    existingBullets,
  } = input;

  // 時間に応じた分量指示
  let volumeInstruction = '';
  if (durationMinutes <= 3) {
    volumeInstruction = '簡潔に3〜5個の要点に絞ってください。';
  } else if (durationMinutes <= 7) {
    volumeInstruction = '6〜8個の要点で構成してください。各項目に具体例を1つ含めます。';
  } else {
    volumeInstruction = '8〜10個の要点で詳しく構成してください。具体例・注意点・補足を含めます。';
  }

  // 既存の箇条書きがあれば活用
  const existingContext = existingBullets?.length
    ? `\n既存の箇条書き（これを活かして拡張）:\n${existingBullets.map(b => `- ${b}`).join('\n')}`
    : '';

  // 音声入力があれば優先的に反映
  const voiceContext = voiceMemoText?.trim()
    ? `\n\n【重要】講師の音声メモ（必ず内容に反映すること）:\n"${voiceMemoText}"`
    : '';

  // 追加条件
  const constraintsContext = constraintsText?.trim()
    ? `\n\n追加条件・制約:\n${constraintsText}`
    : '';

  return `あなたはオンライン講座の台本作成アシスタントです。
以下の情報をもとに、講座の骨子（アウトライン）を作成してください。

## コンテキスト
- 講座タイトル: ${courseTitle || '（未設定）'}
- 章タイトル: ${chapterTitle || '（未設定）'}
- 小見出し: ${sectionTitle || '（未設定）'}
- この節の時間: ${durationMinutes}分（全体${totalMinutes}分の${Math.round(ratio * 100)}%）

## 目的・伝えたいこと（最重要）
${purposeText}
${existingContext}${voiceContext}${constraintsContext}

## 出力要件
${volumeInstruction}

### 構成の流れ
1. 導入（なぜこの話をするか）
2. 本題の要点（箇条書きで順番に）
3. 具体例（各要点に対して）
4. 注意点・よくある間違い
5. まとめ

## 出力形式（JSONのみ）
{
  "outlineBullets": [
    "最初に〇〇について説明します",
    "ポイント1: 具体的な内容",
    "例えば〜という場面で使えます",
    "ポイント2: ...",
    "注意点として〜",
    "まとめ: ..."
  ],
  "slideBullets": [
    "スライドに表示する要点1（短く）",
    "スライドに表示する要点2",
    "スライドに表示する要点3",
    "スライドに表示する要点4"
  ],
  "speakerNotesHint": "話すときのポイント：〇〇を強調、△△の例え話が効果的"
}

JSONのみで出力してください。説明文は不要です。`;
}

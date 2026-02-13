/**
 * 骨子（アウトライン）生成 API
 * POST /api/generate-outline
 *
 * Gemini 2.0 Flash を使用して、講座の骨子を生成
 * クレジットシステム: トークンログ保存対応
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateJSONWithTokens } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { logGenerationTokens, checkFreePlanLimit, incrementFreeScriptUses, checkCredits, consumeCredits, type GenerationActionType } from '@/lib/credits';

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
}

// 出力の型定義
interface OutlineResponse {
  outlineBullets: string[];
  slideBullets: string[];
  speakerNotesHint: string;
}

export async function POST(request: NextRequest) {
  console.log('[generate-outline] === API Route called ===');

  try {
    // ユーザー認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    console.log('[generate-outline] Parsing request body...');
    const body: OutlineRequest = await request.json();
    const sessionId = body.sessionId; // フロントから渡されるセッションID（任意）
    console.log('[generate-outline] Request body parsed, purposeText length:', body.purposeText?.length || 0);

    // バリデーション
    if (!body.purposeText?.trim()) {
      console.log('[generate-outline] Validation failed: purposeText is empty');
      return NextResponse.json(
        { error: '目的・伝えたいことを入力してください' },
        { status: 400 }
      );
    }

    // 無料プラン上限チェック
    let userPlan = 'free'; // デフォルト
    if (userId) {
      const freePlanCheck = await checkFreePlanLimit(userId);
      userPlan = freePlanCheck.plan;
      if (!freePlanCheck.allowed) {
        console.log(`[generate-outline] Free plan limit reached: user=${userId}, uses=${freePlanCheck.uses}`);
        return NextResponse.json(
          {
            error: '無料プランの上限（2分台本×3本）に達しました。スターター以上のプランにアップグレードしてください。',
            code: 'FREE_PLAN_LIMIT_REACHED',
            freePlan: { uses: freePlanCheck.uses, limit: freePlanCheck.limit, locked: true },
          },
          { status: 402 }
        );
      }

      // 有料プランのクレジット残高チェック + 消費（生成前に1クレジット消費）
      if (freePlanCheck.plan !== 'free') {
        const creditCheck = await checkCredits(userId, 1);
        if (!creditCheck.hasCredits) {
          console.log(`[generate-outline] Insufficient credits: user=${userId}, remaining=${creditCheck.creditsRemaining}`);
          return NextResponse.json(
            {
              error: '今月のクレジットを使い切りました。翌月のリセットをお待ちいただくか、上位プランへアップグレードしてください。',
              code: 'INSUFFICIENT_CREDITS',
              credits: { remaining: creditCheck.creditsRemaining, required: 1 },
            },
            { status: 402 }
          );
        }

        // クレジットを1消費（アトミック減算）
        const consumeResult = await consumeCredits(userId, 1, sessionId);
        if (!consumeResult.success) {
          console.error(`[generate-outline] Credit consumption failed: user=${userId}, error=${consumeResult.error}`);
          return NextResponse.json(
            {
              error: consumeResult.error === 'insufficient_credits'
                ? '今月のクレジットを使い切りました。翌月のリセットをお待ちいただくか、上位プランへアップグレードしてください。'
                : 'クレジット消費に失敗しました。再試行してください。',
              code: consumeResult.error === 'insufficient_credits' ? 'INSUFFICIENT_CREDITS' : 'CREDIT_CONSUME_ERROR',
            },
            { status: consumeResult.error === 'insufficient_credits' ? 402 : 500 }
          );
        }
        console.log(`[generate-outline] Credit consumed: user=${userId}, credits_before=${creditCheck.creditsRemaining}, cost=1, credits_after=${consumeResult.creditsRemaining}`);
      }
    }

    // プロンプト構築
    console.log('[generate-outline] Building prompt...');
    const prompt = buildOutlinePrompt(body);
    console.log('[generate-outline] Prompt built, length:', prompt.length);

    console.log('[generate-outline] Calling Gemini API...');
    const result = await generateJSONWithTokens<OutlineResponse>(prompt);
    console.log('[generate-outline] Gemini API returned successfully');

    // トークン使用量ログ（Vercel Logs用 構造化出力）
    console.log(`[generate-outline] Token usage: user=${userId || 'anon'}, route=generate-outline, prompt_tokens=${result.usageMetadata?.promptTokenCount ?? 0}, output_tokens=${result.usageMetadata?.candidatesTokenCount ?? 0}, total_tokens=${result.usageMetadata?.totalTokenCount ?? 0}, duration_ms=${result.durationMs}`);

    // トークンログ保存（非ブロッキング → Supabase generation_logs）
    if (userId) {
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

    // 結果の検証
    if (!result.data.outlineBullets || !Array.isArray(result.data.outlineBullets)) {
      throw new Error('Invalid response: outlineBullets is missing or not an array');
    }

    console.log('[generate-outline] Generated outline:', result.data.outlineBullets.length, 'items');

    // 無料プランの場合のみ、生成成功時に回数をインクリメント
    // （有料プランは生成前にクレジット消費済み）
    if (userId && userPlan === 'free') {
      incrementFreeScriptUses(userId).catch(err =>
        console.error('[generate-outline] Free script uses increment failed:', err)
      );
    }

    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error('[generate-outline] === ERROR ===');
    console.error('[generate-outline] Error message:', error?.message);
    console.error('[generate-outline] Error status:', error?.status);
    console.error('[generate-outline] Error code:', error?.code);
    console.error('[generate-outline] Error stack:', error?.stack);

    // エラーメッセージの分類
    const status = error?.status || error?.code;
    if ([429, 503, 529].includes(status)) {
      console.log('[generate-outline] Returning 503 (server busy)');
      return NextResponse.json(
        { error: 'AIサーバーが混雑しています。少し待ってから再試行してください。' },
        { status: 503 }
      );
    }

    if (error.message?.includes('GEMINI_API_KEY')) {
      console.log('[generate-outline] Returning 500 (API key missing)');
      return NextResponse.json(
        { error: 'APIキーが設定されていません。管理者にお問い合わせください。' },
        { status: 500 }
      );
    }

    console.log('[generate-outline] Returning 500 (generic error)');
    return NextResponse.json(
      { error: '生成に失敗しました。入力内容を短くして再試行してください。' },
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

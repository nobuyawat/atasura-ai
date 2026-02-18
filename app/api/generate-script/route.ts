/**
 * 台本生成 API
 * POST /api/generate-script
 *
 * Gemini 2.0 Flash を使用して、講師が読み上げる台本を生成
 * クレジットシステム: 成功時のみ消費（冪等キー付き）
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateJSONWithTokens } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { logGenerationTokens, preGenerationCheck, consumeCreditsIdempotent, type GenerationActionType } from '@/lib/credits';
import { randomUUID } from 'crypto';

// 入力の型定義
interface ScriptRequest {
  courseTitle: string;
  chapterTitle: string;
  sectionTitle: string;
  purposeText: string;
  durationMinutes: number;
  totalMinutes: number;
  ratio: number;
  constraintsText?: string;
  voiceMemoText?: string;
  outlineDraft: string[];        // ユーザー編集後の骨子
  existingBullets?: string[];    // 既存の箇条書き
  existingBody?: string;         // 既存の本文
  existingNotes?: string;        // 既存の補足
  sessionId?: string;            // クレジットシステム用セッションID
  requestId?: string;            // 冪等キー
}

// 出力の型定義
interface ScriptResponse {
  scriptText: string;
  speakerNotes: string;
  slideBullets: string[];
}

export async function POST(request: NextRequest) {
  try {
    // ユーザー認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const body: ScriptRequest = await request.json();
    const sessionId = body.sessionId;
    const requestId = body.requestId || randomUUID();

    // バリデーション
    if (!body.outlineDraft?.length) {
      return NextResponse.json(
        { error: '骨子（アウトライン）が必要です', creditsConsumed: false },
        { status: 400 }
      );
    }

    // 生成前チェック（クレジット消費はしない）
    let userPlan = 'free';
    if (userId) {
      const check = await preGenerationCheck(userId, 1);
      userPlan = check.plan;
      if (!check.allowed && check.errorResponse) {
        return NextResponse.json(
          { ...check.errorResponse, creditsConsumed: false },
          { status: check.errorResponse.status }
        );
      }
    }

    // プロンプト構築
    const prompt = buildScriptPrompt(body);

    // Gemini API呼び出し（クレジット未消費の状態）
    console.log('[generate-script] Calling Gemini API...');
    const result = await generateJSONWithTokens<ScriptResponse>(prompt);

    // 結果の検証
    if (!result.data.scriptText || typeof result.data.scriptText !== 'string') {
      throw new Error('Invalid response: scriptText is missing');
    }

    // === 生成成功 → ここでクレジット消費 ===
    let creditsConsumed = false;
    let creditsRemaining: number | undefined;

    if (userId && userPlan !== 'free') {
      const consumeResult = await consumeCreditsIdempotent(
        userId, requestId, 1, 'generate_script',
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
      console.log(`[generate-script] Credit consumed after success: user=${userId}, consumed=${creditsConsumed}, remaining=${creditsRemaining}`);
    }

    // トークンログ保存（非ブロッキング）
    if (userId) {
      logGenerationTokens({
        sessionId: sessionId || undefined,
        userId,
        actionType: 'script_generation' as GenerationActionType,
        inputTokens: result.usageMetadata?.promptTokenCount,
        outputTokens: result.usageMetadata?.candidatesTokenCount,
        totalTokens: result.usageMetadata?.totalTokenCount,
        model: 'gemini-2.0-flash',
        promptLength: prompt.length,
        responseLength: JSON.stringify(result.data).length,
        durationMs: result.durationMs,
        success: true,
      }).catch(err => console.error('[generate-script] Token log failed:', err));
    }

    // トークン使用量ログ（Vercel Logs用 構造化出力）
    console.log(`[generate-script] Token usage: user=${userId || 'anon'}, route=generate-script, prompt_tokens=${result.usageMetadata?.promptTokenCount ?? 0}, output_tokens=${result.usageMetadata?.candidatesTokenCount ?? 0}, total_tokens=${result.usageMetadata?.totalTokenCount ?? 0}, duration_ms=${result.durationMs}`);
    console.log('[generate-script] Generated script:', result.data.scriptText.length, 'chars');

    return NextResponse.json({
      ...result.data,
      creditsConsumed,
      remainingCredits: creditsRemaining,
    });
  } catch (error: any) {
    console.error('[generate-script] Error:', error);

    const status = error?.status || error?.code;
    if ([429, 503, 529].includes(status)) {
      return NextResponse.json(
        { error: 'AIサーバーが混雑しています。少し待ってから再試行してください。クレジットは消費されていません。', creditsConsumed: false },
        { status: 503 }
      );
    }

    if (error.message?.includes('GEMINI_API_KEY')) {
      return NextResponse.json(
        { error: 'APIキーが設定されていません。管理者にお問い合わせください。', creditsConsumed: false },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: '生成に失敗しました。クレジットは消費されていません。入力内容を短くして再試行してください。', creditsConsumed: false },
      { status: 500 }
    );
  }
}

/**
 * 台本生成用プロンプトを構築
 */
function buildScriptPrompt(input: ScriptRequest): string {
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
    outlineDraft,
    existingBullets,
    existingBody,
    existingNotes,
  } = input;

  // 時間に応じた分量指示（1分 ≒ 150〜200文字）
  const targetChars = durationMinutes * 180;
  let volumeInstruction = '';
  if (durationMinutes <= 3) {
    volumeInstruction = `短く簡潔に（目安: ${targetChars}文字程度）。要点を絞って説明します。`;
  } else if (durationMinutes <= 7) {
    volumeInstruction = `中程度の長さ（目安: ${targetChars}文字程度）。各要点に具体例を1つずつ入れます。`;
  } else {
    volumeInstruction = `詳しく説明（目安: ${targetChars}文字程度）。具体例、補足説明、注意点を含めます。`;
  }

  // 骨子を箇条書きで表示
  const outlineText = outlineDraft.map((item, i) => `${i + 1}. ${item}`).join('\n');

  // 既存コンテンツがあれば参照
  const existingContext = [
    existingBullets?.length ? `既存の箇条書き:\n${existingBullets.map(b => `- ${b}`).join('\n')}` : '',
    existingBody?.trim() ? `既存の本文（これを補強・改善）:\n${existingBody}` : '',
    existingNotes?.trim() ? `既存の補足:\n${existingNotes}` : '',
  ].filter(Boolean).join('\n\n');

  // 音声入力は最優先で反映
  const voiceContext = voiceMemoText?.trim()
    ? `\n\n【最重要】講師の音声メモ（この内容を必ず台本に組み込むこと）:\n"${voiceMemoText}"`
    : '';

  // 追加条件
  const constraintsContext = constraintsText?.trim()
    ? `\n\n追加条件・制約:\n${constraintsText}`
    : '';

  return `あなたはオンライン講座の講師です。以下の骨子をもとに、実際に話す台本を作成してください。

## コンテキスト
- 講座タイトル: ${courseTitle || '（未設定）'}
- 章タイトル: ${chapterTitle || '（未設定）'}
- 小見出し: ${sectionTitle || '（未設定）'}
- この節の時間: ${durationMinutes}分（全体${totalMinutes}分の${Math.round(ratio * 100)}%）

## 目的・伝えたいこと
${purposeText}

## 骨子（この順番で話を展開すること）
${outlineText}
${existingContext ? `\n## 参考情報\n${existingContext}` : ''}${voiceContext}${constraintsContext}

## 台本作成のルール
${volumeInstruction}

### 必須要件
1. **口語で書く**: 「〜ですね」「〜しましょう」など、講師が自然に読み上げられる話し言葉
2. **骨子に忠実に**: 上記の骨子の順番どおりに話を展開する
3. **具体例を入れる**: 各要点に対して「例えば〜」「具体的には〜」で例を示す
4. **テンプレ禁止**: 「これは重要です」「なぜかというと」の連呼は禁止。自然な流れで

### 構成
- 導入（10%）: この節で何を学ぶか、なぜ重要か
- 本題（70%）: 骨子の各項目を順に解説。各項目に具体例
- まとめ（20%）: 要点の振り返り、次への橋渡し

### 話し方のトーン
- 受講者は初心者〜中級者
- 親しみやすく、でも専門性も感じられる
- 適度に問いかけ「〜って思いませんか？」「〜ですよね」

## 出力形式（JSONのみ）
{
  "scriptText": "導入の文章\\n\\n本題の段落1\\n\\n本題の段落2\\n\\nまとめの文章",
  "speakerNotes": "- 強調ポイント: 〇〇\\n- 例え話: △△を使うと分かりやすい\\n- 注意: ××は間違いやすい",
  "slideBullets": [
    "スライド表示用の要点1",
    "スライド表示用の要点2",
    "スライド表示用の要点3",
    "スライド表示用の要点4"
  ]
}

JSONのみで出力してください。説明文は不要です。`;
}

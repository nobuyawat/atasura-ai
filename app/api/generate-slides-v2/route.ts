/**
 * 新・軽量スライド生成API (v2)
 *
 * 方針:
 * - 台本から要点を抽出し、スライドテキストのみ生成
 * - 画像生成は行わない (別レーンで管理)
 * - 日本語100%、文字化けなし
 * - 台本の意味を壊さない
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateJSONWithTokens } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { logGenerationTokens, checkCredits, checkFreePlanLimit, consumeCredits, type GenerationActionType } from '@/lib/credits';
import {
  LightSlideGenerationRequest,
  LightSlideGenerationResponse,
  LightSlideOutput,
  SlideLayoutId,
  LayoutHint,
} from '@/lib/slide-types';

// =====================================================
// レイアウト選択ロジック
// =====================================================

function detectLayoutHint(bullets: string[], bodyText?: string): LayoutHint {
  const bulletCount = bullets.length;
  const avgBulletLength = bullets.length > 0
    ? bullets.reduce((sum, b) => sum + b.length, 0) / bullets.length
    : 0;

  const allText = [...bullets, bodyText || ''].join(' ');

  // 比較表現の検出
  const comparisonPatterns = [
    'に対して', 'と比べ', '一方', 'メリット', 'デメリット',
    'vs', 'VS', '違い', '差', '比較'
  ];
  const hasComparison = comparisonPatterns.some(p => allText.includes(p));

  // 手順表現の検出
  const stepsPatterns = [
    'まず', '次に', '最後に', 'ステップ', '手順',
    '第一に', '第二に', '①', '②', '③'
  ];
  const hasSteps = stepsPatterns.some(p => allText.includes(p));

  // 引用表現の検出
  const quotePatterns = ['「', '』', '"', '名言', '格言'];
  const hasQuote = quotePatterns.some(p => allText.includes(p));

  return {
    bulletCount,
    avgBulletLength,
    hasComparison,
    hasSteps,
    hasQuote,
  };
}

function selectLayout(hint: LayoutHint): SlideLayoutId {
  // 引用優先
  if (hint.hasQuote && hint.bulletCount <= 2) {
    return 'quote';
  }

  // 手順パターン
  if (hint.hasSteps) {
    return 'steps';
  }

  // 比較パターン
  if (hint.hasComparison) {
    return 'comparison';
  }

  // 箇条書きが多い場合は2カラム
  if (hint.bulletCount >= 6) {
    return 'two_column';
  }

  // デフォルト
  return 'title_bullets';
}

// =====================================================
// プロンプト構築
// =====================================================

function buildPrompt(request: LightSlideGenerationRequest): string {
  const sectionsInfo = request.sections.map((section, index) => {
    const bulletsText = section.bullets.length > 0
      ? section.bullets.map((b, i) => `  ${i + 1}. ${b}`).join('\n')
      : '  (箇条書きなし)';

    return `
### 小見出し${index + 1}: ${section.sectionTitle}
ID: ${section.sectionId}
箇条書き:
${bulletsText}
${section.bodyText ? `本文: ${section.bodyText.substring(0, 300)}...` : ''}
${section.notes ? `補足: ${section.notes.substring(0, 100)}` : ''}
`;
  }).join('\n');

  return `あなたはプレゼンテーション作成の専門家です。
以下の講座の台本から、スライドを生成してください。

## 最重要ルール

1. **台本の内容を忠実に反映**
   - 勝手な補完・創作・知識追加は禁止
   - 台本に書かれていない意味を付加しない
   - 箇条書きはそのまま使うか、読みやすく整形するだけ

2. **1小見出し = 1スライド**
   - 各小見出しにつき1枚のスライドを生成
   - 箇条書きが多くても分割しない（最大5行に絞る）

3. **日本語で出力**
   - すべて日本語で出力
   - 英語への翻訳は禁止

## 講座情報
- 講座名: ${request.courseTitle}
- 章タイトル: ${request.chapterTitle}
- 小見出し数: ${request.sections.length}

## 各小見出しの内容
${sectionsInfo}

## 出力ルール

### 箇条書き (bullets)
- 台本の箇条書きをそのまま使う（最大5行）
- 長すぎる場合は短縮するが、意味は変えない
- 1行は16〜28文字程度

### スピーカーノート (speakerNotes)
- 本文があればそれを要約（100〜200文字）
- なければ空文字

### レイアウト (layoutId)
- title_bullets: 通常（基本これ）
- two_column: 箇条書き6個以上
- quote: 引用・重要メッセージ
- steps: 手順（まず、次に、最後に）
- comparison: 比較（メリット/デメリット）

## 出力形式 (JSON)
{
  "slides": [
    {
      "sectionId": "section-id",
      "order": 0,
      "title": "小見出しタイトル",
      "bullets": ["箇条書き1", "箇条書き2", "箇条書き3"],
      "speakerNotes": "スピーカーノート...",
      "layoutId": "title_bullets"
    }
  ]
}

対応する小見出しID:
${request.sections.map(s => `- ${s.sectionId}: ${s.sectionTitle}`).join('\n')}

JSONのみを出力してください。`;
}

// =====================================================
// バリデーション & 正規化
// =====================================================

function normalizeSlide(
  slide: any,
  sectionId: string,
  defaultTitle: string
): LightSlideOutput {
  // bullets の正規化（最大5行、文字数制限）
  const bullets = (slide.bullets || [])
    .slice(0, 5)
    .map((bullet: string) => {
      if (typeof bullet !== 'string') return '';
      // 長すぎる場合は切り詰め
      if (bullet.length > 60) {
        return bullet.substring(0, 57) + '...';
      }
      return bullet;
    })
    .filter((b: string) => b.trim());

  // layoutId の検証
  const validLayouts: SlideLayoutId[] = [
    'title_bullets', 'two_column', 'quote', 'steps', 'comparison', 'diagram_focus'
  ];
  const layoutId: SlideLayoutId = validLayouts.includes(slide.layoutId)
    ? slide.layoutId
    : 'title_bullets';

  return {
    sectionId: slide.sectionId || sectionId,
    order: typeof slide.order === 'number' ? slide.order : 0,
    title: (slide.title || defaultTitle).substring(0, 50),
    bullets,
    speakerNotes: (slide.speakerNotes || '').substring(0, 500),
    layoutId,
  };
}

// =====================================================
// API ハンドラ
// =====================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<LightSlideGenerationResponse>> {
  console.log('[generate-slides-v2] === API Route called ===');

  try {
    // ユーザー認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const body: LightSlideGenerationRequest & { sessionId?: string } = await request.json();
    const sessionId = body.sessionId;
    console.log('[generate-slides-v2] Course:', body.courseTitle);
    console.log('[generate-slides-v2] Chapter:', body.chapterTitle);
    console.log('[generate-slides-v2] Sections:', body.sections.length);

    if (!body.sections || body.sections.length === 0) {
      return NextResponse.json(
        { success: false, slides: [], error: 'セクションがありません' },
        { status: 400 }
      );
    }

    // クレジット残高チェック + 1クレジット消費
    if (userId) {
      const freePlanCheck = await checkFreePlanLimit(userId);
      if (!freePlanCheck.allowed) {
        return NextResponse.json(
          { success: false, slides: [], error: '無料プランの上限に達しました。プランをアップグレードしてください。' },
          { status: 402 }
        );
      }
      if (freePlanCheck.plan !== 'free') {
        const creditCheck = await checkCredits(userId, 1);
        if (!creditCheck.hasCredits) {
          console.log(`[generate-slides-v2] Insufficient credits: user=${userId}, remaining=${creditCheck.creditsRemaining}`);
          return NextResponse.json(
            { success: false, slides: [], error: '今月のクレジットを使い切りました。翌月のリセットをお待ちください。' },
            { status: 402 }
          );
        }

        const consumeResult = await consumeCredits(userId, 1, sessionId);
        if (!consumeResult.success) {
          console.error(`[generate-slides-v2] Credit consumption failed: user=${userId}, error=${consumeResult.error}`);
          return NextResponse.json(
            { success: false, slides: [], error: 'クレジット消費に失敗しました。再試行してください。' },
            { status: 500 }
          );
        }
        console.log(`[generate-slides-v2] Credit consumed: user=${userId}, credits_before=${creditCheck.creditsRemaining}, cost=1, credits_after=${consumeResult.creditsRemaining}`);
      }
    }

    // プロンプト構築
    const prompt = buildPrompt(body);
    console.log('[generate-slides-v2] Prompt length:', prompt.length);

    // AI生成 (テキストのみ)
    const resultWithTokens = await generateJSONWithTokens<{ slides: any[] }>(prompt);
    const result = resultWithTokens.data;
    console.log('[generate-slides-v2] Generated slides:', result.slides?.length || 0);

    // トークンログ保存（非ブロッキング）
    if (userId) {
      logGenerationTokens({
        sessionId: sessionId || undefined,
        userId,
        actionType: 'slide_generation' as GenerationActionType,
        inputTokens: resultWithTokens.usageMetadata?.promptTokenCount,
        outputTokens: resultWithTokens.usageMetadata?.candidatesTokenCount,
        totalTokens: resultWithTokens.usageMetadata?.totalTokenCount,
        model: 'gemini-2.0-flash',
        promptLength: prompt.length,
        responseLength: JSON.stringify(result).length,
        durationMs: resultWithTokens.durationMs,
        success: true,
      }).catch(err => console.error('[generate-slides-v2] Token log failed:', err));
    }

    // 正規化
    const slides: LightSlideOutput[] = (result.slides || []).map((slide, index) => {
      const section = body.sections.find(s => s.sectionId === slide.sectionId)
        || body.sections[index]
        || body.sections[0];

      return normalizeSlide(
        { ...slide, order: index },
        section?.sectionId || 'unknown',
        section?.sectionTitle || '無題'
      );
    });

    // レイアウトの自動調整（AI出力が不適切な場合の補正）
    slides.forEach((slide, index) => {
      const section = body.sections.find(s => s.sectionId === slide.sectionId);
      if (section) {
        const hint = detectLayoutHint(section.bullets, section.bodyText);
        const suggestedLayout = selectLayout(hint);

        // AIの選択が明らかに不適切な場合のみ上書き
        if (slide.layoutId === 'title_bullets' && suggestedLayout !== 'title_bullets') {
          // AIがデフォルトを選んだが、より適切なレイアウトがある場合
          // ただし、ランダム性を持たせるため50%の確率で変更
          if (Math.random() > 0.5) {
            slide.layoutId = suggestedLayout;
          }
        }
      }
    });

    console.log('[generate-slides-v2] === RESPONSE ===');
    slides.forEach((s, i) => {
      console.log(`[generate-slides-v2] Slide ${i + 1}: "${s.title}" (${s.layoutId})`);
    });

    return NextResponse.json({
      success: true,
      slides,
    });

  } catch (error: any) {
    console.error('[generate-slides-v2] === ERROR ===');
    console.error('[generate-slides-v2] Message:', error?.message);

    const status = error?.status || error?.code;
    if ([429, 503, 529].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          slides: [],
          error: 'AIサーバーが混雑しています。少し待ってから再試行してください。'
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        slides: [],
        error: 'スライド生成に失敗しました。再試行してください。'
      },
      { status: 500 }
    );
  }
}

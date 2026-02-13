import { NextRequest, NextResponse } from 'next/server';
import { generateJSONWithTokens, generateSlideImage } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { logGenerationTokens, checkCredits, checkFreePlanLimit, consumeCredits, type GenerationActionType } from '@/lib/credits';
import {
  SlideGenerationRequest,
  ChapterSlideGenerationRequest,
  SectionSlideGenerationRequest,
  GeneratedSlide,
  SlideGenerationResponse,
  SectionContent,
  SlideLayoutType,
} from '@/lib/types';

// =====================================================
// スライド生成制約（プロンプトとロジックで担保）
// =====================================================
const SLIDE_CONSTRAINTS = {
  maxBulletsPerSlide: 5,
  targetBulletLength: { min: 18, max: 24 },
  structureRules: {
    chapterStart: 'overview',     // 章冒頭は全体像スライド
    sectionPattern: 'conclusion_reason_example',  // 結論→理由→例
    chapterEnd: 'summary',        // 章末はまとめ
  },
};

// =====================================================
// プロンプト構築
// =====================================================

function buildSectionSlidesPrompt(
  courseTitle: string,
  chapterTitle: string,
  section: SectionContent,
  isFirst: boolean,
  isLast: boolean,
  totalSections: number
): string {
  // 台本コンテンツを種類別に抽出
  const sectionTitle = section.sectionTitle || '';
  const bullets = section.blocks
    .filter(b => b.type === 'bullet')
    .map(b => b.content)
    .filter(c => c.trim());
  const bodyTexts = section.blocks
    .filter(b => b.type === 'body')
    .map(b => b.content)
    .filter(c => c.trim());
  const notes = section.blocks
    .filter(b => b.type === 'note')
    .map(b => b.content)
    .filter(c => c.trim());

  // 全体の内容量を計算（分割判断用）
  const totalContentLength = bullets.join('').length + bodyTexts.join('').length;
  const needsMultipleSlides = totalContentLength > 800 || bullets.length > 7;

  const positionContext = isFirst
    ? '（この節は章の冒頭です）'
    : isLast
    ? '（この節は章の末尾です）'
    : '';

  return `
あなたはプレゼンテーション作成の専門家です。
以下の小見出しの内容から、**原則1枚**のスライドを生成してください。

## ⚠️ 重要：スライド生成の基本原則
- **1つの小見出し = 原則1枚のスライド**
- 箇条書きが複数あっても、それらは**1枚のスライド内のbullet**としてまとめる
- 箇条書きごとに別スライドを作らない
- 内容が非常に長い場合のみ（目安：800文字以上）、最大2〜3枚に分割可

## 講座情報
- 講座名: ${courseTitle}
- 章タイトル: ${chapterTitle}
- 小見出しタイトル: ${sectionTitle}
${positionContext}

## この小見出しの内容

### タイトル
${sectionTitle}

### 箇条書き（${bullets.length}件）
${bullets.length > 0 ? bullets.map((b, i) => `${i + 1}. ${b}`).join('\n') : '（箇条書きなし）'}

### 本文・台本
${bodyTexts.length > 0 ? bodyTexts.join('\n\n') : '（本文なし）'}

### 補足
${notes.length > 0 ? notes.join('\n') : '（補足なし）'}

${section.purposeText ? `### 伝えたいこと\n${section.purposeText}` : ''}

## スライド生成ルール

### 枚数の判断基準
- 内容量が少〜中（箇条書き7件以下、本文800文字未満）: **1枚**
- 内容量が多い（箇条書き8件以上、本文800文字以上）: **最大2〜3枚**
- 現在の内容量: 箇条書き${bullets.length}件、本文約${totalContentLength}文字 → ${needsMultipleSlides ? '分割検討' : '1枚推奨'}

### 箇条書きのルール
- 上記の箇条書きを**1枚のスライド内にまとめる**（最大5行に要約）
- 5行を超える場合は重要なものを選んで要約
- 1行は16〜24文字程度（16:9で見やすい長さ）

### スピーカーノート
- 本文・台本の内容を要約（100〜200文字）
- 話す際のポイントや補足を含める

### レイアウトタイプ
- title_bullets: 通常（タイトル＋箇条書き）← **基本これを使用**
- title_only: タイトルのみ（章区切り等）
- quote: 引用・重要メッセージ
- summary: まとめ

## 出力形式（JSON）
{
  "slides": [
    {
      "order": 0,
      "title": "${sectionTitle}",
      "bullets": ["要約した箇条書き1", "要約した箇条書き2", "要約した箇条書き3"],
      "speakerNotes": "本文・台本を要約したスピーカーノート...",
      "layoutType": "title_bullets",
      "imageIntent": "アイコン/図解/写真 など"
    }
  ]
}

**重要**: 原則1枚。bullets配列には上記の箇条書きをまとめて入れる。
JSONのみを出力してください。
`;
}

function buildChapterSlidesPrompt(request: ChapterSlideGenerationRequest): string {
  // 各小見出しの内容を構造化して抽出
  const sectionsContent = request.sections.map((section, index) => {
    const bullets = section.blocks
      .filter(b => b.type === 'bullet')
      .map(b => b.content)
      .filter(c => c.trim());
    const bodyTexts = section.blocks
      .filter(b => b.type === 'body')
      .map(b => b.content)
      .filter(c => c.trim());

    return `
### 小見出し${index + 1}: ${section.sectionTitle}
- ID: ${section.sectionId}
- 箇条書き（${bullets.length}件）: ${bullets.length > 0 ? bullets.join(' / ') : 'なし'}
- 本文: ${bodyTexts.length > 0 ? bodyTexts.join(' ').substring(0, 200) + '...' : 'なし'}
${section.purposeText ? `- 伝えたいこと: ${section.purposeText}` : ''}
`;
  }).join('\n');

  return `
あなたはプレゼンテーション作成の専門家です。
以下の講座（1章分）の各小見出しから、スライドを生成してください。

## ⚠️ 最重要ルール：1小見出し＝原則1スライド
- **各小見出しにつき原則1枚のスライドを生成**
- 小見出し内の箇条書きは、その1枚のスライド内のbullet配列にまとめる
- 箇条書きごとに別スライドを作らない
- 小見出しの数＝スライドの数（目安）

## 講座情報
- 講座名: ${request.courseTitle}
- 章タイトル: ${request.chapterTitle}
- 小見出しの数: ${request.sections.length}

## 各小見出しの内容
${sectionsContent}

## スライド生成ルール

### 枚数の原則
- 小見出し数: ${request.sections.length}
- 生成するスライド数: **${request.sections.length}枚**（各小見出しに1枚）
- 例外: 内容が非常に長い小見出しのみ2枚に分割可

### 各スライドのルール
- タイトル: 小見出しのタイトルをそのまま使用
- bullets: その小見出し内の箇条書きを**まとめて**入れる（最大5行に要約）
- speakerNotes: 本文・台本があればそれを要約
- 1行は16〜24文字程度

### レイアウトタイプ
- title_bullets: 通常（基本これを使用）
- title_only: タイトルのみ
- summary: まとめ

## 出力形式（JSON）
{
  "slides": [
    {
      "sectionId": "${request.sections[0]?.sectionId || 'section-id'}",
      "order": 0,
      "title": "小見出しタイトル",
      "bullets": ["その小見出しの箇条書きをまとめたもの1", "まとめたもの2", "まとめたもの3"],
      "speakerNotes": "本文の要約...",
      "layoutType": "title_bullets",
      "imageIntent": "アイコン/図解/写真"
    }
  ]
}

各小見出しのIDと対応させてください:
${request.sections.map(s => `- ${s.sectionId}: ${s.sectionTitle}`).join('\n')}

**重要**: スライド数は小見出し数（${request.sections.length}枚）を目安に。
JSONのみを出力してください。
`;
}

// =====================================================
// スライド整形ロジック
// =====================================================

function normalizeSlide(slide: any, sectionId: string): GeneratedSlide {
  // 箇条書きの整形（最大5行、文字数制限）
  const bullets = (slide.bullets || [])
    .slice(0, SLIDE_CONSTRAINTS.maxBulletsPerSlide)
    .map((bullet: string) => {
      if (bullet.length > SLIDE_CONSTRAINTS.targetBulletLength.max * 2) {
        // 長すぎる場合は分割 or 短縮
        return bullet.substring(0, SLIDE_CONSTRAINTS.targetBulletLength.max * 2) + '...';
      }
      return bullet;
    });

  // layoutType の検証
  const validLayoutTypes: SlideLayoutType[] = [
    'title_bullets', 'title_only', 'two_column', 'quote', 'diagram', 'summary'
  ];
  const layoutType = validLayoutTypes.includes(slide.layoutType)
    ? slide.layoutType
    : 'title_bullets';

  return {
    sectionId: slide.sectionId || sectionId,
    order: slide.order || 0,
    title: slide.title || '無題のスライド',
    bullets,
    speakerNotes: slide.speakerNotes || '',
    layoutType,
    imageIntent: slide.imageIntent,
  };
}

// =====================================================
// APIハンドラ
// =====================================================

export async function POST(request: NextRequest): Promise<NextResponse<SlideGenerationResponse>> {
  console.log('[generate-slides] === API Route called ===');

  try {
    // ユーザー認証
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const body: SlideGenerationRequest & { sessionId?: string } = await request.json();
    const sessionId = body.sessionId;
    console.log('[generate-slides] Scope:', body.scope);

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
          console.log(`[generate-slides] Insufficient credits: user=${userId}, remaining=${creditCheck.creditsRemaining}`);
          return NextResponse.json(
            { success: false, slides: [], error: '今月のクレジットを使い切りました。翌月のリセットをお待ちください。' },
            { status: 402 }
          );
        }

        const consumeResult = await consumeCredits(userId, 1, sessionId);
        if (!consumeResult.success) {
          console.error(`[generate-slides] Credit consumption failed: user=${userId}, error=${consumeResult.error}`);
          return NextResponse.json(
            { success: false, slides: [], error: 'クレジット消費に失敗しました。再試行してください。' },
            { status: 500 }
          );
        }
        console.log(`[generate-slides] Credit consumed: user=${userId}, credits_before=${creditCheck.creditsRemaining}, cost=1, credits_after=${consumeResult.creditsRemaining}`);
      }
    }

    let generatedSlides: GeneratedSlide[] = [];

    if (body.scope === 'chapter') {
      // 章一括生成
      const chapterRequest = body as ChapterSlideGenerationRequest;
      console.log('[generate-slides] Chapter generation for:', chapterRequest.chapterTitle);
      console.log('[generate-slides] Sections count:', chapterRequest.sections.length);

      if (!chapterRequest.sections || chapterRequest.sections.length === 0) {
        return NextResponse.json(
          { success: false, slides: [], error: 'セクションがありません' },
          { status: 400 }
        );
      }

      const prompt = buildChapterSlidesPrompt(chapterRequest);
      console.log('[generate-slides] Prompt length:', prompt.length);

      const resultWithTokens = await generateJSONWithTokens<{ slides: any[] }>(prompt);
      const result = resultWithTokens.data;
      console.log('[generate-slides] Generated slides count:', result.slides?.length || 0);

      // トークン使用量ログ（Vercel Logs用 構造化出力）
      console.log(`[generate-slides] Token usage: user=${userId || 'anon'}, route=generate-slides(chapter), prompt_tokens=${resultWithTokens.usageMetadata?.promptTokenCount ?? 0}, output_tokens=${resultWithTokens.usageMetadata?.candidatesTokenCount ?? 0}, total_tokens=${resultWithTokens.usageMetadata?.totalTokenCount ?? 0}, duration_ms=${resultWithTokens.durationMs}`);

      // トークンログ保存（スライドテキスト生成分 → Supabase generation_logs）
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
        }).catch(err => console.error('[generate-slides] Token log failed:', err));
      }

      generatedSlides = (result.slides || []).map((slide, index) => {
        const sectionId = slide.sectionId || chapterRequest.sections[0]?.sectionId || 'unknown';
        return normalizeSlide({ ...slide, order: index }, sectionId);
      });

      // 画像生成オプションがONの場合（章一括）
      if (chapterRequest.generateImages) {
        console.log('='.repeat(60));
        console.log('[generate-slides] === IMAGE GENERATION LOOP START (chapter) ===');
        console.log('[generate-slides] Total slides to process:', generatedSlides.length);

        for (let i = 0; i < generatedSlides.length; i++) {
          const slide = generatedSlides[i];
          console.log(`[generate-slides] --- Slide ${i + 1}/${generatedSlides.length} ---`);
          console.log('[generate-slides] Title:', slide.title);
          console.log('[generate-slides] imageIntent:', slide.imageIntent || '(なし)');

          if (slide.imageIntent) {
            console.log('[generate-slides] Calling generateSlideImage with visualPrompt only...');
            // imageIntent のみを visualPrompt として使用（title/bullets は混ぜない）
            const imageResult = await generateSlideImage(slide.imageIntent);
            slide.imageStatus = imageResult.status;
            console.log('[generate-slides] Result status:', imageResult.status);

            if (imageResult.status === 'success' && imageResult.base64) {
              slide.imageBase64 = imageResult.base64;
              slide.imageMimeType = imageResult.mimeType;
              console.log('[generate-slides] ✅ Image generated, base64 length:', imageResult.base64.length);
            } else {
              slide.imageErrorMessage = imageResult.errorMessage;
              console.log('[generate-slides] ❌ Image failed:', imageResult.errorMessage);
            }
          } else {
            slide.imageStatus = 'skipped';
            console.log('[generate-slides] ⏭️ Skipped (no imageIntent)');
          }
        }
        console.log('[generate-slides] === IMAGE GENERATION LOOP END ===');
        console.log('='.repeat(60));
      } else {
        console.log('[generate-slides] generateImages=false, setting all to skipped');
        for (const slide of generatedSlides) {
          slide.imageStatus = 'skipped';
        }
      }

    } else if (body.scope === 'section') {
      // 節単位生成
      const sectionRequest = body as SectionSlideGenerationRequest;
      console.log('[generate-slides] Section generation for:', sectionRequest.section.sectionTitle);

      const prompt = buildSectionSlidesPrompt(
        sectionRequest.courseTitle,
        sectionRequest.chapterTitle,
        sectionRequest.section,
        false, // isFirst - 単独生成では位置不明
        false, // isLast
        1
      );

      const resultWithTokens = await generateJSONWithTokens<{ slides: any[] }>(prompt);
      const result = resultWithTokens.data;
      console.log('[generate-slides] Generated slides count:', result.slides?.length || 0);

      // トークン使用量ログ（Vercel Logs用 構造化出力）
      console.log(`[generate-slides] Token usage: user=${userId || 'anon'}, route=generate-slides(section), prompt_tokens=${resultWithTokens.usageMetadata?.promptTokenCount ?? 0}, output_tokens=${resultWithTokens.usageMetadata?.candidatesTokenCount ?? 0}, total_tokens=${resultWithTokens.usageMetadata?.totalTokenCount ?? 0}, duration_ms=${resultWithTokens.durationMs}`);

      // トークンログ保存（スライドテキスト生成分 → Supabase generation_logs）
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
        }).catch(err => console.error('[generate-slides] Token log failed:', err));
      }

      generatedSlides = (result.slides || []).map((slide, index) =>
        normalizeSlide({ ...slide, order: index }, sectionRequest.section.sectionId)
      );

      // 画像生成オプションがONの場合
      if (sectionRequest.generateImages) {
        console.log('='.repeat(60));
        console.log('[generate-slides] === IMAGE GENERATION LOOP START (section) ===');
        console.log('[generate-slides] Total slides to process:', generatedSlides.length);

        for (let i = 0; i < generatedSlides.length; i++) {
          const slide = generatedSlides[i];
          console.log(`[generate-slides] --- Slide ${i + 1}/${generatedSlides.length} ---`);
          console.log('[generate-slides] Title:', slide.title);
          console.log('[generate-slides] imageIntent:', slide.imageIntent || '(なし)');

          if (slide.imageIntent) {
            console.log('[generate-slides] Calling generateSlideImage with visualPrompt only...');
            // imageIntent のみを visualPrompt として使用（title/bullets は混ぜない）
            const imageResult = await generateSlideImage(slide.imageIntent);
            slide.imageStatus = imageResult.status;
            console.log('[generate-slides] Result status:', imageResult.status);

            if (imageResult.status === 'success' && imageResult.base64) {
              slide.imageBase64 = imageResult.base64;
              slide.imageMimeType = imageResult.mimeType;
              console.log('[generate-slides] ✅ Image generated, base64 length:', imageResult.base64.length);
            } else {
              slide.imageErrorMessage = imageResult.errorMessage;
              console.log('[generate-slides] ❌ Image failed:', imageResult.errorMessage);
            }
          } else {
            slide.imageStatus = 'skipped';
            console.log('[generate-slides] ⏭️ Skipped (no imageIntent)');
          }
        }
        console.log('[generate-slides] === IMAGE GENERATION LOOP END ===');
        console.log('='.repeat(60));
      } else {
        console.log('[generate-slides] generateImages=false, setting all to skipped');
        for (const slide of generatedSlides) {
          slide.imageStatus = 'skipped';
        }
      }
    }

    console.log('[generate-slides] === FINAL RESPONSE ===');
    console.log('[generate-slides] Total slides:', generatedSlides.length);
    generatedSlides.forEach((slide, i) => {
      console.log(`[generate-slides] Slide ${i + 1}: "${slide.title}" | imageStatus=${slide.imageStatus} | hasBase64=${!!slide.imageBase64}`);
    });

    return NextResponse.json({
      success: true,
      slides: generatedSlides,
    });

  } catch (error: any) {
    console.error('[generate-slides] === ERROR ===');
    console.error('[generate-slides] Error message:', error?.message);
    console.error('[generate-slides] Error stack:', error?.stack);

    const status = error?.status || error?.code;
    if ([429, 503, 529].includes(status)) {
      return NextResponse.json(
        { success: false, slides: [], error: 'AIサーバーが混雑しています。少し待ってから再試行してください。' },
        { status: 503 }
      );
    }

    if (error.message?.includes('GEMINI_API_KEY')) {
      return NextResponse.json(
        { success: false, slides: [], error: 'APIキーが設定されていません。' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, slides: [], error: 'スライド生成に失敗しました。再試行してください。' },
      { status: 500 }
    );
  }
}

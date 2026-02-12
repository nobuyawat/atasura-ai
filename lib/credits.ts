/**
 * クレジット管理システム
 *
 * 設計思想:
 * - 表向き（UX）: 5分動画1本 = 11クレジット消費（一括減算）
 * - 裏側（運営）: Gemini APIのtotal_tokensを毎回ログ保存
 *
 * 1クレジット ≒ 333トークン（Gemini Pro安全運用上限から逆算）
 */

import { createClient } from '@/lib/supabase/server';
import { PLAN_CREDITS } from '@/lib/plans';

// 後方互換のため re-export（既存の import { PLAN_CREDITS } from '@/lib/credits' を維持）
export { PLAN_CREDITS };

// =====================================================
// 定数
// =====================================================

/** 5分動画1本あたりのクレジット消費量 */
export const CREDITS_PER_VIDEO = 11;

/** 無料プランの台本生成上限回数（アカウント単位・永続） */
export const FREE_PLAN_SCRIPT_LIMIT = 3;

/** APIアクションタイプ */
export type GenerationActionType =
  | 'outline_generation'
  | 'script_generation'
  | 'slide_generation'
  | 'image_prompt_translation'
  | 'image_generation';

// =====================================================
// 型定義
// =====================================================

export interface CreditCheckResult {
  hasCredits: boolean;
  creditsRemaining: number;
  creditsRequired: number;
  plan: string;
}

export interface CreditConsumeResult {
  success: boolean;
  error?: string;
  creditsConsumed?: number;
  creditsRemaining?: number;
}

export interface GenerationLogEntry {
  sessionId?: string;
  userId: string;
  actionType: GenerationActionType;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  promptLength?: number;
  responseLength?: number;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  courseTitle?: string;
  chapterTitle?: string;
  sectionTitle?: string;
}

// =====================================================
// 無料プラン回数制チェック
// =====================================================

export interface FreePlanCheckResult {
  allowed: boolean;
  plan: string;
  uses: number;
  limit: number;
  locked: boolean;
}

/**
 * 無料プランの台本生成可否をチェック
 * 有料プランは常にallowed=true
 */
export async function checkFreePlanLimit(userId: string): Promise<FreePlanCheckResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('check_free_plan_limit', { p_user_id: userId });

  if (error) {
    console.error('[Credits] check_free_plan_limit RPC failed:', error.message);
    // RPCが未デプロイの場合はフォールバック
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, free_script_uses')
      .eq('user_id', userId)
      .single();

    if (!sub) {
      return { allowed: true, plan: 'free', uses: 0, limit: FREE_PLAN_SCRIPT_LIMIT, locked: false };
    }

    if (sub.plan !== 'free') {
      return { allowed: true, plan: sub.plan, uses: sub.free_script_uses || 0, limit: FREE_PLAN_SCRIPT_LIMIT, locked: false };
    }

    const uses = sub.free_script_uses || 0;
    const locked = uses >= FREE_PLAN_SCRIPT_LIMIT;
    return { allowed: !locked, plan: 'free', uses, limit: FREE_PLAN_SCRIPT_LIMIT, locked };
  }

  const result = data as any;
  return {
    allowed: result.allowed,
    plan: result.plan,
    uses: result.uses,
    limit: result.limit,
    locked: result.locked,
  };
}

/**
 * 無料プランの台本生成回数をインクリメント（生成成功後に呼ぶ）
 */
export async function incrementFreeScriptUses(userId: string): Promise<{ success: boolean; uses?: number; locked?: boolean }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('increment_free_script_uses', { p_user_id: userId });

  if (error) {
    console.error('[Credits] increment_free_script_uses RPC failed:', error.message);
    // RPCが未デプロイの場合のフォールバック：直接+1更新
    try {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('free_script_uses')
        .eq('user_id', userId)
        .single();

      if (sub) {
        await supabase
          .from('subscriptions')
          .update({ free_script_uses: (sub.free_script_uses || 0) + 1 })
          .eq('user_id', userId);
      }
    } catch (fallbackErr) {
      console.warn('[Credits] Fallback increment failed:', fallbackErr);
    }
    return { success: true };
  }

  const result = data as any;
  return {
    success: result.success,
    uses: result.uses,
    locked: result.locked,
  };
}

// =====================================================
// クレジット確認
// =====================================================

/**
 * ユーザーのクレジット残高を確認
 * @param userId ユーザーID
 * @param requiredCredits 必要なクレジット数（デフォルト: 11）
 */
export async function checkCredits(
  userId: string,
  requiredCredits: number = CREDITS_PER_VIDEO
): Promise<CreditCheckResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, credits_remaining, credits_limit')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('[Credits] Failed to check credits:', error?.message);
    return {
      hasCredits: false,
      creditsRemaining: 0,
      creditsRequired: requiredCredits,
      plan: 'free',
    };
  }

  const remaining = data.credits_remaining ?? 0;

  return {
    hasCredits: remaining >= requiredCredits,
    creditsRemaining: remaining,
    creditsRequired: requiredCredits,
    plan: data.plan || 'free',
  };
}

/**
 * ユーザーのクレジット残高のみ取得（軽量版）
 */
export async function getCreditsRemaining(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('subscriptions')
    .select('credits_remaining')
    .eq('user_id', userId)
    .single();

  return data?.credits_remaining ?? 0;
}

// =====================================================
// クレジット消費
// =====================================================

/**
 * クレジットを消費する（動画完成時に呼ぶ）
 * DB関数 consume_credits を呼んでアトミックに減算
 */
export async function consumeCredits(
  userId: string,
  amount: number = CREDITS_PER_VIDEO,
  sessionId?: string
): Promise<CreditConsumeResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc('consume_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_session_id: sessionId || null,
    });

  if (error) {
    console.error('[Credits] consume_credits RPC failed:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }

  const result = data as any;

  if (!result?.success) {
    console.warn('[Credits] Insufficient credits:', result);
    return {
      success: false,
      error: result?.error || 'unknown_error',
      creditsRemaining: result?.credits_remaining,
    };
  }

  console.log(`[Credits] Consumed ${amount} credits. Remaining: ${result.credits_remaining}`);

  return {
    success: true,
    creditsConsumed: result.credits_consumed,
    creditsRemaining: result.credits_remaining,
  };
}

// =====================================================
// 生成セッション管理
// =====================================================

/**
 * 新しい生成セッションを開始
 */
export async function startGenerationSession(
  info: Omit<SessionInfo, 'sessionId'>
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('generation_sessions')
    .insert({
      user_id: info.userId,
      course_title: info.courseTitle,
      chapter_title: info.chapterTitle,
      section_title: info.sectionTitle,
      status: 'in_progress',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Credits] Failed to start session:', error.message);
    return null;
  }

  return data.id;
}

/**
 * 生成セッションを完了（クレジット消費付き）
 */
export async function completeGenerationSession(
  sessionId: string,
  userId: string,
  creditsToCharge: number = CREDITS_PER_VIDEO
): Promise<CreditConsumeResult> {
  return consumeCredits(userId, creditsToCharge, sessionId);
}

/**
 * 生成セッションのトークン合算を更新
 */
export async function updateSessionTokens(
  sessionId: string,
  additionalTokens: number
): Promise<void> {
  const supabase = await createClient();

  // total_tokens を加算
  const { error } = await supabase.rpc('increment_session_tokens', {
    p_session_id: sessionId,
    p_tokens: additionalTokens,
  });

  if (error) {
    // RPCがなければ直接更新（フォールバック）
    console.warn('[Credits] increment_session_tokens RPC not found, using direct update');
    const { data: session } = await supabase
      .from('generation_sessions')
      .select('total_tokens')
      .eq('id', sessionId)
      .single();

    if (session) {
      await supabase
        .from('generation_sessions')
        .update({ total_tokens: (session.total_tokens || 0) + additionalTokens })
        .eq('id', sessionId);
    }
  }
}

// =====================================================
// トークンログ保存
// =====================================================

/**
 * 個別API呼び出しのトークンログを保存
 */
export async function logGenerationTokens(entry: GenerationLogEntry): Promise<void> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('generation_logs')
      .insert({
        session_id: entry.sessionId || null,
        user_id: entry.userId,
        action_type: entry.actionType,
        input_tokens: entry.inputTokens || 0,
        output_tokens: entry.outputTokens || 0,
        total_tokens: entry.totalTokens || 0,
        model: entry.model || 'gemini-2.0-flash',
        prompt_length: entry.promptLength || 0,
        response_length: entry.responseLength || 0,
        duration_ms: entry.durationMs || 0,
        success: entry.success,
        error_message: entry.errorMessage || null,
      });

    if (error) {
      console.error('[Credits] Failed to log tokens:', error.message);
    }

    // セッションのトークン合算も更新
    if (entry.sessionId && entry.totalTokens) {
      await updateSessionTokens(entry.sessionId, entry.totalTokens);
    }
  } catch (err: any) {
    // ログ保存失敗はAPIレスポンスに影響させない
    console.error('[Credits] Token logging error (non-blocking):', err?.message);
  }
}

// =====================================================
// Stripe Webhook用: プランクレジットリセット
// =====================================================

/**
 * プラン変更/更新時にクレジットをリセット
 */
export async function resetCreditsForPlan(
  userId: string,
  plan: string
): Promise<void> {
  const supabase = await createClient();
  const creditLimit = PLAN_CREDITS[plan] || 0;

  const { error } = await supabase
    .from('subscriptions')
    .update({
      credits_limit: creditLimit,
      credits_remaining: creditLimit,
      credits_reset_at: new Date().toISOString(),
      monthly_usage_count: 0,
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[Credits] Failed to reset credits:', error.message);
  } else {
    console.log(`[Credits] Reset credits for user ${userId}: plan=${plan}, credits=${creditLimit}`);
  }
}

-- ===========================================
-- クレジットシステム マイグレーション
-- ===========================================
-- Supabase SQL Editor で実行してください
-- 目的: 5分動画1本 = 11クレジット消費のハイブリッド方式

-- ===========================================
-- 1. subscriptions テーブルにクレジットカラム追加
-- ===========================================

-- 月間クレジット残高
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS credits_remaining INTEGER DEFAULT 0;

-- 月間クレジット上限（プラン別）
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS credits_limit INTEGER DEFAULT 0;

-- クレジットリセット日（月次リセット用）
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMP WITH TIME ZONE;


-- ===========================================
-- 2. generation_sessions テーブル（動画生成セッション単位）
-- ===========================================

CREATE TABLE IF NOT EXISTS public.generation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- セッション情報
  course_title TEXT,
  chapter_title TEXT,
  section_title TEXT,

  -- トークン集計
  total_tokens INTEGER DEFAULT 0,

  -- クレジット消費
  credits_charged INTEGER DEFAULT 0,

  -- 状態
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed', 'cancelled')),

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX IF NOT EXISTS generation_sessions_user_id_idx ON public.generation_sessions(user_id);
CREATE INDEX IF NOT EXISTS generation_sessions_status_idx ON public.generation_sessions(status);
CREATE INDEX IF NOT EXISTS generation_sessions_created_at_idx ON public.generation_sessions(created_at);

-- RLS
ALTER TABLE public.generation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sessions" ON public.generation_sessions;
CREATE POLICY "Users can view their own sessions"
  ON public.generation_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.generation_sessions;
CREATE POLICY "Users can insert their own sessions"
  ON public.generation_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage sessions" ON public.generation_sessions;
CREATE POLICY "Service role can manage sessions"
  ON public.generation_sessions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');


-- ===========================================
-- 3. generation_logs テーブル（個別API呼び出し記録）
-- ===========================================

CREATE TABLE IF NOT EXISTS public.generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.generation_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- アクション情報
  action_type TEXT NOT NULL CHECK (action_type IN (
    'outline_generation',
    'script_generation',
    'slide_generation',
    'image_prompt_translation',
    'image_generation'
  )),

  -- トークン情報（Gemini APIレスポンスから取得）
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  -- メタデータ
  model TEXT,
  prompt_length INTEGER DEFAULT 0,
  response_length INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,

  -- 成否
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS generation_logs_session_id_idx ON public.generation_logs(session_id);
CREATE INDEX IF NOT EXISTS generation_logs_user_id_idx ON public.generation_logs(user_id);
CREATE INDEX IF NOT EXISTS generation_logs_action_type_idx ON public.generation_logs(action_type);
CREATE INDEX IF NOT EXISTS generation_logs_created_at_idx ON public.generation_logs(created_at);

-- RLS
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own logs" ON public.generation_logs;
CREATE POLICY "Users can view their own logs"
  ON public.generation_logs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own logs" ON public.generation_logs;
CREATE POLICY "Users can insert their own logs"
  ON public.generation_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage logs" ON public.generation_logs;
CREATE POLICY "Service role can manage logs"
  ON public.generation_logs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');


-- ===========================================
-- 4. プラン別クレジット初期化関数
-- ===========================================

-- プラン → クレジット上限のマッピング
CREATE OR REPLACE FUNCTION public.get_plan_credits(plan_name TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE plan_name
    WHEN 'free' THEN 33       -- 3本 × 11クレジット
    WHEN 'starter' THEN 66    -- 6本 × 11クレジット
    WHEN 'basic' THEN 165     -- 15本 × 11クレジット
    WHEN 'creator' THEN 330   -- 30本 × 11クレジット
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ===========================================
-- 5. クレジット消費関数（アトミック操作）
-- ===========================================

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_session_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  current_credits INTEGER;
  new_credits INTEGER;
  result JSONB;
BEGIN
  -- 現在のクレジットを取得（FOR UPDATE でロック）
  SELECT credits_remaining INTO current_credits
  FROM public.subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF current_credits IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'subscription_not_found',
      'credits_remaining', 0
    );
  END IF;

  IF current_credits < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'credits_remaining', current_credits,
      'credits_required', p_amount
    );
  END IF;

  -- クレジット減算
  new_credits := current_credits - p_amount;

  UPDATE public.subscriptions
  SET credits_remaining = new_credits,
      monthly_usage_count = monthly_usage_count + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- セッションのcredits_chargedを更新
  IF p_session_id IS NOT NULL THEN
    UPDATE public.generation_sessions
    SET credits_charged = p_amount,
        status = 'completed',
        completed_at = NOW()
    WHERE id = p_session_id AND user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'credits_consumed', p_amount,
    'credits_remaining', new_credits
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===========================================
-- 6. セッションのトークン加算関数
-- ===========================================

CREATE OR REPLACE FUNCTION public.increment_session_tokens(
  p_session_id UUID,
  p_tokens INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.generation_sessions
  SET total_tokens = COALESCE(total_tokens, 0) + p_tokens
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===========================================
-- 7. 既存ユーザーのクレジット初期化
-- ===========================================

-- 既存のsubscriptionsにクレジットを付与
UPDATE public.subscriptions
SET
  credits_limit = public.get_plan_credits(plan),
  credits_remaining = public.get_plan_credits(plan),
  credits_reset_at = COALESCE(current_period_start, NOW())
WHERE credits_remaining = 0 OR credits_remaining IS NULL;


-- ===========================================
-- 完了
-- ===========================================
-- マイグレーション完了！
-- 次に、Stripe Webhook でプラン変更時にクレジットをリセットする処理を追加してください

-- ===========================================
-- 003: 無料プランロック + クレジット値統一
-- ===========================================
-- 目的:
-- 1. PLAN_CREDITS を料金ページ表示値に一致させる
-- 2. 無料プランの台本生成回数制限（2分台本×3回）を実装
-- 3. get_plan_credits() を更新

-- ===========================================
-- 1. get_plan_credits() を料金ページ表示値に統一
-- ===========================================

CREATE OR REPLACE FUNCTION public.get_plan_credits(plan_name TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE plan_name
    WHEN 'free' THEN 0         -- 無料プランは回数制（2分台本×3回）で管理
    WHEN 'starter' THEN 30     -- 5分台本 × 2本目安
    WHEN 'basic' THEN 300      -- 5分台本 × 25〜30本目安
    WHEN 'creator' THEN 600    -- 5分台本 × 50〜60本目安
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ===========================================
-- 2. subscriptions テーブルに無料プラン回数管理カラム追加
-- ===========================================

-- 無料プランの台本生成使用回数（アカウント永続）
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS free_script_uses INTEGER DEFAULT 0;


-- ===========================================
-- 3. 無料プラン台本生成の回数チェック + インクリメント関数
-- ===========================================

-- 無料プランの生成可否チェック（SELECT用・副作用なし）
CREATE OR REPLACE FUNCTION public.check_free_plan_limit(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_plan TEXT;
  v_uses INTEGER;
  v_limit CONSTANT INTEGER := 3;
BEGIN
  SELECT plan, free_script_uses
  INTO v_plan, v_uses
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  IF v_plan IS NULL THEN
    -- サブスクリプション未登録は無料扱い・使用回数0
    RETURN jsonb_build_object(
      'allowed', true,
      'plan', 'free',
      'uses', 0,
      'limit', v_limit,
      'locked', false
    );
  END IF;

  -- 有料プランは常にOK（この関数はスキップ用）
  IF v_plan != 'free' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'plan', v_plan,
      'uses', v_uses,
      'limit', v_limit,
      'locked', false
    );
  END IF;

  -- 無料プランの場合
  IF v_uses >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'plan', 'free',
      'uses', v_uses,
      'limit', v_limit,
      'locked', true
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', true,
      'plan', 'free',
      'uses', v_uses,
      'limit', v_limit,
      'locked', false
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 無料プランの生成回数をインクリメント（成功時に呼ぶ）
CREATE OR REPLACE FUNCTION public.increment_free_script_uses(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_plan TEXT;
  v_uses INTEGER;
  v_limit CONSTANT INTEGER := 3;
BEGIN
  SELECT plan, free_script_uses
  INTO v_plan, v_uses
  FROM public.subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- 有料プランはインクリメント不要
  IF v_plan IS NULL OR v_plan != 'free' THEN
    RETURN jsonb_build_object('success', true, 'skipped', true);
  END IF;

  -- 上限チェック
  IF v_uses >= v_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'free_plan_limit_reached',
      'uses', v_uses,
      'limit', v_limit
    );
  END IF;

  -- インクリメント
  UPDATE public.subscriptions
  SET free_script_uses = free_script_uses + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'uses', v_uses + 1,
    'limit', v_limit,
    'locked', (v_uses + 1) >= v_limit
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===========================================
-- 4. 既存の無料プランユーザーのクレジットを0にリセット
-- ===========================================

UPDATE public.subscriptions
SET credits_limit = 0,
    credits_remaining = 0
WHERE plan = 'free';

-- 既存の有料プランユーザーのクレジット上限を新しい値に更新
-- ※残りクレジットは比率を維持（上限変更に合わせてスケール）
-- 注意: これは初回マイグレーション時のみ実行
-- starter: 66 → 30
UPDATE public.subscriptions
SET credits_limit = 30,
    credits_remaining = LEAST(credits_remaining, 30)
WHERE plan = 'starter' AND credits_limit = 66;

-- basic: 165 → 300
UPDATE public.subscriptions
SET credits_limit = 300,
    credits_remaining = CASE
      WHEN credits_remaining = credits_limit THEN 300
      ELSE LEAST(credits_remaining + (300 - 165), 300)
    END
WHERE plan = 'basic' AND credits_limit = 165;

-- creator: 330 → 600
UPDATE public.subscriptions
SET credits_limit = 600,
    credits_remaining = CASE
      WHEN credits_remaining = credits_limit THEN 600
      ELSE LEAST(credits_remaining + (600 - 330), 600)
    END
WHERE plan = 'creator' AND credits_limit = 330;


-- ===========================================
-- 完了
-- ===========================================
-- マイグレーション完了！
-- 実行後:
-- 1. 無料プランユーザーはクレジット0、free_script_uses で2分台本×3回管理
-- 2. 有料プランのクレジット上限が料金ページ表示と一致

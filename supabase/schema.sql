-- ===========================================
-- アタスラAI Bプラン データベーススキーマ
-- ===========================================
-- Supabase SQL Editor で実行してください

-- ===========================================
-- 1. profilesテーブル（ユーザープロフィール）
-- ===========================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);

-- RLSを有効化
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 自分のプロフィールのみ閲覧・編集可能
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);


-- ===========================================
-- 2. subscriptionsテーブル（サブスクリプション管理）
-- ===========================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stripe情報
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- プラン情報
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'basic', 'creator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid')),

  -- 期間情報
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,

  -- 使用量追跡
  monthly_usage_count INTEGER DEFAULT 0,
  monthly_usage_reset_at TIMESTAMP WITH TIME ZONE,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_idx ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions(status);

-- RLSを有効化
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 自分のサブスクリプションのみ閲覧可能
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.subscriptions;
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- service_roleのみがサブスクリプションを管理可能（Webhook経由）
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON public.subscriptions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');


-- ===========================================
-- 3. トリガー関数: 新規ユーザー登録時に自動作成
-- ===========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- profilesテーブルにレコード作成
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  -- subscriptionsテーブルに無料プランでレコード作成
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガー
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ===========================================
-- 4. トリガー関数: updated_atの自動更新
-- ===========================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();


-- ===========================================
-- 5. 便利な関数
-- ===========================================

-- 現在のユーザーのプランを取得
CREATE OR REPLACE FUNCTION public.get_current_user_plan()
RETURNS TEXT AS $$
DECLARE
  user_plan TEXT;
BEGIN
  SELECT COALESCE(plan, 'free') INTO user_plan
  FROM public.subscriptions
  WHERE user_id = auth.uid();

  RETURN COALESCE(user_plan, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ユーザーが特定のプラン以上かチェック
CREATE OR REPLACE FUNCTION public.has_plan_access(required_plan TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_plan TEXT;
  plan_levels JSONB := '{"free": 0, "starter": 1, "basic": 2, "creator": 3}'::JSONB;
BEGIN
  SELECT COALESCE(plan, 'free') INTO user_plan
  FROM public.subscriptions
  WHERE user_id = auth.uid() AND status = 'active';

  user_plan := COALESCE(user_plan, 'free');

  RETURN (plan_levels ->> user_plan)::INT >= (plan_levels ->> required_plan)::INT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===========================================
-- 完了
-- ===========================================
-- スキーマのセットアップが完了しました！

-- ===========================================
-- Stripe Billing マイグレーション
-- ===========================================
-- Supabase SQL Editor で実行してください
-- 目的: プラン変更（アップ/ダウングレード）、解約、返金申請の基盤

-- ===========================================
-- 1. subscriptions テーブルにカラム追加
-- ===========================================

-- 現行Stripe Price ID（webhookで自動設定）
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS price_id TEXT;

-- ダウングレード予定のPrice ID（Subscription Schedule使用時に設定）
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_price_id TEXT;


-- ===========================================
-- 2. refund_requests テーブル（返金申請）
-- ===========================================

CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS refund_requests_user_id_idx
  ON public.refund_requests(user_id);
CREATE INDEX IF NOT EXISTS refund_requests_status_idx
  ON public.refund_requests(status);

-- RLS有効化
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: 自分の返金申請のみ閲覧可能
DROP POLICY IF EXISTS "Users can view own refund requests" ON public.refund_requests;
CREATE POLICY "Users can view own refund requests"
  ON public.refund_requests
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLSポリシー: 自分の返金申請のみ作成可能
DROP POLICY IF EXISTS "Users can insert own refund requests" ON public.refund_requests;
CREATE POLICY "Users can insert own refund requests"
  ON public.refund_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- service_roleのみが返金申請を管理可能
DROP POLICY IF EXISTS "Service role can manage refund requests" ON public.refund_requests;
CREATE POLICY "Service role can manage refund requests"
  ON public.refund_requests
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- updated_at 自動更新トリガー
DROP TRIGGER IF EXISTS refund_requests_updated_at ON public.refund_requests;
CREATE TRIGGER refund_requests_updated_at
  BEFORE UPDATE ON public.refund_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();


-- ===========================================
-- 完了
-- ===========================================
-- マイグレーション完了！
-- 次に、Stripe Dashboard で以下を設定してください:
-- 1. Webhook に subscription_schedule.canceled, subscription_schedule.released イベントを追加
-- 2. Customer Portal で「プラン変更」「解約」ボタンをOFF、「請求書履歴」のみON

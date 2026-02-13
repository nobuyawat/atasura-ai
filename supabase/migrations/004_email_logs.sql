-- ============================================================
-- Migration 004: email_logs — メール送信ログ & 冪等性保証
-- ============================================================
-- Stripe event.id を UNIQUE 制約で保存し、
-- 同一イベントからの二重メール送信を防止する。

CREATE TABLE IF NOT EXISTS email_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text        UNIQUE NOT NULL,
  user_id         uuid        NULL,
  email           text        NOT NULL,
  type            text        NOT NULL,           -- 'welcome' | 'payment_failed' etc.
  status          text        NOT NULL DEFAULT 'sent',  -- 'sent' | 'failed'
  error_message   text        NULL,
  payload         jsonb       NULL,               -- session要約などデバッグ用
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- インデックス: 重複チェック高速化
CREATE INDEX IF NOT EXISTS idx_email_logs_stripe_event_id ON email_logs (stripe_event_id);

-- インデックス: ユーザー別照会用
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs (user_id);

-- RLS: サーバー（service_role）のみ読み書き可能
-- クライアント（anon）からは直接アクセスさせない
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- service_role は全操作可能
CREATE POLICY "service_role_all" ON email_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

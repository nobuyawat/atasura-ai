-- ============================================================
-- Migration 006: usage_logs — 冪等性・ステータス管理カラム追加
-- ============================================================
-- 目的:
-- 1. request_id で同一リクエストの二重クレジット消費を防止
-- 2. status で成功/失敗を記録（失敗時はクレジット消費しない）
-- 3. error_message で失敗原因を記録

-- request_id: フロントから渡す UUID。同じ request_id での二重消費を防止
ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS request_id UUID NULL;

-- status: SUCCESS / FAILED / PENDING
ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'SUCCESS'
  CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING'));

-- error_message: 失敗時のエラー概要（短縮）
ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS error_message TEXT NULL;

-- request_id のユニークインデックス（同一 request_id は1行のみ）
-- NULLは複数OK（既存データの後方互換）
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_logs_request_id
  ON usage_logs (request_id)
  WHERE request_id IS NOT NULL;

-- status 別の集計用インデックス
CREATE INDEX IF NOT EXISTS idx_usage_logs_status
  ON usage_logs (status);

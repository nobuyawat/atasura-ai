/**
 * ベースURL解決ユーティリティ
 *
 * 優先順:
 *   1. NEXT_PUBLIC_APP_URL（明示指定 — 本番では https://atasura-ai.vercel.app）
 *   2. VERCEL_URL（Vercel が自動注入 — preview deploy 等）
 *   3. http://localhost:3000（ローカル開発フォールバック）
 */

export function getBaseUrl(): string {
  // 1. 明示的に設定された本番URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  }

  // 2. Vercel が自動注入する VERCEL_URL（プロトコルなし）
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 3. ローカル開発
  return 'http://localhost:3000';
}

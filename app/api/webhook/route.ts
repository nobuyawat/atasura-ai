/**
 * Stripe Webhook エイリアス
 * POST /api/webhook → /api/stripe/webhook と同じハンドラ
 *
 * Stripe Dashboard の Webhook URL が /api/webhook に設定されている場合の互換ルート。
 * 実体は app/api/stripe/webhook/route.ts にある。
 */

export { POST } from '@/app/api/stripe/webhook/route';

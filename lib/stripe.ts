/**
 * Stripe 共通ヘルパー
 *
 * Stripe クライアント初期化のみ。
 * プラン関連ユーティリティは lib/plans.ts に集約。
 *
 * 後方互換のため plans.ts のエクスポートを re-export する。
 */

import Stripe from 'stripe';

// =====================================================
// Stripe クライアント（シングルトン）
// =====================================================

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// =====================================================
// 後方互換 re-export（lib/plans.ts に移行済み）
// 既存 import { ... } from '@/lib/stripe' が動くようにする
// =====================================================

export {
  getPlanFromPriceId,
  getPriceIdForPlan,
  resolvePlanFromPrice,
  getPlanRank,
  isUpgrade,
  isDowngrade,
  getPlanDisplayName,
  PLAN_CREDITS,
  PLAN_RANK,
  PAID_PLANS,
  ALL_PLANS,
  type PlanName,
} from '@/lib/plans';

/**
 * プラン定義 — Single Source of Truth
 *
 * 方針B: 環境変数（process.env.STRIPE_PRICE_ID_*）で Price ID を管理。
 * テスト / 本番の切替は .env.local / Vercel 環境変数で行う。
 * lookup_key / ハードコード Price ID には依存しない。
 */

// =====================================================
// プラン名の型
// =====================================================

export type PlanName = 'free' | 'starter' | 'basic' | 'creator';

// =====================================================
// クレジット上限（料金ページ表示値と完全一致）
// =====================================================

export const PLAN_CREDITS: Record<string, number> = {
  free: 0,
  starter: 30,
  basic: 300,
  creator: 600,
};

// =====================================================
// プランランク（数値が大きいほど上位）
// =====================================================

export const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  basic: 2,
  creator: 3,
};

// =====================================================
// Price ID 取得（環境変数から）
// =====================================================

/**
 * プラン名 → 環境変数の Price ID を返す
 * free は Stripe Price 不要なので undefined
 */
function getEnvPriceId(plan: PlanName): string | undefined {
  switch (plan) {
    case 'starter': return process.env.STRIPE_PRICE_ID_STARTER;
    case 'basic':   return process.env.STRIPE_PRICE_ID_BASIC;
    case 'creator': return process.env.STRIPE_PRICE_ID_CREATOR;
    default:        return undefined;
  }
}

/**
 * Price ID → プラン名の逆引きマップを構築（起動時に1回）
 * 環境変数の値で動的に作るので、テスト/本番どちらでも動く
 */
function buildPriceIdToPlanMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const entries: [PlanName, string | undefined][] = [
    ['starter', process.env.STRIPE_PRICE_ID_STARTER],
    ['basic',   process.env.STRIPE_PRICE_ID_BASIC],
    ['creator', process.env.STRIPE_PRICE_ID_CREATOR],
  ];
  for (const [plan, priceId] of entries) {
    if (priceId) {
      map[priceId] = plan;
    }
  }
  return map;
}

// =====================================================
// ユーティリティ関数
// =====================================================

/**
 * プラン名から Price ID を取得
 * checkout / upgrade / downgrade で使用
 *
 * 同期関数に変更（Stripe API 呼び出し不要）
 * 後方互換のため async シグネチャを維持
 */
export async function getPriceIdForPlan(plan: string): Promise<string> {
  const validPlans: PlanName[] = ['starter', 'basic', 'creator'];
  if (!validPlans.includes(plan as PlanName)) {
    throw new Error(`Unknown or non-purchasable plan: ${plan}`);
  }

  const priceId = getEnvPriceId(plan as PlanName);
  if (!priceId) {
    throw new Error(
      `Price ID not configured for plan "${plan}". ` +
      `Set STRIPE_PRICE_ID_${plan.toUpperCase()} in environment variables.`
    );
  }

  return priceId;
}

/**
 * Price ID からプラン名を解決（同期版 — webhook 等で使用）
 *
 * lookup_key が price オブジェクトに含まれていればそれも参照するが、
 * 主たる判定は環境変数ベースの逆引きマップ。
 */
export function resolvePlanFromPrice(price: { id: string; lookup_key?: string | null }): string {
  const map = buildPriceIdToPlanMap();

  // 1. 環境変数ベースの逆引き（最優先）
  if (map[price.id]) {
    return map[price.id];
  }

  // 2. lookup_key フォールバック（Stripe Dashboard に設定済みの場合）
  if (price.lookup_key) {
    const lkMap: Record<string, string> = {
      starter_monthly: 'starter',
      basic_monthly: 'basic',
      creator_monthly: 'creator',
      free_monthly: 'free',
    };
    if (lkMap[price.lookup_key]) {
      return lkMap[price.lookup_key];
    }
  }

  console.warn(`[Plans] Unknown price: id=${price.id}, lookup_key=${price.lookup_key}`);
  return 'free';
}

/**
 * Price ID だけからプラン名を解決（レガシー互換）
 * webhook 等で price オブジェクト全体がない場合に使用
 */
export function getPlanFromPriceId(priceId: string): string {
  const map = buildPriceIdToPlanMap();
  if (map[priceId]) {
    return map[priceId];
  }
  console.warn(`[Plans] Unknown price_id: ${priceId}`);
  return 'free';
}

/**
 * プランのランク（数値）を取得
 */
export function getPlanRank(plan: string): number {
  return PLAN_RANK[plan] ?? 0;
}

/**
 * アップグレードかどうか判定
 */
export function isUpgrade(fromPlan: string, toPlan: string): boolean {
  return getPlanRank(toPlan) > getPlanRank(fromPlan);
}

/**
 * ダウングレードかどうか判定
 */
export function isDowngrade(fromPlan: string, toPlan: string): boolean {
  return getPlanRank(toPlan) < getPlanRank(fromPlan);
}

/**
 * プラン名の日本語表示名
 */
export function getPlanDisplayName(plan: string): string {
  const names: Record<string, string> = {
    free: '無料プラン',
    starter: 'スタータープラン',
    basic: 'ベーシックプラン',
    creator: 'クリエイタープラン',
  };
  return names[plan] || plan;
}

/**
 * 全有料プラン一覧
 */
export const PAID_PLANS = ['starter', 'basic', 'creator'] as const;

/**
 * 全プラン一覧（ランク順）
 */
export const ALL_PLANS = ['free', 'starter', 'basic', 'creator'] as const;

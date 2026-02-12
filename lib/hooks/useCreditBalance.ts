'use client';

import { useState, useEffect, useCallback } from 'react';

interface FreePlanInfo {
  uses: number;
  limit: number;
  locked: boolean;
}

interface CreditBalance {
  creditsRemaining: number;
  creditsLimit: number;
  creditsPerVideo: number;
  plan: string;
  hasCredits: boolean;
  videosRemaining: number;
  videosLimit: number;
  freePlan: FreePlanInfo;
}

/**
 * クレジット残高を取得するフック
 * エディタ内で使用し、AI操作ボタン近くに残高を表示
 * 無料プランの回数制情報も含む
 */
export function useCreditBalance() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/credits');
      if (!res.ok) {
        // 認証エラーの場合は静かに無視（ログインしていない等）
        if (res.status === 401) {
          setBalance(null);
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to fetch credits');
      }
      const data: CreditBalance = await res.json();
      setBalance(data);
      setError(null);
    } catch (err: any) {
      console.error('[useCreditBalance] Error:', err?.message);
      setError(err?.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, isLoading, error, refetch: fetchBalance };
}

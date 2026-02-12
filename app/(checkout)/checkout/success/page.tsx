'use client';

/**
 * Checkout成功ページ (/checkout/success)
 *
 * Stripe Checkout 完了後にリダイレクトされるページ。
 * Webhook が遅延・未到達の場合に備え、verify-session API で
 * Stripe → Supabase のバックフィルを実行する。
 */

import { useEffect, useState, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, ArrowRight, Sparkles, Loader2, AlertTriangle } from 'lucide-react';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [countdown, setCountdown] = useState(8); // バックフィル待ちのため少し長めに
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'ok' | 'error'>('syncing');
  const [syncPlan, setSyncPlan] = useState<string | null>(null);

  // バックフィル: verify-session API を呼んで DB を確実に更新
  const verifySession = useCallback(async () => {
    if (!sessionId) {
      setSyncStatus('ok'); // session_id なしなら何もしない
      return;
    }

    console.log('[SuccessPage] Verifying session:', sessionId);

    // リトライ付きで verify-session を呼ぶ（Webhook と競合しないよう少し待つ）
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // 初回は 2 秒待つ（Webhook に先に処理させる猶予）
        if (attempt === 1) {
          await new Promise(r => setTimeout(r, 2000));
        } else {
          await new Promise(r => setTimeout(r, 3000));
        }

        const res = await fetch('/api/stripe/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const data = await res.json();
        console.log(`[SuccessPage] Verify attempt ${attempt}:`, data);

        if (res.ok && data.status === 'ok') {
          setSyncStatus('ok');
          setSyncPlan(data.plan);
          return;
        }

        // まだ pending（支払い処理中）ならリトライ
        if (data.status === 'pending') {
          console.log(`[SuccessPage] Payment pending, retry ${attempt}/3...`);
          continue;
        }

        // エラーならリトライ
        console.warn(`[SuccessPage] Verify returned error:`, data.error);
      } catch (err) {
        console.error(`[SuccessPage] Verify attempt ${attempt} failed:`, err);
      }
    }

    // 全リトライ失敗
    setSyncStatus('error');
  }, [sessionId]);

  // マウント時にバックフィル実行
  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // 自動リダイレクト（バックフィル完了後）
  useEffect(() => {
    if (syncStatus !== 'ok') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = '/app';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [syncStatus]);

  return (
    <div className="min-h-screen bg-[#05060f] text-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-green-500/20 rounded-full mb-4">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-black mb-4">
          お申し込み<span className="text-green-400">完了</span>！
        </h1>
        <p className="text-gray-400 mb-8">
          有料プランへのアップグレードが完了しました。
          <br />
          すべての機能をお楽しみください。
        </p>

        {/* Sync Status */}
        {syncStatus === 'syncing' && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-6">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>プラン情報を同期中...</span>
          </div>
        )}

        {syncStatus === 'error' && (
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-start gap-2 text-sm text-yellow-400">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold">プラン同期に時間がかかっています</p>
                <p className="text-yellow-400/70 mt-1">
                  決済は正常に完了しています。プランの反映には数分かかる場合があります。
                  反映されない場合はページをリロードしてください。
                </p>
              </div>
            </div>
          </div>
        )}

        {syncPlan && syncStatus === 'ok' && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2 mb-6 text-sm text-green-400 font-bold">
            {syncPlan}プラン が有効になりました
          </div>
        )}

        {/* Features */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            利用可能になった機能
          </h3>
          <ul className="space-y-3 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              長時間の台本作成
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              スライド大量生成
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              修正・再生成OK
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              商用利用OK
            </li>
          </ul>
        </div>

        {/* Redirect Notice */}
        {syncStatus === 'ok' && (
          <p className="text-gray-500 text-sm mb-6">
            {countdown}秒後に自動的にアプリに移動します...
          </p>
        )}

        {/* CTA */}
        <Link
          href="/app"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#FF1E56] to-purple-600 text-white rounded-full font-bold text-lg transition-all hover:opacity-90"
        >
          アプリを開く
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}

// ローディングフォールバック
function CheckoutSuccessLoading() {
  return (
    <div className="min-h-screen bg-[#05060f] text-white flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#FF1E56]" />
    </div>
  );
}

// Suspenseでラップしたエクスポート
export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<CheckoutSuccessLoading />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}

'use client';

/**
 * プラン管理ページ (/app/plan)
 * 認証必須 - サブスクリプション管理・プラン変更・解約・返金申請
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Crown,
  ArrowUpCircle,
  ArrowDownCircle,
  XCircle,
  RotateCcw,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// =============================================================
// 型定義
// =============================================================

interface SubscriptionInfo {
  plan: string;
  planDisplayName: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  pendingPlan: string | null;
  pendingPlanDisplayName: string | null;
  hasStripeCustomer: boolean;
  creditsRemaining: number;
  creditsLimit: number;
}

// =============================================================
// プラン定義
// =============================================================

const PLAN_INFO: Record<string, { rank: number; price: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  free: { rank: 0, price: '¥0', emoji: '🆓', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30' },
  starter: { rank: 1, price: '¥500/月', emoji: '🌱', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
  basic: { rank: 2, price: '¥990/月', emoji: '⭐', color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/30' },
  creator: { rank: 3, price: '¥1,980/月', emoji: '🔥', color: 'text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
};

const PLAN_NAMES: Record<string, string> = {
  free: '無料プラン',
  starter: 'スタータープラン',
  basic: 'ベーシックプラン',
  creator: 'クリエイタープラン',
};

// =============================================================
// コンポーネント
// =============================================================

export default function PlanManagementPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ action: string; plan?: string; message: string } | null>(null);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundForm, setRefundForm] = useState({ email: '', purchaseDate: '', reason: '' });
  const [userEmail, setUserEmail] = useState('');

  // データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        // ユーザー情報取得
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUserEmail(user.email || '');
        setRefundForm(prev => ({ ...prev, email: user.email || '' }));

        // サブスクリプション情報取得
        const res = await fetch('/api/stripe/subscription', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setSubscription(data);
        }
      } catch (err) {
        console.error('Failed to fetch subscription:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  // メッセージ自動消去
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // サブスク情報再取得
  const refetchSubscription = async () => {
    const res = await fetch('/api/stripe/subscription', { cache: 'no-store' });
    if (res.ok) {
      setSubscription(await res.json());
    }
  };

  // アクション実行
  const executeAction = async (action: string, plan?: string) => {
    setConfirmDialog(null);
    setActionLoading(action);
    setMessage(null);

    try {
      let res: Response;

      switch (action) {
        case 'upgrade':
          res = await fetch('/api/stripe/subscription/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPlan: plan }),
          });
          break;
        case 'downgrade':
          res = await fetch('/api/stripe/subscription/downgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPlan: plan }),
          });
          break;
        case 'cancel':
          res = await fetch('/api/stripe/subscription/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          break;
        case 'reactivate':
          res = await fetch('/api/stripe/subscription/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reactivate: true }),
          });
          break;
        case 'portal':
          res = await fetch('/api/stripe/portal', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            window.location.href = data.url;
            return;
          }
          break;
        default:
          return;
      }

      const data = await res!.json();

      if (res!.ok) {
        setMessage({ type: 'success', text: data.message || '操作が完了しました' });
        // 少し待ってから再取得（Webhookの反映待ち）
        setTimeout(refetchSubscription, 1500);
      } else {
        setMessage({ type: 'error', text: data.error || 'エラーが発生しました' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'ネットワークエラーが発生しました' });
    } finally {
      setActionLoading(null);
    }
  };

  // 返金申請送信
  const handleRefundSubmit = async () => {
    setActionLoading('refund');
    setMessage(null);

    try {
      const res = await fetch('/api/stripe/refund-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: refundForm.email,
          purchaseDate: refundForm.purchaseDate,
          reason: refundForm.reason,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        setRefundForm({ email: userEmail, purchaseDate: '', reason: '' });
        setShowRefundForm(false);
      } else {
        setMessage({ type: 'error', text: data.error || '返金申請に失敗しました' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'ネットワークエラーが発生しました' });
    } finally {
      setActionLoading(null);
    }
  };

  // ローディング
  if (loading) {
    return (
      <div className="min-h-screen bg-[#05060f] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-pink-500 animate-spin" />
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-[#05060f] text-white flex items-center justify-center">
        <p className="text-gray-400">サブスクリプション情報を取得できませんでした</p>
      </div>
    );
  }

  const currentPlanInfo = PLAN_INFO[subscription.plan] || PLAN_INFO.free;
  const isFree = subscription.plan === 'free';
  const isCanceling = subscription.cancelAtPeriodEnd;
  const hasPendingDowngrade = !!subscription.pendingPlan;

  // アップグレード可能なプラン
  const upgradePlans = Object.entries(PLAN_INFO)
    .filter(([key, info]) => info.rank > currentPlanInfo.rank && key !== 'free')
    .map(([key]) => key);

  // ダウングレード可能なプラン
  const downgradePlans = Object.entries(PLAN_INFO)
    .filter(([key, info]) => info.rank < currentPlanInfo.rank && key !== 'free')
    .map(([key]) => key);

  return (
    <div className="min-h-screen bg-[#05060f] text-white">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 px-6 py-4 bg-[#05060f]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">アプリに戻る</span>
          </Link>
          <h1 className="text-lg font-bold">プラン管理</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* メッセージ表示 */}
        {message && (
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        {/* ===== 現在のプラン ===== */}
        <section className={`p-6 rounded-2xl border ${currentPlanInfo.bgColor} ${currentPlanInfo.borderColor}`}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{currentPlanInfo.emoji}</span>
            <div>
              <h2 className="text-xl font-bold">{PLAN_NAMES[subscription.plan] || subscription.plan}</h2>
              <p className={`text-sm ${currentPlanInfo.color}`}>{currentPlanInfo.price}</p>
            </div>
            <div className="ml-auto">
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                subscription.status === 'active' ? 'bg-green-500/20 text-green-400' :
                subscription.status === 'past_due' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {subscription.status === 'active' ? 'アクティブ' :
                 subscription.status === 'past_due' ? '支払い遅延' :
                 subscription.status === 'canceled' ? '解約済み' : subscription.status}
              </span>
            </div>
          </div>

          {/* クレジット残高 / 無料プラン回数表示 */}
          {subscription.plan === 'free' ? (
            <div className="mb-4 p-3 rounded-lg bg-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">台本生成（2分台本）</span>
                <span className="font-bold">無料枠: 3回まで</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                ※スターター以上で本格的なAI台本生成が利用可能です
              </p>
            </div>
          ) : (
            <div className="mb-4 p-3 rounded-lg bg-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">クレジット残高</span>
                <span className="font-bold">{subscription.creditsRemaining} / {subscription.creditsLimit}</span>
              </div>
              <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${subscription.creditsLimit > 0 ? (subscription.creditsRemaining / subscription.creditsLimit) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* 次回更新日 */}
          {subscription.currentPeriodEnd && (
            <p className="text-sm text-gray-400">
              次回更新日: {new Date(subscription.currentPeriodEnd).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}

          {/* 解約予定 */}
          {isCanceling && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-400">
                次回更新日にサブスクリプションが解約されます
              </span>
            </div>
          )}

          {/* ダウングレード予定 */}
          {hasPendingDowngrade && !isCanceling && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <ArrowDownCircle className="w-4 h-4 text-yellow-400 shrink-0" />
              <span className="text-sm text-yellow-400">
                次回更新日に{subscription.pendingPlanDisplayName}に変更されます
              </span>
            </div>
          )}
        </section>

        {/* ===== プラン変更 ===== */}
        {!isFree && !isCanceling && (
          <section className="p-6 rounded-2xl bg-[#161B22] border border-white/10">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              プラン変更
            </h3>

            {/* 請求タイミング注記 */}
            <div className="mb-5 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
              <p className="text-xs text-blue-300 leading-relaxed">
                💡 アップグレードは即時反映され、日割り差額が請求されます。請求がクレジットカードに反映されるまで数分〜数時間かかる場合があります。
                ダウングレードは次回更新日から適用されます。
              </p>
            </div>

            {/* アップグレード */}
            {upgradePlans.length > 0 && (
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-3">⬆️ アップグレード（即時反映・日割り請求）</p>
                <div className="flex flex-wrap gap-3">
                  {upgradePlans.map(plan => {
                    const info = PLAN_INFO[plan];
                    return (
                      <button
                        key={plan}
                        onClick={() => setConfirmDialog({
                          action: 'upgrade',
                          plan,
                          message: `${PLAN_NAMES[plan]}（${info.price}）にアップグレードしますか？\n\n日割り計算で差額が請求される場合があります。`,
                        })}
                        disabled={!!actionLoading}
                        className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all hover:scale-105 active:scale-95 disabled:opacity-50 ${info.bgColor} ${info.borderColor} hover:bg-opacity-20`}
                      >
                        <ArrowUpCircle className={`w-4 h-4 ${info.color}`} />
                        <span className="font-bold text-sm">{PLAN_NAMES[plan]}</span>
                        <span className="text-xs text-gray-400">{info.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ダウングレード */}
            {downgradePlans.length > 0 && !hasPendingDowngrade && (
              <div>
                <p className="text-sm text-gray-400 mb-3">⬇️ ダウングレード（次回更新日から反映）</p>
                <div className="flex flex-wrap gap-3">
                  {downgradePlans.map(plan => {
                    const info = PLAN_INFO[plan];
                    return (
                      <button
                        key={plan}
                        onClick={() => setConfirmDialog({
                          action: 'downgrade',
                          plan,
                          message: `${PLAN_NAMES[plan]}（${info.price}）にダウングレードしますか？\n\n変更は次回更新日から適用されます。今月は現在のプランをそのままご利用いただけます。`,
                        })}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                      >
                        <ArrowDownCircle className="w-4 h-4 text-gray-400" />
                        <span className="font-bold text-sm">{PLAN_NAMES[plan]}</span>
                        <span className="text-xs text-gray-400">{info.price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 無料プランの場合のアップグレード案内 */}
        {isFree && (
          <section className="p-6 rounded-2xl bg-[#161B22] border border-white/10">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              プランをアップグレード
            </h3>
            <p className="text-sm text-gray-400 mb-4">有料プランに加入すると、より多くの台本・スライドを生成できます。</p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-pink-500/20"
            >
              <ArrowUpCircle className="w-5 h-5" />
              料金プランを見る
            </Link>
          </section>
        )}

        {/* ===== 解約 ===== */}
        {!isFree && (
          <section className="p-6 rounded-2xl bg-[#161B22] border border-white/10">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-gray-400" />
              解約
            </h3>

            {isCanceling ? (
              <div>
                <p className="text-sm text-gray-400 mb-4">
                  サブスクリプションは次回更新日に解約される予定です。解約を取り消すことができます。
                </p>
                <button
                  onClick={() => executeAction('reactivate')}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 font-bold hover:bg-green-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {actionLoading === 'reactivate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  解約を取り消す
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-400 mb-4">
                  解約すると、次回更新日にサブスクリプションが停止します。それまでは現在のプランをご利用いただけます。
                </p>
                <button
                  onClick={() => setConfirmDialog({
                    action: 'cancel',
                    message: 'サブスクリプションを解約しますか？\n\n次回更新日まで現在のプランをご利用いただけます。解約後は無料プランに戻ります。',
                  })}
                  disabled={!!actionLoading}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  サブスクリプションを解約
                </button>
              </div>
            )}
          </section>
        )}

        {/* ===== 請求書・請求状況 ===== */}
        {subscription.hasStripeCustomer && (
          <section className="p-6 rounded-2xl bg-[#161B22] border border-white/10">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              請求書・請求状況
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              請求書・領収書のダウンロードや、現在の請求状況を確認できます。プラン変更後の差額請求もこちらでご確認いただけます。
            </p>
            <button
              onClick={() => executeAction('portal')}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold hover:bg-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {actionLoading === 'portal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              請求状況を確認する
            </button>
          </section>
        )}

        {/* ===== 返金申請 ===== */}
        <section className="p-6 rounded-2xl bg-[#161B22] border border-white/10">
          <button
            onClick={() => setShowRefundForm(!showRefundForm)}
            className="w-full flex items-center justify-between text-lg font-bold"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              返金申請
            </span>
            {showRefundForm ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {showRefundForm && (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-gray-400">
                返金をご希望の場合は、以下のフォームからお申し込みください。確認後、メールでご連絡いたします。
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={refundForm.email}
                  onChange={e => setRefundForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">購入日（おおよそ）</label>
                <input
                  type="text"
                  value={refundForm.purchaseDate}
                  onChange={e => setRefundForm(prev => ({ ...prev, purchaseDate: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50"
                  placeholder="2025年1月15日"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">返金理由</label>
                <textarea
                  value={refundForm.reason}
                  onChange={e => setRefundForm(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500/50 resize-none"
                  placeholder="返金をご希望の理由を入力してください"
                />
              </div>

              <button
                onClick={handleRefundSubmit}
                disabled={!!actionLoading || !refundForm.email || !refundForm.purchaseDate || !refundForm.reason}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold hover:bg-yellow-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'refund' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                返金を申請する
              </button>
            </div>
          )}
        </section>

        {/* サポート */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-500">
            お困りの場合は <a href="mailto:support@atasura.ai" className="text-pink-400 hover:underline">support@atasura.ai</a> までご連絡ください
          </p>
        </div>
      </main>

      {/* ===== 確認ダイアログ ===== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#161B22] border border-white/10 rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">確認</h3>
            <p className="text-sm text-gray-300 whitespace-pre-line mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-bold hover:bg-white/10 transition-all"
              >
                キャンセル
              </button>
              <button
                onClick={() => executeAction(confirmDialog.action, confirmDialog.plan)}
                disabled={!!actionLoading}
                className={`flex-1 px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                  confirmDialog.action === 'cancel'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : confirmDialog.action === 'downgrade'
                    ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                    : 'bg-pink-500 hover:bg-pink-600 text-white'
                }`}
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmDialog.action === 'cancel' ? '解約する' :
                 confirmDialog.action === 'downgrade' ? '変更する' : 'アップグレード'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * 料金ページ (/pricing)
 * integrated の PricingPage.tsx をベースに Next.js 用に変換
 * プラン選択 → Stripe Checkout
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Types
interface PricingFeature {
  text: string;
  isAvailable: boolean;
  highlight?: boolean;
}

interface PricingPlan {
  id: string;
  name: string;
  emoji: string;
  description: string;
  price: string;
  period: string;
  /** メイン訴求: 動画本数ベース (例: "5分動画 5本以上 作成可能") */
  usageLimit: string;
  /** 動画本数の数値部分 (アクセントカラー用) */
  videoCount?: string;
  /** クレジット表示 (小さくバッジ風) */
  creditBadge?: string;
  features: PricingFeature[];
  recommendation?: string;
  subNote?: string;
  cardFootNote?: string;
  /** 有料プラン共通の注意書き */
  pricingDisclaimer?: string;
  ctaText: string;
  isPopular?: boolean;
  isFree?: boolean;
}

// Plans Data
const PAID_DISCLAIMER = '※5分動画相当＝骨子＋台本＋画像生成の標準構成を基準とした目安です。';

const PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: '無料プラン',
    emoji: '🆓',
    description: 'まずは試したい方向け',
    price: '0',
    period: '無料',
    usageLimit: '2分台本 × 3本',
    ctaText: '無料で始める',
    isFree: true,
    subNote: 'まずはAIによる台本作成を体験したい方向け',
    features: [
      { text: '2分程度の台本作成', isAvailable: true },
      { text: 'スライド少量生成', isAvailable: true },
      { text: '修正・再生成不可', isAvailable: false },
      { text: '商用利用不可', isAvailable: false },
    ]
  },
  {
    id: 'starter',
    name: 'スタータープラン',
    emoji: '🌱',
    description: 'AIを初めて使う人に',
    price: '500',
    period: '/ 月',
    usageLimit: '5分動画相当の台本 5本以上 生成可能',
    videoCount: '5本以上',
    creditBadge: '30クレジット',
    ctaText: '申し込む',
    recommendation: '短いプレゼン・社内共有・練習用に最適',
    pricingDisclaimer: PAID_DISCLAIMER,
    features: [
      { text: '5分台本を複数作成', isAvailable: true },
      { text: 'スライド生成（小量）', isAvailable: true },
      { text: 'テンプレート無制限利用', isAvailable: true },
      { text: '軽い修正OK', isAvailable: true },
      { text: '商用利用不可', isAvailable: false },
    ]
  },
  {
    id: 'basic',
    name: 'ベーシックプラン',
    emoji: '⭐',
    description: '一番選ばれている標準プラン',
    price: '990',
    period: '/ 月',
    usageLimit: '5分動画相当の台本 50本以上 生成可能',
    videoCount: '50本以上',
    creditBadge: '300クレジット',
    ctaText: '申し込む',
    isPopular: true,
    recommendation: 'プレゼン・講座資料・副業に',
    pricingDisclaimer: PAID_DISCLAIMER,
    features: [
      { text: '5分動画を大量作成', isAvailable: true, highlight: true },
      { text: 'スライド生成（複数回）', isAvailable: true },
      { text: 'テンプレート無制限利用', isAvailable: true },
      { text: '修正・再生成OK', isAvailable: true },
      { text: '商用利用OK', isAvailable: true },
    ]
  },
  {
    id: 'creator',
    name: 'クリエイタープラン',
    emoji: '🔥',
    description: '仕事でガッツリ使う方向け',
    price: '1,980',
    period: '/ 月',
    usageLimit: '5分動画相当の台本 100本以上 生成可能',
    videoCount: '100本以上',
    creditBadge: '600クレジット',
    ctaText: '申し込む',
    recommendation: '継続的な制作・仕事利用向け',
    pricingDisclaimer: PAID_DISCLAIMER,
    features: [
      { text: '長時間台本にも対応', isAvailable: true, highlight: true },
      { text: 'スライド大量生成', isAvailable: true },
      { text: 'テンプレート無制限利用', isAvailable: true },
      { text: '優先生成システム', isAvailable: true },
      { text: '商用利用OK', isAvailable: true },
    ]
  }
];

// PricingCard Component
const PricingCard = ({ plan, onSelect, isLoading }: { plan: PricingPlan; onSelect: (plan: PricingPlan) => void; isLoading: boolean }) => {
  // Define plan-specific hover colors and glows
  const getThemeStyles = () => {
    switch (plan.id) {
      case 'free':
        return {
          glow: 'group-hover:shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_35px_rgba(34,211,238,0.25)]',
          border: 'group-hover:border-cyan-400/50',
          accent: 'text-cyan-400',
        };
      case 'starter':
        return {
          glow: 'group-hover:shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_35px_rgba(52,211,153,0.25)]',
          border: 'group-hover:border-emerald-400/50',
          accent: 'text-emerald-400',
        };
      case 'basic':
        return {
          glow: 'group-hover:shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(255,30,86,0.35)]',
          border: 'group-hover:border-pink-500/60',
          accent: 'text-pink-500',
        };
      case 'creator':
        return {
          glow: 'group-hover:shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_35px_rgba(249,115,22,0.25)]',
          border: 'group-hover:border-orange-400/50',
          accent: 'text-orange-400',
        };
      default:
        return { glow: '', border: '', accent: '' };
    }
  };

  const theme = getThemeStyles();

  return (
    <div className={`
      relative flex flex-col h-full rounded-[2.5rem] transition-all duration-250 ease-out group
      bg-[#161B22] border backdrop-blur-sm
      hover:-translate-y-[6px] hover:scale-[1.02] active:scale-[0.98]
      hover:bg-[#202833]
      ${plan.isPopular
        ? `border-pink-500/40 z-10 shadow-[0_10px_30px_rgba(0,0,0,0.4)] ${theme.glow} ${theme.border}`
        : `border-white/10 shadow-lg ${theme.glow} ${theme.border}`
      }
    `}>
      {/* Light Overlay Effect on Hover */}
      <div className="absolute inset-0 rounded-[2.5rem] bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Popular Badge */}
      {plan.isPopular && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-1.5 rounded-full text-sm font-black flex items-center gap-2 shadow-[0_4px_15px_rgba(255,30,86,0.5)] whitespace-nowrap group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300">
          <span className="animate-pulse">⭐</span> 人気No.1
        </div>
      )}

      <div className="p-8 pt-10 flex flex-col h-full relative z-10">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-4xl mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">{plan.emoji}</div>
          <h3 className="text-xl font-black mb-1 text-white tracking-tight group-hover:text-white transition-colors">
            {plan.name}
          </h3>
          <p className="text-xs font-medium text-gray-400 group-hover:text-gray-200 transition-colors">
            {plan.description}
          </p>
        </div>

        {/* Price */}
        <div className="text-center mb-6">
          <div className="flex items-end justify-center gap-1 text-white group-hover:scale-105 transition-transform duration-300">
            <span className="text-xl font-bold leading-none mb-1 text-gray-400 group-hover:text-gray-300">¥</span>
            <span className="text-5xl font-black tracking-tighter leading-none">{plan.price}</span>
            <span className="text-sm font-bold opacity-40 mb-1 group-hover:opacity-60">{plan.period}</span>
          </div>

          {/* Video-count main display (paid plans) or credit display (free) */}
          {plan.videoCount ? (
            <div className="mt-4 space-y-2.5">
              {/* Main: Video count - stacked layout */}
              <div className={`inline-flex flex-col items-center px-5 py-3 rounded-2xl ring-1 transition-all duration-300 ${
                plan.isPopular
                  ? `bg-pink-500/20 ring-pink-500/40 group-hover:bg-pink-500/30 group-hover:ring-pink-500/60`
                  : `bg-white/5 ring-white/10 group-hover:bg-white/10 group-hover:ring-white/30`
              }`}>
                <span className="text-gray-400 text-[11px] font-bold leading-snug text-center text-balance">5分動画相当の台本</span>
                <span className={`text-xl font-black leading-tight ${theme.accent}`}>{plan.videoCount}</span>
                <span className="text-white font-black text-xs">生成可能</span>
              </div>

              {/* Sub: Credit badge */}
              {plan.creditBadge && (
                <div className="flex justify-center">
                  <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-white/5 text-gray-400 ring-1 ring-white/10 group-hover:text-gray-300 transition-colors">
                    {plan.creditBadge}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className={`mt-4 inline-block px-5 py-2 rounded-full text-sm font-black ring-1 transition-all duration-300 bg-white/5 text-gray-300 ring-white/10 group-hover:bg-white/10 group-hover:ring-white/30`}>
                {plan.usageLimit}
              </div>

              {plan.subNote && (
                <div className="mt-2 text-[10px] font-bold leading-tight opacity-40 text-gray-400 group-hover:opacity-100 transition-all duration-300 group-hover:text-white">
                  {plan.subNote}
                </div>
              )}
            </>
          )}
        </div>

        {/* Features List */}
        <ul className="flex-grow space-y-3.5 mb-8">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm">
              <span className={`flex-shrink-0 mt-0.5 transition-all duration-300 ${
                feature.isAvailable ? `${theme.accent} scale-100` : 'text-gray-400 opacity-20 scale-90'
              } group-hover:scale-110`}>
                {feature.isAvailable ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </span>
              <span className={`font-medium transition-all duration-300 ${
                !feature.isAvailable
                  ? 'opacity-20 line-through'
                  : feature.highlight
                    ? 'font-black text-white'
                    : 'text-gray-300'
              } group-hover:text-white group-hover:opacity-100`}>
                {feature.text}
              </span>
            </li>
          ))}
        </ul>

        {/* Recommended Use */}
        {plan.recommendation && (
          <div className="mt-auto mb-6 p-4 rounded-2xl text-[13px] font-bold text-center bg-white/[0.08] text-white/90 border border-white/10 group-hover:bg-white/[0.15] group-hover:border-white/30 transition-all duration-300 shadow-sm">
            <span className="opacity-60 block mb-1 text-[9px] uppercase tracking-widest font-black text-white/80 group-hover:text-white group-hover:opacity-100 transition-opacity">おすすめ用途</span>
            <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] group-hover:text-white transition-colors">
              {plan.recommendation}
            </span>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={() => onSelect(plan)}
          disabled={isLoading}
          className={`w-full py-4 rounded-2xl font-black text-lg transition-all duration-300 flex items-center justify-center gap-2 group/btn relative overflow-hidden active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed ${
            plan.isPopular
              ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_8px_20px_rgba(255,30,86,0.35)] hover:shadow-[0_12px_30px_rgba(255,30,86,0.6)] hover:scale-[1.03]'
              : 'bg-[#2A313C] text-white hover:bg-[#3d4655] hover:scale-[1.03]'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="relative z-10">処理中...</span>
            </>
          ) : (
            <>
              <span className="relative z-10">{plan.ctaText}</span>
              <span className="relative z-10 text-xs group-hover/btn:translate-x-1.5 transition-transform duration-300">▶</span>
            </>
          )}
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none" />
        </button>

        {/* カード下注釈 */}
        {plan.cardFootNote && (
          <p className="mt-3 text-[11px] text-[rgba(255,255,255,0.75)] text-center leading-relaxed">
            {plan.cardFootNote}
          </p>
        )}

        {/* 有料プラン共通の注意書き */}
        {plan.pricingDisclaimer && (
          <p className="mt-3 text-[10px] text-gray-500 text-center leading-relaxed">
            {plan.pricingDisclaimer}
          </p>
        )}
      </div>
    </div>
  );
};

// TrustMarkers Component
const TrustMarkers = () => {
  const markers = [
    {
      icon: '🛡️',
      title: '30日間返金保証',
      desc: '満足いただけない場合は全額返金',
    },
    {
      icon: '⚡',
      title: '即座にアップグレード',
      desc: 'いつでもプラン変更可能',
    },
    {
      icon: '👑',
      title: 'サポート',
      desc: 'メールで随時対応',
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl mx-auto mt-24 pb-12 border-t border-white/5 pt-16">
      {markers.map((marker) => (
        <div key={marker.title} className="flex flex-col items-center text-center px-4 group">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 group-hover:bg-white/10 transition-all duration-500">
            {marker.icon}
          </div>
          <h4 className="text-lg font-bold mb-2">{marker.title}</h4>
          <p className="text-gray-400 text-sm">{marker.desc}</p>
        </div>
      ))}
    </div>
  );
};

// Header Component
const Header = () => {
  return (
    <header className="hidden lg:flex fixed top-0 left-0 right-0 z-50 px-6 py-4 justify-between items-center bg-[#05060f]/80 backdrop-blur-md border-b border-white/5">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20">
          <span className="text-white font-bold text-xl">ア</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">アタスラAI</h1>
          <p className="text-gray-500 text-[10px] tracking-widest">プレゼンサポート</p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="hidden md:flex items-center gap-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-2 py-1.5">
        <Link href="/showcase" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">実例</Link>
        <Link href="/problems" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">よくあるお悩み</Link>
        <Link href="/howto" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">使い方</Link>
        <Link href="/pricing" className="px-4 py-2 text-sm text-white bg-white/10 rounded-full">料金</Link>
        <Link href="/faq" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">よくある質問</Link>
      </nav>

      {/* CTA（モバイルでは共通ハンバーガーメニュー内に配置） */}
      <Link href="/login" className="hidden lg:flex bg-pink-500 hover:bg-pink-400 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-pink-500/20 items-center gap-2 transition-all active:scale-95">
        <span>無料で始める</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </header>
  );
};

export default function PricingPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPlan = async (plan: PricingPlan) => {
    setError(null);

    // 無料プランの場合はログインへ
    if (plan.isFree) {
      router.push('/login');
      return;
    }

    setLoadingPlan(plan.id);

    try {
      // ユーザー確認
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // 未ログインの場合はログインへ
        router.push(`/login?redirect=/pricing`);
        return;
      }

      // Checkout Session 作成 API を呼び出し
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          userId: user.id,
          email: user.email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'チェックアウトの作成に失敗しました');
      }

      // Stripe Checkout へリダイレクト
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center bg-[#05060f] text-white">
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-pink-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-indigo-600/10 blur-[150px] rounded-full pointer-events-none" />

      {/* Sticky Background Symbols */}
      <div className="fixed inset-0 pointer-events-none select-none opacity-[0.03] flex items-center justify-around text-9xl font-black">
        <span className="rotate-12 translate-x-[-10%] translate-y-[-20%]">¥</span>
        <span className="rotate-[-12deg] translate-x-[20%] translate-y-[30%]">￥</span>
        <span className="rotate-45 translate-x-[0%] translate-y-[-40%] opacity-50">💸</span>
      </div>

      <Header />

      <main className="w-full max-w-7xl px-6 pt-6 lg:pt-40 pb-20 z-10">
        {/* Hero Section */}
        <section className="text-center mb-20 space-y-6">
          <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 text-pink-400 px-5 py-2 rounded-full text-sm font-black tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
            </span>
            Premium Plans
          </div>

          <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight">
            あなたの<span className="text-green-400">ニーズ</span><br />
            に合わせた<span className="text-pink-500">プラン</span>
          </h2>

          <p className="text-gray-400 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
            無料トライアルから <span className="text-white font-bold">プロフェッショナル</span> まで、<br className="hidden md:block" />
            様々なプレゼン制作ニーズに対応した革新的プラン
          </p>
        </section>

        {/* Error */}
        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Pricing Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch mb-12">
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              onSelect={handleSelectPlan}
              isLoading={loadingPlan === plan.id}
            />
          ))}
        </section>

        {/* Common Note */}
        <div className="text-center mb-24">
          <div className="inline-block px-6 py-4 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md space-y-2">
            <p className="text-gray-300 text-sm md:text-base font-bold">
              <span className="text-pink-500 mr-2">※</span>
              短い台本を複数本作ることも、まとめて長時間の台本を作ることも可能です。
            </p>
            <p className="text-gray-400 text-xs md:text-sm">
              ※生成内容・修正回数により消費は変動します
            </p>
          </div>
        </div>

        {/* Trust Markers */}
        <TrustMarkers />

        {/* Bottom CTA / Note */}
        <section className="mt-12 text-center">
          <p className="text-gray-300 text-sm mb-6 leading-relaxed" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            プランの変更・キャンセルは設定画面からいつでも可能です。
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-gray-300 text-sm font-medium">
            <a href="https://spiffy-fenglisu-bc21c8.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white underline decoration-pink-500/50 underline-offset-4 transition-colors">利用規約</a>
            <a href="https://delightful-unicorn-0dd878.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white underline decoration-pink-500/50 underline-offset-4 transition-colors">特定商取引法に基づく表記</a>
            <a href="https://euphonious-brioche-c80573.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white underline decoration-pink-500/50 underline-offset-4 transition-colors">プライバシーポリシー</a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-12 text-center text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} Atasura AI Inc. All rights reserved.
      </footer>
    </div>
  );
}

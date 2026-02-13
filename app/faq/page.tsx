'use client';

/**
 * FAQページ (/faq)
 * integrated の FaqPage.tsx をベースに Next.js 用に変換
 * UI/文言は元のまま維持
 */

import React, { useState } from 'react';
import Link from 'next/link';

// lucide-react の代わりに SVG アイコンを使用
const HelpCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
  </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const MessageCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);

const ZapIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const PresentationIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
  </svg>
);

const CreditCardIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" strokeWidth="2" />
    <line x1="1" y1="10" x2="23" y2="10" strokeWidth="2" />
  </svg>
);

const WalletIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5zM16 12a1 1 0 100-2 1 1 0 000 2z" />
  </svg>
);

const PlayCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
  </svg>
);

const LayersIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const ShoppingBagIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" />
  </svg>
);

const LaptopIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" strokeWidth="2" />
    <line x1="2" y1="20" x2="22" y2="20" strokeWidth="2" />
  </svg>
);

const DatabaseIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <ellipse cx="12" cy="5" rx="9" ry="3" strokeWidth="2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const ShieldCheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4" />
  </svg>
);

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M23 4v6h-6M1 20v-6h6" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);

const ArrowUpCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12l-4-4-4 4M12 16V8" />
  </svg>
);

const ArrowDownCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12l4 4 4-4M12 8v8" />
  </svg>
);

const XCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9l-6 6M9 9l6 6" />
  </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
  </svg>
);

// =====================================================
// お知らせデータ（最新が先頭）
// =====================================================

interface AnnouncementItem {
  id: string;
  date: string;
  content: string;
}

const ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'a1',
    date: '2月15日',
    content: 'アタスラAIをローンチしました。',
  },
];

// =====================================================
// FAQデータ
// =====================================================

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  icon: React.ReactNode;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 'q1',
    category: '基本',
    question: 'アタスラAIは何ができるツールですか？',
    answer: 'アタスラAIは、プレゼン台本とスライドを同時に作成できるAI資料作成ツールです。構成作成 → 台本生成 → スライド生成までを一気に行え、短時間のプレゼンから長時間の講座資料まで対応しています。',
    icon: <SparklesIcon className="w-5 h-5 text-indigo-400" />
  },
  {
    id: 'q2',
    category: '使い方',
    question: '操作は難しくありませんか？',
    answer: 'いいえ。特別なスキルは必要ありません。キーワードや伝えたい内容、想定時間を入力するだけで、AIが構成・台本・スライドを自動生成します。音声入力にも対応しているため、話すだけでも作成可能です。',
    icon: <ZapIcon className="w-5 h-5 text-yellow-400" />
  },
  {
    id: 'q3',
    category: '使い方',
    question: 'どんなプレゼンに使えますか？',
    answer: '以下のような用途に対応しています。\n\n・社内プレゼン・会議資料\n・朝礼・ワンポイント共有資料\n・セミナー・講座・研修\n・YouTube・動画用台本\n・営業資料・提案書\n・副業・個人事業の発信資料\n\n短時間〜長時間プレゼンまで柔軟に作成できます。',
    icon: <PresentationIcon className="w-5 h-5 text-blue-400" />
  },
  {
    id: 'q4',
    category: '料金',
    question: 'クレジットとは何ですか？',
    answer: 'アタスラAIでは、台本生成やスライド生成の処理ごとにクレジットを消費します。プランごとに月間クレジット数が決まっており、使い切った場合は翌月まで追加生成はできません。※無制限利用ではないため、安心してご利用いただけます。',
    icon: <CreditCardIcon className="w-5 h-5 text-purple-400" />
  },
  {
    id: 'q5',
    category: '料金',
    question: 'クレジットを使い切ったらどうなりますか？',
    answer: 'その月は新たな生成ができなくなりますが、作成済みの内容の閲覧・ダウンロードは可能です。翌月になるとクレジットは自動でリセットされます。',
    icon: <WalletIcon className="w-5 h-5 text-pink-400" />
  },
  {
    id: 'q6',
    category: 'プラン',
    question: '無料プランでも試せますか？',
    answer: 'はい。無料プランでは短い台本と少量のスライド生成をお試しいただけます。まずは使い心地を確認したい方におすすめです。',
    icon: <PlayCircleIcon className="w-5 h-5 text-emerald-400" />
  },
  {
    id: 'q7',
    category: '技術',
    question: '自社資料や既存スライドと組み合わせて使えますか？',
    answer: 'はい、可能です。アタスラAIで作成したスライドは画像（PNG）形式で出力できるため、普段お使いのPowerPoint資料に統合・編集できます。',
    icon: <LayersIcon className="w-5 h-5 text-cyan-400" />
  },
  {
    id: 'q8',
    category: 'ガイドライン',
    question: 'AIが作った内容はそのまま使って大丈夫ですか？',
    answer: 'はい。生成される内容はすべてオリジナルで、商用利用も可能です。最終的な調整・表現の編集も自由に行えます。※ご利用の際は、内容の最終確認を行った上でご活用ください。',
    icon: <HelpCircleIcon className="w-5 h-5 text-orange-400" />
  },
  {
    id: 'q9',
    category: 'ライセンス',
    question: '商用利用はできますか？',
    answer: 'はい。ベーシックプラン以上では、商用利用が可能です。講座・研修・営業資料・動画コンテンツなど、ビジネス用途にも安心してご利用いただけます。',
    icon: <ShoppingBagIcon className="w-5 h-5 text-rose-400" />
  },
  {
    id: 'q10',
    category: '環境',
    question: '会社のPCでも使えますか？',
    answer: 'ご利用の環境や社内ルールによります。自宅PCなどでアタスラAIを使って資料を作成し、画像として出力したものを社内資料に統合する使い方が一般的です。',
    icon: <LaptopIcon className="w-5 h-5 text-slate-400" />
  },
  {
    id: 'q11',
    category: 'セキュリティ',
    question: 'データは保存されますか？',
    answer: '生成された台本・スライド・画像の内容はサーバーに保存されません。ブラウザのセッション中のみ表示され、ページを閉じると自動的に消去されます。必要な場合はダウンロード機能でお手元に保存してください。なお、クレジット消費量などの利用状況に関する統計情報のみ記録しています。',
    icon: <DatabaseIcon className="w-5 h-5 text-teal-400" />
  },
  {
    id: 'q12',
    category: '支払い',
    question: '支払い方法は何がありますか？',
    answer: 'クレジットカードによる月額サブスクリプション決済です。いつでもプラン変更・解約が可能です。',
    icon: <ShieldCheckIcon className="w-5 h-5 text-indigo-500" />
  },
  // ── Stripe Billing・返金・解約関連 FAQ ──
  {
    id: 'q13',
    category: '支払い',
    question: 'サブスクは自動更新されますか？',
    answer: '一度ご購入いただくと、毎月同日に自動で更新・決済されます。\n更新が成功するとサービスは継続利用可能となり、クレジットも自動でリセットされます。',
    icon: <RefreshIcon className="w-5 h-5 text-green-400" />
  },
  {
    id: 'q14',
    category: 'プラン',
    question: '途中で上位プランに変更できますか？',
    answer: 'はい、可能です。\n上位プランへの変更は即時反映されます。\n残り期間に応じて日割り計算（差額のみ）が発生する場合があります。',
    icon: <ArrowUpCircleIcon className="w-5 h-5 text-emerald-400" />
  },
  {
    id: 'q15',
    category: 'プラン',
    question: '下位プランへの変更はどうなりますか？',
    answer: '下位プランへの変更は次回更新日から適用されます。\n今月は現在のプランのままご利用いただけます。',
    icon: <ArrowDownCircleIcon className="w-5 h-5 text-amber-400" />
  },
  {
    id: 'q16',
    category: '解約',
    question: '解約したらすぐ使えなくなりますか？',
    answer: '解約は次回更新日で停止となります。\n更新日までは引き続きご利用可能です。\n更新日前であれば解約の取り消しも可能です。',
    icon: <XCircleIcon className="w-5 h-5 text-red-400" />
  },
  {
    id: 'q17',
    category: '支払い',
    question: '領収書や請求書は発行されますか？',
    answer: 'Stripeから自動でレシートメールが送信されます。\nまた、マイページ（Stripeポータル）から請求書・領収書をダウンロード可能です。',
    icon: <FileTextIcon className="w-5 h-5 text-sky-400" />
  },
  {
    id: 'q18',
    category: '返金',
    question: '30日間返金保証とは何ですか？',
    answer: '初回購入から30日以内であれば全額返金いたします。\n返金申請後、Stripe経由でカードへ返金処理を行います。\n\n※返金保証は初回購入のみ対象です。',
    icon: <ShieldIcon className="w-5 h-5 text-violet-400" />
  },
  {
    id: 'q19',
    category: '返金',
    question: '返金と解約は何が違いますか？',
    answer: '解約は次回更新から停止となり返金は行われません。\n返金はすでに支払った金額をカードへ返す処理です。',
    icon: <HelpCircleIcon className="w-5 h-5 text-fuchsia-400" />
  },
  {
    id: 'q20',
    category: '料金',
    question: 'クレジットはいつリセットされますか？',
    answer: '毎月の更新成功時に自動でリセットされます。',
    icon: <ClockIcon className="w-5 h-5 text-lime-400" />
  }
];

// FAQCard Component
const FAQCard = ({ item }: { item: FAQItem }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="group border border-white/5 bg-[#0f121d] rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/10 hover:bg-[#141827]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-start gap-4 p-6 text-left focus:outline-none"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
          {item.icon}
        </div>
        <div className="flex-grow pt-1">
          <span className="inline-block px-2 py-0.5 mb-2 text-[10px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20">
            {item.category}
          </span>
          <h3 className="text-lg font-bold text-white leading-snug group-hover:text-indigo-200 transition-colors">
            {item.question}
          </h3>
        </div>
        <div className={`flex-shrink-0 mt-2 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDownIcon className="w-6 h-6 text-white/30" />
        </div>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[800px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="p-6 pt-5 bg-white/[0.02]">
          <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  );
};

// Navigation Component
const Navigation = () => {
  return (
    <header className="hidden lg:flex fixed top-0 left-0 right-0 z-50 px-6 py-4 justify-between items-center bg-[#05060f]/80 backdrop-blur-md border-b border-white/5">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <span className="text-white font-bold text-xl">ア</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">アタスラAI</h1>
          <p className="text-slate-500 text-[10px] tracking-widest">プレゼンサポート</p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="hidden md:flex items-center gap-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-2 py-1.5">
        <Link href="/showcase" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">実例</Link>
        <Link href="/problems" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">よくあるお悩み</Link>
        <Link href="/howto" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">使い方</Link>
        <Link href="/pricing" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">料金</Link>
        <Link href="/faq" className="px-4 py-2 text-sm text-white bg-white/10 rounded-full">よくある質問</Link>
      </nav>

      {/* CTA（モバイルでは共通ハンバーガーメニュー内に配置） */}
      <Link href="/login" className="hidden lg:flex bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-indigo-500/20 items-center gap-2 transition-all active:scale-95">
        <span>無料で始める</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </header>
  );
};

export default function FaqPage() {
  return (
    <div className="min-h-screen selection:bg-indigo-500 selection:text-white bg-[#05060f] text-white">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-6 lg:pt-40 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold mb-6">
            <HelpCircleIcon className="w-3 h-3" />
            <span>ヘルプセンター</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">
            疑問を<br className="md:hidden" />
            <span className="text-gradient">すべて解決</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            AIプレゼン資料生成について、<br className="md:hidden" />
            <span className="text-indigo-300 font-bold">よくあるご質問</span>にお答えします。
          </p>
        </div>
      </section>

      {/* FAQ Grid */}
      <section className="pb-32 px-6">
        <div className="max-w-4xl mx-auto grid gap-4">
          {FAQ_DATA.map((item) => (
            <FAQCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Still Have Questions? Section */}
      <section className="pb-32 px-6">
        <div className="max-w-4xl mx-auto p-8 md:p-12 rounded-[2rem] bg-gradient-to-br from-[#161b2c] to-[#0f121d] border border-white/5 relative overflow-hidden text-center">
          {/* Subtle Glow Background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/20 blur-[100px] pointer-events-none"></div>

          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-6">
              <SparklesIcon className="w-6 h-6 text-indigo-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">まだ質問がありますか？</h2>
            <p className="text-slate-200 mb-8 max-w-lg mx-auto leading-relaxed">
              お気軽にお問い合わせください。
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="w-full sm:w-64 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-500/20 transform hover:-translate-y-1">
                <MessageCircleIcon className="w-5 h-5" />
                お問い合わせ
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 bg-[#010309]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 grayscale opacity-50">
            <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
              <span className="text-black font-black italic text-[10px]">A</span>
            </div>
            <span className="font-bold text-white">アタスラAI</span>
          </div>
          <div className="flex gap-8 text-sm text-slate-500">
            <a href="https://spiffy-fenglisu-bc21c8.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">利用規約</a>
            <a href="https://euphonious-brioche-c80573.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">プライバシーポリシー</a>
            <a href="https://delightful-unicorn-0dd878.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">特定商取引法に基づく表記</a>
          </div>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Atasura AI Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

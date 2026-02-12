/**
 * ランディングページ (/)
 * integrated の LpFacePage.tsx をベースに Next.js 用に変換
 */

import Link from 'next/link';
import {
  Eye,
  MessageSquare,
  Play,
  CreditCard,
  HelpCircle,
  LayoutGrid,
  ChevronRight,
  Sparkles,
  Zap,
  Image as ImageIcon,
  Users
} from 'lucide-react';
import { ThumbnailStack } from '@/components/lp/ThumbnailStack';
import { StatusCard } from '@/components/lp/StatusCard';

// ナビゲーションリンクコンポーネント
const NavLink: React.FC<{ href: string; icon: React.ReactNode; text: string }> = ({ href, icon, text }) => (
  <Link href={href} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors group">
    <span className="opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>
    <span>{text}</span>
  </Link>
);

// ヘッダーコンポーネント
const Header: React.FC = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center py-6 px-4">
      <div className="max-w-[1400px] w-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="text-white w-6 h-6" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">アタスラAI</h1>
            <p className="text-[10px] text-gray-400 mt-1 font-medium">プレゼンサポート</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden lg:flex items-center gap-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-3 py-1.5">
          <NavLink href="/showcase" icon={<Eye size={16} />} text="実例" />
          <NavLink href="/problems" icon={<MessageSquare size={16} />} text="よくあるお悩み" />
          <NavLink href="/howto" icon={<Play size={16} />} text="使い方" />
          <NavLink href="/pricing" icon={<CreditCard size={16} />} text="料金" />
          <NavLink href="/faq" icon={<HelpCircle size={16} />} text="よくある質問" />

          <div className="w-px h-4 bg-white/10 mx-1" />

          <Link href="/demo" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-yellow-400 hover:text-yellow-300 transition-colors bg-yellow-400/5 rounded-lg border border-yellow-400/20">
            <LayoutGrid size={16} />
            <span>デモ</span>
          </Link>
        </nav>

        {/* CTA Button */}
        <Link href="/login" className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 active:scale-95 group">
          <span>無料で始める</span>
          <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </header>
  );
};

// ヒーローセクション
const Hero: React.FC = () => {
  return (
    <section className="pt-24 lg:pt-28 pb-20 px-6 flex justify-center min-h-screen">
      <div className="max-w-[1400px] w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

        {/* Left Column: Text Content */}
        <div className="lg:col-span-5 space-y-10">
          <div className="-mt-6 lg:-mt-10 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-sm shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <Zap size={14} className="text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-bold tracking-wider text-yellow-100 uppercase font-mono">
              👉 HEADSLIDE AI-POWERED ENGINE
            </span>
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse ml-1" />
          </div>

          {/* Headlines */}
          <div className="space-y-4">
            <h2 className="font-black leading-[1.15] tracking-tight">
              <div className="text-2xl lg:text-[43px] mb-2 whitespace-nowrap">
                <span className="text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.3)]">朝礼</span>
                <span className="text-white">から</span>
                <span className="text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.3)]">Youtube講座</span>
                <span className="text-white">まで対応</span>
              </div>

              <div className="text-3xl lg:text-5xl text-yellow-400 text-glow-yellow whitespace-nowrap">
                思考言語・資料化同時作成ツール
              </div>

              <div className="text-white text-3xl lg:text-5xl mt-2">
                無料で3分完成
              </div>
            </h2>
          </div>

          {/* Description */}
          <p className="text-lg lg:text-xl text-gray-400 font-medium leading-relaxed">
            頭にぼんやりあるキーワードを <span className="text-yellow-400">言語化し</span><br />
            資料＆スピーカーノートを <span className="border-b-2 border-emerald-500 text-white">同時に作成</span>
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/login" className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-8 py-4 rounded-xl text-lg font-black transition-all shadow-[0_0_30px_rgba(225,29,72,0.3)] active:scale-95 group">
              <Zap size={20} className="fill-white" />
              <span>今すぐ無料で試す</span>
            </Link>
            <Link href="/demo" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/10 px-8 py-4 rounded-xl text-lg font-black transition-all backdrop-blur-sm active:scale-95 group">
              <Play size={20} className="fill-white" />
              <span>デモを見る</span>
            </Link>
          </div>

          {/* Auxiliary Copy */}
          <div className="pt-4 max-w-md">
            <div className="space-y-1">
              <p className="text-xl lg:text-2xl font-bold text-white transition-colors">
                プレゼンの1歩目を爆速で
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Demo Visualization */}
        <div className="lg:col-span-7 relative flex flex-col items-center lg:items-end">
          <ThumbnailStack />

          {/* メトリクス表示（一時非表示：SHOW_METRICS を true に戻すと再表示） */}
          {false /* SHOW_METRICS */ && (
          <div className="mt-8 flex flex-col lg:flex-row gap-4 lg:gap-6 w-full lg:justify-end pr-4">
            <StatusCard
              icon={<ImageIcon size={20} className="text-yellow-500" />}
              count="5061"
              suffix="枚"
              label="生成"
            />
            <StatusCard
              icon={<Users size={20} className="text-indigo-400" />}
              count="1552"
              suffix="名"
              label="が利用中"
              dotColor="bg-emerald-400"
            />
          </div>
          )}
        </div>

      </div>
    </section>
  );
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-main relative">
      <Header />
      <main>
        <Hero />
      </main>

      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-blue-900/10 blur-[120px] rounded-full -z-10" />
      <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-purple-900/10 blur-[120px] rounded-full -z-10" />

      {/* Footer / Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50">
        <div className="w-5 h-8 border-2 border-white/30 rounded-full flex justify-center pt-1">
          <div className="w-1 h-1.5 bg-white rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}

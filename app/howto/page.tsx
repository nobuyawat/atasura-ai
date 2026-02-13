/**
 * 使い方ページ (/howto)
 * integrated の HowtoPage.tsx をベースに Next.js 用に変換
 * UI/文言は元のまま維持
 */

import Link from 'next/link';

interface Step {
  id: number;
  title: string;
  subtitle: string;
  description: string[];
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "イメージを入力",
    subtitle: "INPUT IDEA",
    description: [
      "思いつくキーワードを自由に入力",
      "プレゼンの想定時間を指定",
      "ラフな入力でOK、後から調整可能"
    ],
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    )
  },
  {
    id: 2,
    title: "AI骨子作成＆肉付け",
    subtitle: "AI OUTLINE & VOICE",
    description: [
      "入力内容をもとにAIが骨子を生成",
      "音声入力で想いや補足を追加",
      "話しながら構成を育てられる"
    ],
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    )
  },
  {
    id: 3,
    title: "台本＆スライド生成",
    subtitle: "SCRIPT & SLIDES",
    description: [
      "骨子と想いを統合して粗台本を作成",
      "台本に連動したスライドを自動生成",
      "章ごとの一括生成にも対応"
    ],
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
      </svg>
    )
  },
  {
    id: 4,
    title: "編集・仕上げ",
    subtitle: "EDIT & FINISH",
    description: [
      "テキスト・画像を自由に編集",
      "自社資料や既存スライドを統合",
      "用途に合わせて最終調整"
    ],
    icon: (
      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )
  }
];

const FORMATS = [
  { label: "スライド", desc: "16:9 標準比率" },
  { label: "ノート形式", desc: "A4縦：スライド＋台本" },
  { label: "台本のみ", desc: "A4縦：テキスト形式" }
];

// StepCard Component
const StepCard = ({ step }: { step: Step }) => {
  const isSpecialStep = step.id === 2;

  return (
    <div className={`group relative glass-card p-8 rounded-2xl transition-all duration-300 transform hover:scale-[1.03] cursor-default
      ${isSpecialStep ? 'border-indigo-500/60 bg-indigo-500/10 shadow-[0_0_30px_rgba(79,70,229,0.2)]' : 'hover:border-pink-500/50 hover:bg-slate-800/90'}
    `}>
      {/* Step Badge */}
      <div className={`absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br rounded-full flex items-center justify-center font-black text-xl shadow-lg border-2 border-slate-900 group-hover:scale-110 transition-transform
        ${isSpecialStep ? 'from-indigo-400 to-emerald-400' : 'from-indigo-600 to-purple-600'}
      `}>
        {step.id}
      </div>

      {/* Icon Area */}
      <div className={`mb-6 flex justify-center transition-all duration-300
        ${isSpecialStep ? 'text-emerald-300 scale-110' : 'text-indigo-400 group-hover:text-pink-300'}
      `}>
        <div className={`p-4 bg-slate-900/70 rounded-xl border transition-all duration-300
          ${isSpecialStep ? 'border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]' : 'border-white/10 group-hover:border-pink-500/30'}
        `}>
          {step.icon}
        </div>
      </div>

      {/* Content */}
      <div className="text-center">
        {/* English Sub-header (Small) */}
        <p className={`text-[11px] tracking-widest uppercase font-bold mb-1 transition-colors
          ${isSpecialStep ? 'text-emerald-300' : 'text-indigo-300 group-hover:text-pink-300'}
        `}>
          {step.subtitle}
        </p>
        {/* Japanese Sub-title (Main) */}
        <h3 className="text-xl font-black mb-4 text-white">
          {step.title}
        </h3>

        <div className="space-y-3 text-left mt-6">
          {step.description.map((line, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[15px] text-slate-100 group-hover:text-white transition-colors leading-relaxed">
              <span className={`mt-1 flex-shrink-0 ${isSpecialStep ? 'text-emerald-400' : 'text-pink-500'}`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
              <span className="font-medium">{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hover/Active Background Glow */}
      <div className={`absolute inset-0 rounded-2xl transition-opacity duration-500 -z-10
        ${isSpecialStep
          ? 'bg-gradient-to-br from-emerald-500/10 to-indigo-600/10 opacity-100'
          : 'bg-gradient-to-br from-pink-500/10 to-purple-600/10 opacity-0 group-hover:opacity-100'}
      `} />
    </div>
  );
};

// Header Component
const Header = () => {
  return (
    <header className="hidden lg:flex fixed top-0 left-0 right-0 z-50 px-6 py-4 justify-between items-center bg-slate-950/80 backdrop-blur-md border-b border-white/5">
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
        <Link href="/howto" className="px-4 py-2 text-sm text-white bg-white/10 rounded-full">使い方</Link>
        <Link href="/pricing" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">料金</Link>
        <Link href="/faq" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">よくある質問</Link>
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

export default function HowtoPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500 selection:text-white">
      <Header />

      <main className="pt-6 lg:pt-32 pb-24 px-6 max-w-7xl mx-auto">
        {/* Page Title Area */}
        <section className="text-center mb-24 animate-in fade-in slide-in-from-bottom duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-indigo-500/40 text-indigo-300 text-xs font-bold mb-6">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            超シンプル4ステップ
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">
            3分で完成、<br />
            <span className="gradient-text">アタスラAIの使い方</span>
          </h1>
          <p className="text-slate-200 max-w-2xl mx-auto text-lg font-medium leading-relaxed">
            専門知識不要。構成、台本、スライドが全て自動で連動。<br className="hidden md:block" />
            誰でも簡単にプロ品質のプレゼンデッキを作成できます。
          </p>
        </section>

        {/* Step Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-32 relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-slate-800 to-transparent -translate-y-12 -z-10" />

          {STEPS.map((step) => (
            <StepCard key={step.id} step={step} />
          ))}
        </section>

        {/* Supplemental Info: Output Formats */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-32">
          <div className="glass-card p-10 rounded-3xl border-white/10 relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] -z-10" />
            <h2 className="text-3xl font-black mb-8 flex items-center gap-3">
              <span className="w-10 h-1.5 bg-indigo-500 rounded-full inline-block" />
              選べる出力形式
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {FORMATS.map((f, i) => (
                <div key={i} className="bg-slate-900/90 p-6 rounded-2xl border border-white/10 text-center hover:border-indigo-500/40 transition-colors">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center mx-auto mb-4 text-indigo-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="font-black text-[15px] mb-2 text-white">{f.label}</p>
                  <p className="text-[11px] text-slate-300 font-bold leading-tight">{f.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-slate-300 text-sm font-medium leading-relaxed italic">
              ※ 完成したデッキは全ての形式で一括ダウンロードが可能です。
            </p>
          </div>

          <div className="space-y-8 pl-4">
            <h2 className="text-4xl font-black tracking-tight leading-tight">
              「考える」から「カタチ」まで、<br />
              <span className="text-indigo-400">爆速で並走するAI。</span>
            </h2>
            <p className="text-slate-100 text-lg leading-relaxed font-medium">
              アタスラAIは単なる自動生成ツールではありません。あなたの頭の中にある断片的なキーワードを言語化し、聴衆に伝わるストーリーへと変換します。
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/80 rounded-full border border-white/10 text-sm font-black text-white">
                <span className="text-pink-500">✔</span> クレジットカード不要
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/80 rounded-full border border-white/10 text-sm font-black text-white">
                <span className="text-pink-500">✔</span> 30秒で開始可能
              </div>
              <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-900/80 rounded-full border border-white/10 text-sm font-black text-white">
                <span className="text-pink-500">✔</span> 無料トライアル
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center relative py-20 bg-indigo-600/10 rounded-[40px] border border-indigo-500/20 overflow-hidden shadow-2xl">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle,rgba(79,70,229,0.2)_0%,transparent_70%)] -z-10" />

          <h2 className="text-4xl md:text-5xl font-black mb-10 tracking-tight leading-tight text-white">
            さあ、プレゼンの1歩目を<br className="md:hidden" />
            爆速で。
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Link href="/login" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-5 rounded-2xl font-black text-xl transition-all shadow-[0_10px_40px_rgba(79,70,229,0.5)] hover:-translate-y-1 active:scale-95">
              今すぐ無料で始める
            </Link>
            <Link href="/demo" className="w-full sm:w-auto glass-card hover:bg-white/15 text-white px-12 py-5 rounded-2xl font-black text-xl transition-all border-white/30 active:scale-95">
              3分で体験してみる
            </Link>
          </div>

          <p className="mt-10 text-slate-300 text-sm font-black flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            商用利用・セキュリティ対策も万全
          </p>
        </section>
      </main>

      <footer className="border-t border-white/5 py-12 px-6 text-center text-slate-500 text-xs font-bold tracking-widest uppercase">
        &copy; {new Date().getFullYear()} Atasura AI Inc. All Rights Reserved.
      </footer>
    </div>
  );
}

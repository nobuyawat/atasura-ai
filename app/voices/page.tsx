/**
 * ユーザーの声ページ (/voices)
 * integrated の UserVoicesPage.tsx と完全一致
 */

import Link from 'next/link';

// integrated/src/pages/user-voices/constants.tsx と同一
const MOCK_VOICES = [
  {
    id: '1',
    platform: 'X',
    user: {
      name: 'あやみ｜マーケティング',
      handle: 'ayami_marketing',
      avatar: 'https://picsum.photos/seed/user1/100/100',
      isVerified: true
    },
    content: 'プレゼン資料作成がめっちゃ、時間かかってるから使ってみた！\n・0からじゃなく、テンプレートから選べるの最高\n・AIが構成を考えてくれるから迷わない\n・資料のデザインが勝手にプロ級になる\n\n文字がずれてしまうのと、写真が少しイメージと違うときもあるけど、ベースができるのは早すぎる...！',
    image: 'https://picsum.photos/seed/slide1/600/400',
    timestamp: '2025年7月1日 23:28',
    likes: 24,
  },
  {
    id: '2',
    platform: 'X',
    user: {
      name: 'Satoshi',
      handle: 'exdesign',
      avatar: 'https://picsum.photos/seed/user2/100/100',
      isVerified: true
    },
    content: 'アタスラAIの思考言語化機能、凄いわ。頭の中にあるボヤッとしたキーワードを投げただけで、論理的なスライド構成にしてくれる。\n正直、自分で1時間悩むより10秒で出力されるAI案の方が質が高いこともある。笑\n資料作成のハードルがグンと下がりました。',
    timestamp: '2025年7月24日 11:59',
    likes: 42,
  },
  {
    id: '3',
    platform: 'review',
    user: {
      name: 'ソロプレナー＠ようへい',
      handle: '40jobseeking',
      avatar: 'https://picsum.photos/seed/user3/100/100',
      isVerified: true
    },
    content: '【AI活用】で作ったスライドです！\n#アタスラAI\n\n以前はCanvaで四苦八苦してましたが、構成をAIに丸投げできるので時短効果がエグい。\nデザインセンスが皆無な私でも、これなら胸を張ってプレゼンできます。',
    image: 'https://picsum.photos/seed/slide2/600/400',
    timestamp: '2025年7月1日 22:35',
    likes: 15,
  },
  {
    id: '4',
    platform: 'note',
    user: {
      name: 'クリエイティブ・ラボ',
      handle: 'cre_lab',
      avatar: 'https://picsum.photos/seed/user4/100/100',
      isVerified: false
    },
    content: 'アタスラAIを使ってみて驚いたのは「スピーカーノート」まで自動生成してくれる点。これのおかげで、スライドを作った後のカンペ作成の時間がゼロになりました。発表の練習に時間を割けるのは本当に大きい。',
    timestamp: '2025年8月5日 15:10',
    likes: 88,
  },
  {
    id: '5',
    platform: 'X',
    user: {
      name: 'テック企業人事',
      handle: 'hr_tech_tokyo',
      avatar: 'https://picsum.photos/seed/user5/100/100',
      isVerified: true
    },
    content: '社内研修用の資料、アタスラAIで3分で作ってみた結果。マジで3分で終わった。もうこれ無しでは仕事できない。',
    image: 'https://picsum.photos/seed/slide3/600/400',
    timestamp: '2025年8月12日 09:12',
    likes: 156,
  },
  {
    id: '6',
    platform: 'review',
    user: {
      name: '広報のタナカ',
      handle: 'tanaka_pr',
      avatar: 'https://picsum.photos/seed/user6/100/100',
      isVerified: false
    },
    content: '朝礼の発表資料、いつも直前に焦って作ってましたが、アタスラAIのおかげで前日に余裕を持って終わらせられるようになりました。感謝しかないです！',
    timestamp: '2025年8月20日 18:45',
    likes: 31,
  }
];

// TestimonialCard コンポーネント（integrated/src/pages/user-voices/components/TestimonialCard.tsx と同一）
const TestimonialCard: React.FC<{ voice: typeof MOCK_VOICES[0] }> = ({ voice }) => {
  return (
    <div className="glass-card rounded-2xl overflow-hidden p-5 flex flex-col h-fit">
      {/* Platform and User Info */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={voice.user.avatar}
            alt={voice.user.name}
            className="w-10 h-10 rounded-full border border-white/10"
          />
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-white leading-tight">{voice.user.name}</span>
              {voice.user.isVerified && (
                <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6c.154-.435.238-.905.238-1.4c0-2.21-1.71-3.99-3.818-3.99c-.147 0-.29.01-.432.025C15.71 2.435 14.162 1.5 12.5 1.5c-1.662 0-3.21.935-3.842 2.135a3.633 3.633 0 0 0-.432-.025C6.118 3.61 4.41 5.39 4.41 7.6c0 .495.084.965.238 1.4c-1.273.65-2.148 2.02-2.148 3.6c0 1.58.875 2.95 2.148 3.6c-.154.435-.238.905-.238 1.4c0 2.21 1.71 3.99 3.818 3.99c.147 0 .29-.01.432-.025C8.29 21.565 9.838 22.5 11.5 22.5c1.662 0 3.21-.935 3.842-2.135c.142.015.285.025.432.025c2.108 0 3.818-1.78 3.818-3.99c0-.495-.084-.965-.238-1.4c1.273-.65 2.148-2.02 2.148-3.6zm-12.29 4.965l-4.14-4.14l1.414-1.414l2.726 2.727l6.545-6.545l1.414 1.414l-7.96 7.958z"/>
                </svg>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">@{voice.user.handle}</span>
              <span className="text-xs text-blue-500 font-medium">・フォローする</span>
            </div>
          </div>
        </div>
        <div className="text-gray-500">
          {voice.platform === 'X' ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap mb-4">
        {voice.content}
      </div>

      {/* Image if available */}
      {voice.image && (
        <div className="rounded-xl overflow-hidden mb-4 border border-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={voice.image} alt="Testimonial highlight" className="w-full h-auto object-cover" />
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-auto">
        <div className="text-[11px] text-gray-500 mb-3 border-b border-white/5 pb-2">
          {voice.timestamp}
        </div>
        <div className="flex items-center justify-between text-gray-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 group cursor-pointer hover:text-pink-500 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span className="text-xs">{voice.likes || 0}</span>
            </div>
            <div className="flex items-center gap-1 group cursor-pointer hover:text-blue-400 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <span className="text-xs">返信</span>
            </div>
            <div className="flex items-center gap-1 group cursor-pointer hover:text-green-400 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              <span className="text-xs">リンクをコピー</span>
            </div>
          </div>
        </div>

        <button className="w-full mt-4 py-2 border border-blue-500/20 rounded-full text-[11px] text-blue-400 font-bold hover:bg-blue-500/5 transition-colors">
          {voice.platform === 'X' ? 'Xでもっと読む' : '詳細を見る'}
        </button>
      </div>
    </div>
  );
};

export default function VoicesPage() {
  return (
    <div className="min-h-screen bg-[#05070A]">
      {/* Header */}
      <header className="hidden lg:flex fixed top-0 left-0 right-0 z-50 px-6 py-4 justify-between items-center bg-[#05070A]/80 backdrop-blur-md border-b border-white/5">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
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
          <Link href="/pricing" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">料金</Link>
          <Link href="/faq" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">よくある質問</Link>
        </nav>

        {/* CTA（モバイルでは共通ハンバーガーメニュー内に配置） */}
        <Link href="/login" className="hidden lg:flex bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-indigo-500/20 items-center gap-2 hover:from-indigo-500 hover:to-purple-500 transition-all active:scale-95">
          <span>無料で始める</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </header>

      {/* Page Content */}
      <main className="relative pt-6 lg:pt-32 pb-20">
        {/* Background Decorative Element */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-xl h-[600px] pointer-events-none">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[120px] rounded-full"></div>
          <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full"></div>
        </div>

        {/* Section Header */}
        <div className="relative px-6 max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-500 mb-6 tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            アタスラAI ｜ ユーザーの声
          </div>

          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight leading-tight text-white">
            クリエイターから<br />
            <span className="text-gradient-blue italic">高評価</span>いただいています
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            実際にアタスラAIを利用しているユーザーの<br className="hidden md:block" />
            リアルな声・評価を一部ご紹介します。
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="relative px-6 max-w-7xl mx-auto">
          <div className="card-grid">
            {MOCK_VOICES.map((voice) => (
              <TestimonialCard key={voice.id} voice={voice} />
            ))}
          </div>

          {/* Subtle decoration dots */}
          <div className="hidden lg:block absolute -left-20 top-1/4 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl"></div>
          <div className="hidden lg:block absolute -right-20 bottom-1/4 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl"></div>
        </div>

        {/* Pre-footer CTA */}
        <section className="relative mt-24 px-6 max-w-4xl mx-auto">
          <div className="relative p-10 md:p-16 rounded-3xl bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-white/5 overflow-hidden text-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/30 blur-[120px] pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-black mb-4 text-white">
                あなたも<span className="text-indigo-400">アタスラAI</span>で<br className="md:hidden" />
                資料作成を効率化
              </h2>
              <p className="text-gray-400 mb-8 max-w-lg mx-auto leading-relaxed">
                頭の中のアイデアを言語化し、プレゼン資料に。<br />
                思考をそのまま形にする新体験を始めましょう。
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-full font-bold text-lg shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                >
                  今すぐ無料で始める
                </Link>
                <Link
                  href="/demo"
                  className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white rounded-full font-bold text-lg border border-white/10 transition-all"
                >
                  デモを見る
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6 text-center text-gray-600 text-[10px] tracking-widest uppercase font-medium">
        &copy; 2025 ATASURA AI - Presentation Engine. All Rights Reserved.
      </footer>
    </div>
  );
}

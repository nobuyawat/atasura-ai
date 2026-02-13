/**
 * 実例ページ (/showcase)
 * integrated の ShowcasePage.tsx と完全一致
 */

import Link from 'next/link';

// integrated/src/pages/showcase/constants.tsx と同一
const EXAMPLES = [
  {
    id: '1',
    title: 'キーワードを落としてアイデア出し',
    description: '頭に浮かんだ単語をランダムに整理し、発想の起点に。',
    category: '思考整理',
    imageUrl: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&q=80&w=800&h=450',
  },
  {
    id: '2',
    title: 'きっかけ話題で台本の芽を作る',
    description: 'アタスラAIが「話の切り口」を提案し、構成が膨らむ。',
    category: '構成案',
    imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=80&w=800&h=450',
  },
  {
    id: '3',
    title: '粗台本を見てイメージを形にする',
    description: 'キーワードと話題の組み合わせから、粗い台本を生成。',
    category: '台本作成',
    imageUrl: 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&q=80&w=800&h=450',
  },
  {
    id: '4',
    title: '暫定スライド生成で方向性を固める',
    description: '粗台本に合わせて仮の資料を作り、全体像を把握。',
    category: 'スライド化',
    imageUrl: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&q=80&w=800&h=450',
  },
  {
    id: '5',
    title: 'スピーカーノート同時生成',
    description: 'スライド内容に合わせた話し方のポイントを自動で書き出し。',
    category: '効率化',
    imageUrl: 'https://images.unsplash.com/photo-1497493292307-31c376b6e479?auto=format&fit=crop&q=80&w=800&h=450',
  },
  {
    id: '6',
    title: '資料をカスタマイズ',
    description: '資料・スピーカーノートを話しやすいようにカスタマイズ。テキスト、画像の編集、独自資料の組み込みも可能。',
    category: 'カスタマイズ',
    imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=800&h=450',
  },
  {
    id: '8',
    title: '改善ループで磨く',
    description: 'フィードバックを反映し、AIと共に資料をブラッシュアップ。',
    category: '完成度',
    imageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&q=80&w=800&h=450',
  },
  {
    id: '10',
    title: 'プレゼン時間に連動した資料作成',
    description: '朝礼からYouTube講座まで、プレゼン時間や用途に合わせて資料構成を自動調整。複数バージョンにカスタマイズ可能。',
    category: '資料作成',
    imageUrl: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800&h=450',
  },
];

// ExampleCard コンポーネント（integrated/src/pages/showcase/components/ExampleCard.tsx と同一）
const ExampleCard: React.FC<{ data: typeof EXAMPLES[0] }> = ({ data }) => {
  return (
    <div className="flex flex-col group bg-[#161B30]/50 border border-white/5 rounded-2xl overflow-hidden">
      {/* Visual Image */}
      <div className="aspect-video relative overflow-hidden bg-[#0d111d]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.imageUrl}
          alt={data.title}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 group-hover:scale-105 transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#161B30] via-transparent to-transparent pointer-events-none opacity-60"></div>

        {/* Category Tag */}
        <div className="absolute top-3 left-3">
          <span className="px-2 py-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-md text-[10px] text-gray-200 font-medium">
            {data.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-white font-bold text-base mb-2 group-hover:text-indigo-400 transition-colors">
          {data.title}
        </h3>
        <p className="text-gray-400 text-sm leading-relaxed mb-4">
          {data.description}
        </p>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Nano Banana Pro</span>
          </div>
          <button className="text-gray-400 group-hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ShowcasePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#05070a] text-white selection:bg-indigo-500/30">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#05070a]/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-bold text-xl">ア</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">アタスラAI</h1>
              <p className="text-gray-400 text-[10px] tracking-widest">プレゼンサポート</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-1 nav-pill rounded-full px-2 py-1.5">
            <Link href="/showcase" className="flex items-center space-x-2 px-4 py-2 rounded-full text-white text-sm font-medium bg-white/10">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              <span>実例</span>
            </Link>
            <Link href="/problems" className="flex items-center space-x-2 px-4 py-2 rounded-full text-gray-300 hover:text-white hover:bg-white/5 transition-all text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
              <span>よくあるお悩み</span>
            </Link>
            <Link href="/howto" className="flex items-center space-x-2 px-4 py-2 rounded-full text-gray-300 hover:text-white hover:bg-white/5 transition-all text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>使い方</span>
            </Link>
            <Link href="/pricing" className="flex items-center space-x-2 px-4 py-2 rounded-full text-gray-300 hover:text-white hover:bg-white/5 transition-all text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span>料金</span>
            </Link>
            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>
            <Link href="/demo" className="flex items-center space-x-2 px-4 py-2 rounded-full text-yellow-400 hover:text-yellow-300 transition-all text-sm font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" /></svg>
              <span>デモ</span>
            </Link>
          </nav>

          {/* CTA（モバイルでは共通ハンバーガーメニュー内に配置） */}
          <div className="hidden lg:flex items-center space-x-4">
            <Link href="/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
              ログイン
            </Link>
            <Link href="/login" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition-all active:scale-95">
              <span>無料で始める</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow pt-[104px] lg:pt-32 pb-20">
        {/* Hero / Heading Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-20">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-6">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            <span className="text-[12px] text-gray-300 font-medium tracking-wide">アタスラAIの実例</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tight">
            こんな使い方ができます
          </h2>

          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            頭に浮かんだキーワードから、<br className="sm:hidden" />
            話題・粗台本・資料までを形にします。
          </p>
        </section>

        {/* Filter Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button className="px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-indigo-600/20">
              すべて
            </button>
            <button className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all font-medium text-sm">
              思考整理系
            </button>
            <button className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all font-medium text-sm">
              プレゼン構成系
            </button>
            <button className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all font-medium text-sm">
              ビジネス・朝礼
            </button>
          </div>
        </section>

        {/* Grid Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {EXAMPLES.map((example) => (
              <ExampleCard key={example.id} data={example} />
            ))}
          </div>
        </section>

        {/* Footer CTA */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-24">
          <div className="text-center relative py-20 bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-white/5 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-indigo-500/10 blur-[100px] rounded-full" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-black mb-6">
                あなたも今日から<br className="md:hidden" />
                <span className="text-indigo-400">アタスラAI</span>で効率化
              </h2>
              <p className="text-gray-400 mb-10 max-w-lg mx-auto leading-relaxed">
                資料作成の手間を大幅削減。<br />
                思考をそのまま形にする、新しい体験を始めましょう。
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
                  className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white rounded-full font-bold text-lg border border-white/10 transition-all active:scale-95"
                >
                  デモを見る
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-gray-500 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-white/10 rounded flex items-center justify-center text-[10px] font-bold">ア</div>
            <span>© 2024 Atasura AI. All rights reserved.</span>
          </div>
          <div className="flex space-x-8">
            <a href="https://spiffy-fenglisu-bc21c8.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">利用規約</a>
            <a href="https://euphonious-brioche-c80573.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">プライバシーポリシー</a>
            <a href="https://delightful-unicorn-0dd878.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">特定商取引法</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

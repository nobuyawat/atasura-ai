'use client';

/**
 * よくあるお悩みページ (/problems)
 * 構成: 共感(4枚) → つなぎ → 理由説明(4枚) → 解決 → アタスラ紹介 → CTA
 */

import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  ChevronRight,
  ChevronDown,
  Zap,
} from 'lucide-react';

// ヘッダーコンポーネント（他ページと統一）
const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-[#05060f]/80 backdrop-blur-md border-b border-white/5">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-tr from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20">
          <span className="text-white font-bold text-xl">ア</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-lg">アタスラAI</h1>
          <p className="text-gray-500 text-[10px] tracking-widest">プレゼンサポート</p>
        </div>
      </Link>

      <nav className="hidden md:flex items-center gap-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-2 py-1.5">
        <Link href="/showcase" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">実例</Link>
        <Link href="/problems" className="px-4 py-2 text-sm text-white bg-white/10 rounded-full">よくあるお悩み</Link>
        <Link href="/howto" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">使い方</Link>
        <Link href="/pricing" className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-full transition-colors">料金</Link>
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

// セクション区切り線
const Divider = () => (
  <div className="max-w-xl mx-auto px-6">
    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

// 共感パートの画像＋テキストブロック
const EmpathyBlock = ({
  src,
  alt,
  title,
  paragraphs,
  isVertical = false,
}: {
  src: string;
  alt: string;
  title: string;
  paragraphs: React.ReactNode[];
  isVertical?: boolean;
}) => (
  <section className="py-20 md:py-28 px-6">
    <div className="max-w-3xl mx-auto space-y-10 md:space-y-12">
      {/* 画像（contain表示で左右/上下切れない） */}
      <div className={`relative ${isVertical ? 'aspect-[3/4]' : 'aspect-[4/3]'} rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-white/5 bg-[#0a0d15]`}>
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 768px"
        />
      </div>

      {/* 見出し */}
      <h3 className="text-2xl md:text-3xl font-bold text-white tracking-wide leading-snug" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
        {title}
      </h3>

      {/* 本文 */}
      <div className="space-y-6">
        {paragraphs.map((p, i) => (
          <div key={i} className="text-base md:text-lg lg:text-xl text-white/90 font-medium leading-[2] tracking-wide" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
            {p}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// 理由説明パートの画像＋テキストブロック
const ReasonBlock = ({
  src,
  alt,
  title,
  bullets,
  closing,
  note,
}: {
  src: string;
  alt: string;
  title: string;
  bullets: string[];
  closing: React.ReactNode;
  note?: string;
}) => (
  <section className="py-20 md:py-28 px-6">
    <div className="max-w-3xl mx-auto space-y-10 md:space-y-12">
      {/* スライド画像 */}
      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-white/5 bg-[#0a0d15]">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 768px"
        />
      </div>

      {/* タイトル */}
      <h3 className="text-2xl md:text-3xl font-bold text-white tracking-wide leading-snug">
        {title}
      </h3>

      {/* 箇条書き */}
      <ul className="space-y-3">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-base md:text-lg text-white/80 font-medium tracking-wide">
            <span className="text-pink-400 mt-0.5 flex-shrink-0">▸</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {/* 締めの文 */}
      <div className="text-base md:text-lg lg:text-xl text-white/90 font-medium leading-[2] tracking-wide">
        {closing}
      </div>

      {/* 補足 */}
      {note && (
        <p className="text-sm text-gray-400 font-medium tracking-wide">
          {note}
        </p>
      )}
    </div>
  </section>
);

export default function ProblemsPage() {
  return (
    <div className="min-h-screen bg-[#05060f] text-white relative overflow-hidden">
      {/* Background Ornaments */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-pink-500/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[30%] bg-indigo-600/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-[50%] left-[10%] w-[25%] h-[25%] bg-purple-600/5 blur-[120px] rounded-full pointer-events-none" />

      <Header />

      <main className="relative z-10">

        {/* ================================================================
            PART 1: 共感パート（画像①〜④）
        ================================================================ */}

        {/* ===== 画像①: 話す前に、もう消耗している ===== */}
        <section className="pt-32 md:pt-40 pb-20 md:pb-28 px-6">
          <div className="max-w-3xl mx-auto space-y-10 md:space-y-12">
            {/* ラベル */}
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-gray-400 px-5 py-2 rounded-full text-sm font-medium">
                <Sparkles size={14} className="text-pink-400" />
                よくあるお悩み
              </div>
            </div>

            {/* 画像（contain表示） */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-white/5 bg-[#0a0d15]">
              <Image
                src="/images/problems/01.png"
                alt="話す前に、もう消耗している"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </div>

            {/* 見出し */}
            <h3 className="text-2xl md:text-3xl font-bold text-white tracking-wide leading-snug" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
              始める前に、エネルギーを使い切ってしまう
            </h3>

            {/* 本文 */}
            <div className="space-y-6">
              <p className="text-base md:text-lg lg:text-xl text-white/90 font-medium leading-[2] tracking-wide" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                5分話すだけのはずなのに、
                <br />
                「ちゃんとやらなきゃ」と思って資料を探す。
              </p>
              <p className="text-base md:text-lg lg:text-xl text-white/90 font-medium leading-[2] tracking-wide" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                事例を見て、記事を読んで、
                <br />
                気づいたら時間だけが過ぎている。
              </p>
              <p className="text-base md:text-lg lg:text-xl text-white/90 font-medium leading-[2] tracking-wide" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}>
                まだ、何も話していないのに。
              </p>
            </div>
          </div>
        </section>

        <Divider />

        {/* ===== 画像②: 頭では分かっている ===== */}
        <EmpathyBlock
          src="/images/problems/02.png"
          alt="頭では分かっている。でも言葉にできない"
          title="考えはあるのに、最初の一文が出てこない"
          paragraphs={[
            <>言いたいことは、頭の中にある。<br />伝えたい方向も、なんとなく分かっている。</>,
            <>でも、<br />「どこから話すか」が決まらない。</>,
            <>考えが整理される前に、<br />手だけが止まってしまう。</>,
          ]}
        />

        <Divider />

        {/* ===== 画像③: 5分話すために、2時間使っている ===== */}
        <EmpathyBlock
          src="/images/problems/03.png"
          alt="5分話すために、2時間使っている"
          title="5分の話に、2時間かけてしまう"
          paragraphs={[
            <>資料を探して、構成を考えて、<br />文言を直して、また最初から。</>,
            <>気づいたら、<br />話す時間よりも準備に何倍もかかっている。</>,
          ]}
        />

        <Divider />

        {/* ===== 画像④: 構成して、並べて、そりゃ後回し ===== */}
        <EmpathyBlock
          src="/images/problems/05.png"
          alt="構成して、並べて、そりゃ後回し"
          title="ちゃんとやろうとして、進めなくなる"
          isVertical={false}
          paragraphs={[
            <>一度、構成を考えてみる。<br />順番も、並べてみる。</>,
            <>それでも、<br />「まだ違う気がする」<br />「もう少し考えた方がいい気がする」</>,
            <>そうしているうちに、<br />結局、後回しになる。</>,
          ]}
        />

        {/* ================================================================
            PART 2: 問題提起のつなぎ
        ================================================================ */}
        <section className="py-28 md:py-40 px-6">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-wide leading-snug">
              それには、理由があります。
            </h2>
            <p className="text-base md:text-lg text-gray-400 font-medium tracking-wide">
              あなたの能力や努力の問題ではありません。
            </p>
          </div>
        </section>

        {/* ================================================================
            PART 3: 理由説明パート（画像⑤〜⑧）
        ================================================================ */}

        <Divider />

        {/* ===== 画像⑤: 情報過多とデジタル時代の脳 ===== */}
        <ReasonBlock
          src="/images/problems/slides/slide-01.png"
          alt="情報過多とデジタル時代の脳"
          title="プレゼン準備は、情報が多すぎる"
          bullets={[
            '調べる',
            '資料を作る',
            '何を話すか考える',
          ]}
          closing={
            <>プレゼンでは、<br />最初から大量の情報が頭に流れ込みます。</>
          }
        />

        <Divider />

        {/* ===== 画像⑥: ワーキングメモリの限界 ===== */}
        <ReasonBlock
          src="/images/problems/slides/slide-02.png"
          alt="ワーキングメモリの限界"
          title="脳には「同時に考えられる量」の限界がある"
          bullets={[
            '情報収集',
            '構成づくり',
            '表現を考える',
          ]}
          closing={
            <>これを同時にやろうとすると、<br />思考が詰まり、止まります。</>
          }
          note="👉 「考えているのに進まない」の正体。"
        />

        <Divider />

        {/* ===== 画像⑦: 二重符号化理論 ===== */}
        <ReasonBlock
          src="/images/problems/slides/slide-03.png"
          alt="二重符号化理論"
          title="プレゼンは、複数タスクが混ざり合う作業"
          bullets={[
            '言葉で考える',
            'イメージで整理する',
            '話す流れを組み立てる',
          ]}
          closing={
            <>これらをごちゃ混ぜに処理しようとすると、<br />脳はうまく働きません。</>
          }
        />

        <Divider />

        {/* ===== 画像⑧: 記憶は「掛け算」で強くなる ===== */}
        <ReasonBlock
          src="/images/problems/slides/slide-04.png"
          alt="記憶は掛け算で強くなる"
          title="だから、時間だけがかかってしまう"
          bullets={[
            '行ったり来たりする',
            '何度も白紙に戻る',
            '「もう少し考えた方がいい気がする」',
          ]}
          closing={
            <>結果、<br />ちゃんとやっているのに、遅くなる。</>
          }
        />

        {/* ================================================================
            PART 4: 解決パート
        ================================================================ */}

        {/* 解決スライド */}
        <section className="py-28 md:py-40 px-6">
          <div className="max-w-2xl mx-auto text-center space-y-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-wide leading-snug">
              解決策は、シンプルです
            </h2>

            <div className="space-y-6">
              <p className="text-lg md:text-xl text-white/90 font-medium leading-[2] tracking-wide">
                プレゼン準備を
                <br />
                同時進行しないこと。
              </p>

              <ul className="space-y-4 text-left max-w-md mx-auto">
                <li className="flex items-start gap-3 text-base md:text-lg text-white/80 font-medium tracking-wide">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                  <span>今は「考えるだけ」</span>
                </li>
                <li className="flex items-start gap-3 text-base md:text-lg text-white/80 font-medium tracking-wide">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                  <span>今は「整理するだけ」</span>
                </li>
                <li className="flex items-start gap-3 text-base md:text-lg text-white/80 font-medium tracking-wide">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                  <span>今は「話す流れを作るだけ」</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <Divider />

        {/* アタスラ紹介スライド */}
        <section className="py-28 md:py-40 px-6">
          <div className="max-w-2xl mx-auto text-center space-y-10">
            <div className="inline-flex items-center gap-2 bg-pink-500/10 border border-pink-500/20 text-pink-400 px-5 py-2 rounded-full text-sm font-bold tracking-wide">
              <Zap size={14} className="fill-pink-400" />
              ATASURA AI
            </div>

            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-wide leading-snug">
              アタスラは、思考を分けて進めるAIです
            </h2>

            <div className="space-y-6">
              <ul className="space-y-4 text-left max-w-md mx-auto">
                <li className="flex items-start gap-3 text-base md:text-lg text-white/80 font-medium tracking-wide">
                  <span className="text-pink-400 mt-0.5 flex-shrink-0">▸</span>
                  <span>何から考えるかを迷わせない</span>
                </li>
                <li className="flex items-start gap-3 text-base md:text-lg text-white/80 font-medium tracking-wide">
                  <span className="text-pink-400 mt-0.5 flex-shrink-0">▸</span>
                  <span>思考の順番を用意する</span>
                </li>
                <li className="flex items-start gap-3 text-base md:text-lg text-white/80 font-medium tracking-wide">
                  <span className="text-pink-400 mt-0.5 flex-shrink-0">▸</span>
                  <span>「考える前段階」を整理する</span>
                </li>
              </ul>

              <p className="text-base md:text-lg text-gray-300 font-medium leading-[2] tracking-wide pt-4">
                AIが作るのではなく、
                <br />
                あなたの考えを進めるための補助線。
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================
            PART 5: CTA
        ================================================================ */}
        <section className="py-24 md:py-36 px-6">
          <div className="max-w-2xl mx-auto text-center space-y-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white tracking-wide leading-snug">
              まずは、無料で試してみてください
            </h2>

            <ul className="space-y-3 text-left max-w-sm mx-auto">
              <li className="flex items-start gap-3 text-base md:text-lg text-white/80 font-medium tracking-wide">
                <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                <span>資料づくり</span>
              </li>
              <li className="flex items-start gap-3 text-base md:text-lg text-white/80 font-medium tracking-wide">
                <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                <span>スピーチ準備</span>
              </li>
              <li className="flex items-start gap-3 text-base md:text-lg text-white/80 font-medium tracking-wide">
                <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                <span>プレゼン構成</span>
              </li>
            </ul>

            <p className="text-base md:text-lg text-gray-300 font-medium tracking-wide">
              「止まる前」に進める体験を。
            </p>

            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-pink-500 hover:bg-pink-400 text-white px-10 py-4 rounded-full text-lg font-bold shadow-[0_8px_25px_rgba(255,30,86,0.3)] hover:shadow-[0_12px_35px_rgba(255,30,86,0.5)] transition-all active:scale-95 group"
              >
                <Zap size={20} className="fill-white" />
                <span>無料で始める</span>
                <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full py-12 text-center text-gray-400 text-sm border-t border-white/5">
        <div className="flex flex-wrap justify-center gap-4 text-gray-300 text-sm font-medium mb-6">
          <a href="https://spiffy-fenglisu-bc21c8.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white underline decoration-pink-500/50 underline-offset-4 transition-colors">利用規約</a>
          <a href="https://delightful-unicorn-0dd878.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white underline decoration-pink-500/50 underline-offset-4 transition-colors">特定商取引法に基づく表記</a>
          <a href="https://euphonious-brioche-c80573.netlify.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white underline decoration-pink-500/50 underline-offset-4 transition-colors">プライバシーポリシー</a>
        </div>
        &copy; {new Date().getFullYear()} Atasura AI Inc. All rights reserved.
      </footer>
    </div>
  );
}

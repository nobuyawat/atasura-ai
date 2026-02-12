'use client';

/**
 * デモページ (/demo)
 * integrated の DemoPage.tsx をベースに Next.js 用に変換
 */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { DEMO_STEPS } from './constants';
import StepIndicator from './components/StepIndicator';
import { StepId } from './types';
import { Step1Mock, Step2Mock, Step3Mock, Step4Mock } from './components/MockScreenshots';

const renderMockUI = (id: number) => {
  switch (id) {
    case 1: return <Step1Mock />;
    case 2: return <Step2Mock />;
    case 3: return <Step3Mock />;
    case 4: return <Step4Mock />;
    default: return null;
  }
};

export default function DemoPage() {
  const [activeStep, setActiveStep] = useState<StepId>(StepId.Setup);
  const sectionsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = sectionsRef.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) {
              setActiveStep((index + 1) as StepId);
            }
          }
        });
      },
      { threshold: 0.6 }
    );

    sectionsRef.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white">
      {/* Header / Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center glass-card border-b border-white/5">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-[#FF3B6B] to-[#7C3AED] rounded-lg flex items-center justify-center font-bold text-lg italic">A</div>
          <span className="font-bold text-xl tracking-tight">アタスラAI <span className="text-xs text-gray-400 ml-1">デモ版</span></span>
        </Link>
        <Link
          href="/login"
          className="bg-white/10 hover:bg-white/20 transition-colors text-white px-6 py-2 rounded-full text-sm font-bold flex items-center"
        >
          今すぐ試す
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-6">
          {/* Hero Context (Mini) */}
          <div className="text-center mb-16 pt-10">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight text-white">
              思考・資料化<span className="gradient-text">同時作成</span>体験
            </h1>
            <p className="text-[#E6E6E6] text-lg max-w-2xl mx-auto leading-relaxed">
              アタスラAIなら、たった4つのステップで<br />
              あなたのアイデアを<span className="text-white font-bold">「そのまま使える」</span><br className="md:hidden" />
              プレゼン資料に変換できます。
            </p>
          </div>

          {/* Persistent Step Indicator */}
          <div className="sticky top-24 z-40 bg-[#0B0E14]/80 backdrop-blur-sm py-4 rounded-xl mb-8">
            <StepIndicator currentStep={activeStep} />
          </div>

          {/* Demo Steps Container */}
          <div className="space-y-40">
            {DEMO_STEPS.map((step, index) => (
              <div
                key={step.id}
                ref={el => { sectionsRef.current[index] = el; }}
                className="flex flex-col lg:flex-row items-center gap-12 lg:gap-24 min-h-[60vh] py-10"
              >
                {/* Left: Content */}
                <div className="flex-1 space-y-6">
                  <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold tracking-widest uppercase">
                    {step.label}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold leading-tight text-white">{step.title}</h2>
                  <div className="space-y-4">
                    {step.description.map((desc, i) => (
                      <p key={i} className="text-[#E6E6E6] text-lg leading-relaxed">{desc}</p>
                    ))}
                  </div>

                  <div className="pt-4 pb-2">
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 inline-block">
                      <p className="text-indigo-300 font-bold flex items-center">
                        <span className="mr-2 text-xl">💡</span>
                        「{step.message}」
                      </p>
                    </div>
                  </div>

                  <ul className="grid grid-cols-1 gap-4 pt-4">
                    {step.features.map((feature, i) => (
                      <li key={i} className="flex flex-col space-y-1">
                        <div className="flex items-center text-white font-bold">
                          <svg className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {feature.title}
                        </div>
                        <div className="pl-7 text-[#E6E6E6] text-sm">
                          {feature.description}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="pt-8">
                    {step.id === 4 ? (
                      <Link
                        href="/login"
                        className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-indigo-600/20 flex items-center inline-flex"
                      >
                        今すぐ無料で始める
                        <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Link>
                    ) : (
                      <button
                        onClick={() => {
                          const nextEl = sectionsRef.current[index + 1];
                          if (nextEl) nextEl.scrollIntoView({ behavior: 'smooth' });
                          else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        }}
                        className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold transition-all transform hover:scale-105 active:scale-95 shadow-xl shadow-indigo-600/20 flex items-center"
                      >
                        次のステップへ
                        <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Right: Mock UI View */}
                <div className="flex-1 w-full relative">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full"></div>
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#FF3B6B] to-[#7C3AED] rounded-2xl opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative">
                      <div className="absolute top-4 left-4 flex space-x-1.5 z-10">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      </div>
                      {renderMockUI(step.id)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer CTA */}
      <footer className="bg-gradient-to-b from-transparent to-indigo-900/20 py-24 border-t border-white/5 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-6 text-white">さあ、あなたの思考を<br className="md:hidden" />資料化しましょう</h2>
          <p className="text-[#E6E6E6] mb-10 text-lg leading-relaxed">
            朝礼、会議、講座、動画制作。あらゆる場面の「1歩目」を爆速にします。<br />
            整理や構成はすべてAIにお任せください。
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link href="/login" className="w-full sm:w-auto px-12 py-5 bg-[#FF3B6B] hover:bg-[#e0345d] text-white rounded-full font-bold text-xl shadow-2xl shadow-[#FF3B6B]/40 transition-all transform hover:scale-105">
              今すぐ無料で試す
            </Link>
            <button className="w-full sm:w-auto px-12 py-5 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold text-xl transition-all">
              お問い合わせ
            </button>
          </div>
          <p className="mt-8 text-sm text-[#DADADA]">
            登録なしでもデモの続きをご覧いただけます。
          </p>
        </div>
      </footer>
    </div>
  );
}

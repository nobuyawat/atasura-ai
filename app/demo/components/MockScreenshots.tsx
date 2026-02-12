'use client';

import React from 'react';

export const Step1Mock: React.FC = () => (
  <div className="bg-white rounded-xl p-8 text-slate-800 shadow-2xl h-[400px] flex flex-col justify-center">
    <div className="mb-6">
      <label className="block text-sm font-bold text-slate-700 mb-2">講座テーマ <span className="text-red-500">*</span></label>
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-slate-800 text-lg font-medium">
        AI時代に求められる仕事の姿勢
      </div>
      <p className="text-xs text-slate-400 mt-2">受講者に伝わる、具体的なテーマを入力してください</p>
    </div>
    <div className="mb-4">
      <label className="block text-sm font-bold text-slate-700 mb-2">全体時間（目安）</label>
      <div className="flex items-center space-x-4">
        <div className="flex items-center border border-slate-200 rounded-lg px-4 py-2 bg-white w-24">
          <span className="text-slate-400 mr-2">🕒</span>
          <span className="text-lg font-bold">5</span>
        </div>
        <span className="font-bold text-slate-600">分</span>
      </div>
    </div>
  </div>
);

export const Step2Mock: React.FC = () => (
  <div className="bg-white rounded-xl p-6 text-slate-800 shadow-2xl h-[400px] flex flex-col relative overflow-hidden">
    <div className="flex justify-between items-center mb-4 border-b pb-2">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white text-xs">✨</div>
        <span className="font-bold text-sm">台本の叩き台を生成</span>
      </div>
      <div className="text-xs text-slate-400">AI時代に求められる仕事の姿勢</div>
    </div>

    <div className="flex items-center justify-between mb-4">
      <div className="flex space-x-6 text-xs font-bold text-slate-400">
        <span className="text-indigo-600">1 入力</span>
        <span>2 骨子確認</span>
        <span>3 台本化</span>
      </div>
    </div>

    <div className="mb-4">
      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">補足条件 (任意)</label>
      <div className="border border-slate-100 rounded p-2 bg-slate-50 text-sm text-slate-400">
        冒頭のつかみ
      </div>
    </div>

    <div className="flex-1 border-2 border-red-500 rounded-lg p-4 relative bg-red-50/30">
      <div className="flex items-center text-indigo-600 text-xs font-bold mb-2">
         <span className="mr-2">🎙️</span> 音声メモ
      </div>
      <div className="text-xs leading-relaxed text-slate-700">
        今の業務にAIが使えて仕事が楽になるならそれに越したことはないが実際にAIを使って業務をする仕様になっていない。それが会社から降りてくるまで待つべきなのか...
      </div>
      <div className="absolute top-2 right-2 flex items-center bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse text-[10px]">
        ● 録音中
      </div>
    </div>

    <div className="mt-4 flex justify-end space-x-2">
      <div className="px-4 py-2 bg-slate-100 rounded text-[10px] font-bold text-slate-500">キャンセル</div>
      <div className="px-4 py-2 bg-indigo-600 text-white rounded text-[10px] font-bold">骨子を生成</div>
    </div>
  </div>
);

export const Step3Mock: React.FC = () => (
  <div className="bg-white rounded-xl p-6 text-slate-800 shadow-2xl h-[400px] flex flex-col">
    <div className="flex items-center space-x-2 mb-4">
      <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-[8px]">✓</div>
      <div className="h-1 flex-1 bg-indigo-600 rounded"></div>
      <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[8px]">2</div>
      <div className="h-1 flex-1 bg-slate-100 rounded"></div>
      <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-white text-[8px]">3</div>
    </div>

    <div className="font-bold text-sm mb-3">📝 骨子（編集可能）</div>
    <div className="flex-1 bg-slate-50 rounded-lg p-4 font-mono text-[11px] leading-6 border border-slate-100">
      <p>導入：AI普及の現状と現場のギャップ</p>
      <p>ポイント1：会社からの指示待ちの是非 - 自主的に取り組むべきか</p>
      <p>具体例：AIを活用できる部分を見つける工夫 (文章作成、データ分析)</p>
      <p>ポイント2：自己成長と業務効率化の両立</p>
      <p>まとめ：AI時代における主体的な姿勢の重要性</p>
    </div>

    <div className="mt-4 flex justify-end">
      <div className="px-6 py-2 bg-indigo-600 text-white rounded text-[12px] font-bold flex items-center">
        ✨ この内容を台本化
      </div>
    </div>
  </div>
);

export const Step4Mock: React.FC = () => (
  <div className="bg-white rounded-xl p-4 text-slate-800 shadow-2xl h-[400px] flex flex-col overflow-hidden">
    <div className="flex justify-between items-center text-[10px] border-b pb-2 mb-3">
      <span className="font-bold">AI時代に求められる仕事の姿勢</span>
      <span className="text-slate-400">Page 3 / 3</span>
    </div>

    <div className="flex-1 bg-slate-50 rounded overflow-hidden flex flex-col">
      <div className="flex p-4 bg-white m-2 rounded shadow-sm">
        <div className="flex-1 pr-4">
          <div className="font-bold text-lg mb-4">AI時代に求められる仕事の姿勢</div>
          <ul className="text-xs space-y-2 text-slate-600">
            <li className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>1. AI普及と現場の温度差を認識</li>
            <li className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>2. AI導入を「待つ」か「攻める」か</li>
            <li className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>3. 業務におけるAI活用の可能性</li>
            <li className="flex items-center"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>4. 効率化は「自分事」</li>
          </ul>
        </div>
        <div className="w-32 h-32 rounded bg-indigo-100 flex items-center justify-center overflow-hidden">
           {/* eslint-disable-next-line @next/next/no-img-element */}
           <img src="https://picsum.photos/seed/ai-bot/200/200" alt="Mock AI" className="object-cover w-full h-full" />
        </div>
      </div>

      <div className="mt-auto bg-amber-50 p-4 m-2 rounded border border-amber-100 text-[10px] leading-relaxed">
        <div className="font-bold text-amber-800 mb-1">🎤 スピーカーノート</div>
        AI普及の現状と現場の温度差について触れ、AI導入を待つか攻めるかの問いかけを行います。
        業務でのAI活用可能性を洗い出し、まずは自分ができる範囲からスタートしましょう。
        CanvaやChatGPTの例を挙げ、具体的なアクションを促します。
      </div>
    </div>
  </div>
);

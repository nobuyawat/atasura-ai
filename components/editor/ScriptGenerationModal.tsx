"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Mic,
  MicOff,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Volume2
} from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import {
  OutlineGenerationPayload,
  OutlineGenerationResult,
  ScriptGenerationPayload,
  ScriptGenerationResult,
  GenerationStep,
  ScriptBlock,
  SlideData
} from '@/lib/types';
import {
  generateOutline as apiGenerateOutline,
  generateScriptDraft,
  ScriptDraftInput,
  generateScriptDraftFallback,
} from '@/lib/scriptGenerator';
import { Zap, Lock } from 'lucide-react';
import { useCreditBalance } from '@/lib/hooks/useCreditBalance';
import Link from 'next/link';

// =====================================================
// AI生成関数（Gemini API経由）
// =====================================================

async function generateOutline(payload: OutlineGenerationPayload): Promise<OutlineGenerationResult> {
  console.log('[AI] Generating outline via Gemini API...', payload);

  const input: ScriptDraftInput = {
    sectionTitle: payload.sectionTitle,
    chapterTitle: payload.chapterTitle,
    courseTitle: payload.courseTitle,
    existingBullets: [],
    constraints: payload.constraintsText || '',
    voiceMemo: payload.voiceMemoText || '',
    duration: payload.durationMinutes,
    totalDuration: payload.totalMinutes,
    purposeText: payload.purposeText,
  };

  try {
    const result = await apiGenerateOutline(input);

    const summary = `この小見出しでは「${payload.purposeText.slice(0, 30)}」について、` +
      `約${payload.durationMinutes}分（全体の${Math.round(payload.ratio * 100)}%）で解説します。` +
      (result.speakerNotesHint ? `\n${result.speakerNotesHint}` : '');

    return {
      bullets: result.outlineBullets,
      summary,
    };
  } catch (error: any) {
    console.error('[AI] Outline generation failed:', error);
    throw new Error(error.message || '骨子の生成に失敗しました');
  }
}

async function generateScript(payload: ScriptGenerationPayload): Promise<ScriptGenerationResult> {
  console.log('[AI] Generating script via Gemini API...', payload);

  // 骨子から箇条書きを抽出
  const outlineBullets = payload.outlineDraft
    .split('\n')
    .filter(line => line.trim())
    .map(line => line.replace(/^[\d\.\-\•\・]+\s*/, '').replace(/^【.*?】/, '').trim());

  const input: ScriptDraftInput = {
    sectionTitle: payload.sectionTitle,
    chapterTitle: payload.chapterTitle,
    courseTitle: payload.courseTitle,
    existingBullets: outlineBullets,
    constraints: payload.constraintsText || '',
    voiceMemo: payload.voiceMemoText || '',
    duration: payload.durationMinutes,
    totalDuration: payload.totalMinutes,
    purposeText: payload.purposeText,
  };

  try {
    const result = await generateScriptDraft(input, outlineBullets);

    return {
      script: result.fullScript,
      slideTitle: payload.sectionTitle,
      slideBullets: result.slideBullets.length > 0 ? result.slideBullets : outlineBullets.slice(0, 5),
      speakerNotes: result.speakerNotes || `【話すポイント】\n・${payload.constraintsText || '初心者向け'}を意識\n・推定読み上げ時間: 約${result.estimatedDuration}分`,
    };
  } catch (error: any) {
    console.error('[AI] Script generation failed, using fallback:', error);

    // フォールバック: ダミー生成
    const fallback = await generateScriptDraftFallback(input);
    return {
      script: fallback.fullScript,
      slideTitle: payload.sectionTitle,
      slideBullets: fallback.slideBullets,
      speakerNotes: fallback.speakerNotes,
    };
  }
}

// =====================================================
// トーストコンポーネント
// =====================================================

interface ToastProps {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose: () => void;
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = {
    error: 'bg-red-500',
    success: 'bg-green-500',
    info: 'bg-blue-500',
  }[type];

  const Icon = {
    error: AlertCircle,
    success: CheckCircle2,
    info: Volume2,
  }[type];

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-[60] animate-slide-up`}>
      <Icon className="w-5 h-5" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:bg-white/20 rounded p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// =====================================================
// メインモーダルコンポーネント
// =====================================================

interface ScriptGenerationModalProps {
  sectionTitle: string;
  chapterTitle: string;
  courseTitle: string;
  totalDuration: number;
  onClose: () => void;
  onComplete: (result: {
    blocks: ScriptBlock[];
    slideData: SlideData;
  }) => void;
}

export default function ScriptGenerationModal({
  sectionTitle,
  chapterTitle,
  courseTitle,
  totalDuration,
  onClose,
  onComplete,
}: ScriptGenerationModalProps) {
  // クレジット残高
  const { balance: creditBalance, refetch: refetchBalance } = useCreditBalance();

  // ステップ管理
  const [step, setStep] = useState<GenerationStep>('input');

  // 入力値
  const [purposeText, setPurposeText] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(1); // デフォルト1分（5分構成を前提）
  const [constraintsText, setConstraintsText] = useState('');

  // 音声メモ（編集可能なテキスト）
  const [voiceMemoText, setVoiceMemoText] = useState('');

  // 音声入力
  const {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error: speechError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition();

  // 前回のtranscriptを追跡（差分検出用）
  const prevTranscriptRef = useRef('');

  // transcriptが更新されたらvoiceMemoTextに追記
  useEffect(() => {
    if (transcript && transcript !== prevTranscriptRef.current) {
      // 新しく追加された部分を抽出
      const newText = transcript.slice(prevTranscriptRef.current.length).trim();
      if (newText) {
        console.log('[SPEECH] New transcript detected:', newText);
        setVoiceMemoText(prev => {
          if (!prev) return newText;
          return prev + '\n' + newText;
        });
      }
      prevTranscriptRef.current = transcript;
    }
  }, [transcript]);

  // 骨子生成結果
  const [outlineBullets, setOutlineBullets] = useState('');
  const [outlineSummary, setOutlineSummary] = useState('');

  // 生成状態
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // トースト
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  // 音声エラーをトーストで表示
  useEffect(() => {
    if (speechError) {
      setToast({ message: speechError, type: 'error' });
    }
  }, [speechError]);

  // 割合計算
  const ratio = durationMinutes / totalDuration;

  // ペイロード生成
  const createPayload = useCallback((): OutlineGenerationPayload => ({
    courseTitle,
    chapterTitle,
    sectionTitle,
    purposeText,
    durationMinutes,
    totalMinutes: totalDuration,
    ratio,
    constraintsText: constraintsText || undefined,
    voiceMemoText: voiceMemoText || undefined,
  }), [courseTitle, chapterTitle, sectionTitle, purposeText, durationMinutes, totalDuration, ratio, constraintsText, voiceMemoText]);

  // 入力があるかどうか（テキスト or 音声、どちらかでOK）
  const hasAnyInput = purposeText.trim().length > 0 || voiceMemoText.trim().length > 0;

  // 骨子生成
  const handleGenerateOutline = useCallback(async () => {
    if (!purposeText.trim() && !voiceMemoText.trim()) {
      setToast({ message: 'テキスト入力または音声入力で、伝えたい内容を入力してください', type: 'error' });
      return;
    }

    setIsGeneratingOutline(true);
    setError(null);

    try {
      const result = await generateOutline(createPayload());
      setOutlineBullets(result.bullets.join('\n'));
      setOutlineSummary(result.summary);
      setStep('outline');
      setToast({ message: '骨子を生成しました', type: 'success' });
      // 生成成功後にクレジット情報をリフレッシュ（残り回数の反映）
      refetchBalance();
    } catch (err: any) {
      console.error('[OUTLINE] Generation error:', err);
      const errorMessage = err?.message || '骨子の生成に失敗しました。もう一度お試しください。';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
      // エラー時にクレジット情報をリフレッシュ（ロック状態の反映）
      refetchBalance();
    } finally {
      setIsGeneratingOutline(false);
    }
  }, [purposeText, voiceMemoText, createPayload, refetchBalance]);

  // 台本生成
  const handleGenerateScript = useCallback(async () => {
    if (!outlineBullets.trim()) {
      setToast({ message: '骨子を入力してください', type: 'error' });
      return;
    }

    setIsGeneratingScript(true);
    setError(null);

    try {
      const payload: ScriptGenerationPayload = {
        ...createPayload(),
        outlineDraft: outlineBullets,
      };
      const result = await generateScript(payload);

      // ScriptBlock配列を生成
      const blocks: ScriptBlock[] = [
        { id: `block-${Date.now()}-1`, type: 'heading2', content: result.slideTitle },
        ...result.slideBullets.map((bullet, i) => ({
          id: `block-${Date.now()}-${i + 2}`,
          type: 'bullet' as const,
          content: bullet,
        })),
        { id: `block-${Date.now()}-body`, type: 'body', content: result.script },
      ];

      // SlideData生成
      const slideData: SlideData = {
        title: result.slideTitle,
        bullets: result.slideBullets,
        speakerNotes: result.speakerNotes.split('\n'),
      };

      onComplete({ blocks, slideData });
      setToast({ message: '台本を生成しました', type: 'success' });
    } catch (err: any) {
      console.error('[SCRIPT] Generation error:', err);
      const errorMessage = err?.message || '台本の生成に失敗しました。もう一度お試しください。';
      setError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsGeneratingScript(false);
    }
  }, [outlineBullets, createPayload, onComplete]);

  // 前のステップに戻る
  const handleBack = useCallback(() => {
    if (step === 'outline') {
      setStep('input');
    }
  }, [step]);

  // モーダルマウント時のログ
  useEffect(() => {
    console.log('[MODAL_MOUNTED] ScriptGenerationModal rendered as Bottom Sheet', {
      sectionTitle,
      chapterTitle,
      className: 'fixed bottom-0 left-0 right-0 h-[60vh]'
    });
  }, [sectionTitle, chapterTitle]);

  return (
    <>
      {/* Bottom Sheet形式 - 下から60%の高さで表示 */}
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div data-testid="bottom-sheet-modal" className="fixed bottom-0 left-0 right-0 h-[60vh] bg-white rounded-t-2xl shadow-2xl z-50 flex flex-col animate-slide-up">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">台本の叩き台を生成</h3>
                <p className="text-xs text-slate-500">{sectionTitle}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* コンテキスト表示 */}
          <div className="px-6 py-2.5 bg-slate-50 text-xs text-slate-500 border-b shrink-0 flex items-center gap-2">
            <span className="text-slate-400">講座:</span>
            <span>{courseTitle}</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-400">章:</span>
            <span>{chapterTitle}</span>
          </div>

          {/* ステップインジケーター */}
          <div className="px-6 py-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              <StepIndicator
                number={1}
                label="入力"
                active={step === 'input'}
                completed={step === 'outline'}
              />
              <div className={`flex-1 h-0.5 ${step !== 'input' ? 'bg-purple-500' : 'bg-slate-200'}`} />
              <StepIndicator
                number={2}
                label="骨子確認"
                active={step === 'outline'}
                completed={false}
              />
              <div className={`flex-1 h-0.5 bg-slate-200`} />
              <StepIndicator
                number={3}
                label="台本化"
                active={false}
                completed={false}
              />
            </div>
          </div>

          {/* メインコンテンツ */}
          <div className="flex-1 overflow-y-auto p-6">
            {step === 'input' && (
              <div className="space-y-5">
                {/* 伝えたい内容 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    この小見出しで伝えたい内容 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={purposeText}
                    onChange={(e) => setPurposeText(e.target.value)}
                    placeholder="例: Reactの基本概念であるコンポーネントとは何かを、初心者にもわかりやすく説明したい"
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                  />
                  <p className="mt-2 text-xs text-purple-600 bg-purple-50 px-3 py-2 rounded-lg leading-relaxed">
                    💡 ざっくりでOK — 思いつくキーワードや大まかな内容を
                    <strong>テキスト入力</strong> または 下の<strong>音声入力</strong>で入力してください。
                    どちらか入力があれば次へ進めます。
                  </p>
                </div>

                {/* 時間配分 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    時間配分
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      min={1}
                      max={totalDuration}
                      className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center text-slate-900 bg-white"
                    />
                    <span className="text-slate-500">分</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-500">{totalDuration}分（全体）</span>
                    <span className="text-sm text-purple-600 font-medium ml-auto">
                      {Math.round(ratio * 100)}%
                    </span>
                  </div>
                </div>

                {/* 補足条件 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    補足条件（任意）
                  </label>
                  <input
                    type="text"
                    value={constraintsText}
                    onChange={(e) => setConstraintsText(e.target.value)}
                    placeholder="例: 初心者向け、事例多め、抽象控えめ"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>

                {/* 音声入力セクション */}
                <div className="border-t pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Mic className="w-4 h-4 text-purple-500" />
                      音声メモ（思いついたことをそのまま話してください）
                    </label>
                    {voiceMemoText && (
                      <button
                        onClick={() => {
                          setVoiceMemoText('');
                          resetTranscript();
                          prevTranscriptRef.current = '';
                        }}
                        className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        クリア
                      </button>
                    )}
                  </div>

                  {/* 音声エラー表示 */}
                  {speechError && (
                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-red-700 font-medium">{speechError}</p>
                        <p className="text-xs text-red-500 mt-1">
                          Chrome ブラウザ推奨。マイク権限を確認してください。
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 音声メモテキストエリア（編集可能） */}
                  <div className="relative">
                    <textarea
                      value={voiceMemoText + (interimTranscript ? (voiceMemoText ? '\n' : '') + `[認識中: ${interimTranscript}]` : '')}
                      onChange={(e) => {
                        // 手動編集も可能（認識中は interim 部分を除去）
                        if (!isListening) {
                          setVoiceMemoText(e.target.value);
                        }
                      }}
                      readOnly={isListening}
                      placeholder="🎤 録音ボタンを押して話してください（手入力も可能）"
                      rows={4}
                      className={`w-full px-4 py-3 border rounded-lg resize-none outline-none transition-colors text-slate-900 placeholder:text-slate-400 ${
                        isListening
                          ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-500'
                          : 'border-slate-300 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500'
                      }`}
                    />
                    {isListening && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                        </span>
                        録音中
                      </div>
                    )}
                  </div>

                  {/* 音声入力ボタン */}
                  <div className="flex items-center gap-3 mt-3">
                    {isSupported ? (
                      <button
                        onClick={() => {
                          console.log('[SPEECH_BTN] Clicked, isListening:', isListening);
                          if (isListening) {
                            stopListening();
                          } else {
                            startListening();
                          }
                        }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                          isListening
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="w-4 h-4" />
                            録音停止
                          </>
                        ) : (
                          <>
                            <Mic className="w-4 h-4" />
                            録音開始
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-amber-600 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertCircle className="w-4 h-4" />
                        <div>
                          <p className="font-medium">音声認識に非対応のブラウザです</p>
                          <p className="text-xs mt-0.5">Chrome または Edge ブラウザをお使いください</p>
                        </div>
                      </div>
                    )}

                    {transcript && (
                      <span className="text-xs text-slate-500">
                        {transcript.split('\n').length}行 / {transcript.length}文字
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 'outline' && (
              <div className="space-y-5">
                {/* 要約 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    📋 要約
                  </label>
                  <textarea
                    value={outlineSummary}
                    onChange={(e) => setOutlineSummary(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none text-sm"
                  />
                </div>

                {/* 骨子 */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    📝 骨子（編集可能）
                  </label>
                  <textarea
                    value={outlineBullets}
                    onChange={(e) => setOutlineBullets(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none font-mono text-sm"
                    placeholder="骨子を編集してください..."
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    ※ 骨子を編集してから「この内容を台本化」を押してください
                  </p>
                </div>

                {/* 入力情報のサマリ */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-slate-600 mb-2">入力情報</p>
                  <ul className="text-xs text-slate-500 space-y-1">
                    <li>• 目的: {purposeText.slice(0, 50)}...</li>
                    <li>• 時間: {durationMinutes}分 / {totalDuration}分（{Math.round(ratio * 100)}%）</li>
                    {constraintsText && <li>• 条件: {constraintsText}</li>}
                    {transcript && <li>• 音声メモ: {transcript.slice(0, 30)}...</li>}
                  </ul>
                </div>
              </div>
            )}

            {/* エラー表示 */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="px-6 py-4 border-t bg-slate-50 flex justify-between shrink-0">
            <div>
              {step === 'outline' && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                  戻る
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium"
              >
                キャンセル
              </button>

              {step === 'input' && (
                <div className="flex flex-col items-end gap-1">
                  {/* 無料プランロック表示 */}
                  {creditBalance?.plan === 'free' && creditBalance?.freePlan?.locked ? (
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm font-bold">上限に達しました</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-red-500 font-bold mb-1">
                          無料プランの上限（2分台本×3本）に達しました
                        </p>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-pink-500 hover:text-pink-600 underline underline-offset-2"
                        >
                          プランをアップグレード →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleGenerateOutline}
                        disabled={!hasAnyInput || isGeneratingOutline}
                        className={`
                          relative px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all
                          ${hasAnyInput && !isGeneratingOutline
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/30'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                        `}
                        title="クレジットを消費してAI生成します"
                      >
                        {isGeneratingOutline ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            骨子を生成
                            {creditBalance?.plan !== 'free' && (
                              <span className="ml-1 text-[9px] font-medium bg-white/25 px-1.5 py-0.5 rounded-full">
                                -11
                              </span>
                            )}
                          </>
                        )}
                      </button>
                      {creditBalance && (
                        <span className="text-[9px] text-emerald-500">
                          {creditBalance.plan === 'free'
                            ? `残り: ${creditBalance.freePlan.limit - creditBalance.freePlan.uses}/${creditBalance.freePlan.limit} 回`
                            : `残り: ${creditBalance.creditsRemaining} クレジット`
                          }
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              {step === 'outline' && (
                <div className="flex flex-col items-end gap-1">
                  {/* 無料プランロック表示 */}
                  {creditBalance?.plan === 'free' && creditBalance?.freePlan?.locked ? (
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500">
                        <Lock className="w-4 h-4" />
                        <span className="text-sm font-bold">上限に達しました</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-red-500 font-bold mb-1">
                          無料プランの上限（2分台本×3本）に達しました
                        </p>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-pink-500 hover:text-pink-600 underline underline-offset-2"
                        >
                          プランをアップグレード →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleGenerateScript}
                        disabled={!outlineBullets.trim() || isGeneratingScript}
                        className={`
                          relative px-6 py-2.5 rounded-lg font-bold flex items-center gap-2 transition-all
                          ${outlineBullets.trim() && !isGeneratingScript
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/30'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                        `}
                        title="クレジットを消費してAI生成します"
                      >
                        {isGeneratingScript ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            台本化中...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            この内容を台本化
                            {creditBalance?.plan !== 'free' && (
                              <span className="ml-1 text-[9px] font-medium bg-white/25 px-1.5 py-0.5 rounded-full">
                                -11
                              </span>
                            )}
                          </>
                        )}
                      </button>
                      {creditBalance && (
                        <span className="text-[9px] text-emerald-500">
                          {creditBalance.plan === 'free'
                            ? `残り: ${creditBalance.freePlan.limit - creditBalance.freePlan.uses}/${creditBalance.freePlan.limit} 回`
                            : `残り: ${creditBalance.creditsRemaining} クレジット`
                          }
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

      {/* トースト */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

// =====================================================
// ステップインジケーター
// =====================================================

interface StepIndicatorProps {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}

function StepIndicator({ number, label, active, completed }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
          completed
            ? 'bg-purple-500 text-white'
            : active
            ? 'bg-purple-500 text-white'
            : 'bg-slate-200 text-slate-500'
        }`}
      >
        {completed ? <CheckCircle2 className="w-4 h-4" /> : number}
      </div>
      <span
        className={`text-xs font-medium ${
          active ? 'text-purple-600' : 'text-slate-500'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

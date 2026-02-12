"use client";

import React, { useState, useCallback } from 'react';
import { Plus, Trash2, BookOpen, Clock, ArrowRight, Lightbulb } from 'lucide-react';
import { SetupFormData, CourseData, Chapter } from '@/lib/types';

interface SetupScreenProps {
  onComplete: (course: CourseData) => void;
}

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const [courseTitle, setCourseTitle] = useState('');
  const [totalDuration, setTotalDuration] = useState(5); // デフォルト5分（まず進める）
  const [chapterTitles, setChapterTitles] = useState<string[]>(['', '', '']);

  // 章を追加
  const addChapter = useCallback(() => {
    setChapterTitles(prev => [...prev, '']);
  }, []);

  // 章を削除
  const removeChapter = useCallback((index: number) => {
    if (chapterTitles.length <= 1) return;
    setChapterTitles(prev => prev.filter((_, i) => i !== index));
  }, [chapterTitles.length]);

  // 章タイトルを更新
  const updateChapterTitle = useCallback((index: number, value: string) => {
    setChapterTitles(prev => prev.map((t, i) => i === index ? value : t));
  }, []);

  // フォーム送信
  const handleSubmit = useCallback(() => {
    // バリデーション：講座テーマのみ必須
    if (!courseTitle.trim()) {
      alert('講座テーマを入力してください');
      return;
    }

    // 章タイトルが入力されていない場合はデフォルト章を作成
    const validChapters = chapterTitles.filter(t => t.trim());
    const chaptersToUse = validChapters.length > 0
      ? validChapters
      : ['第1章']; // 未入力時はデフォルト章名

    // CourseData を生成
    const now = new Date();
    const course: CourseData = {
      id: `course-${Date.now()}`,
      title: courseTitle.trim(),
      totalDuration,
      chapters: chaptersToUse.map((title, index) => ({
        id: `ch-${index + 1}`,
        title: title.trim(),
        sections: [] // 初期状態では節なし
      })),
      createdAt: now,
      updatedAt: now,
    };

    console.log('[SETUP] Course created:', course);
    onComplete(course);
  }, [courseTitle, totalDuration, chapterTitles, onComplete]);

  // 講座テーマのみ必須（章タイトル未入力でも進行可能）
  const isValid = courseTitle.trim();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* ヘッダー */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-6 shadow-lg">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-3">
            新しい講座を作成
          </h1>
          <p className="text-slate-500 text-lg">
            まずは講座の<span className="font-semibold text-blue-600">テーマ</span>と
            <span className="font-semibold text-blue-600">大まかな章構成</span>を決めましょう
          </p>
        </div>

        {/* ガイダンス */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex gap-3">
          <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">💡 思考の流れに沿った設計</p>
            <p className="text-amber-700">
              いきなり台本を書くのではなく、まず「何を伝えたいか」の構造を決めます。
              詳細は後から追加できるので、ここでは大枠だけでOKです。
            </p>
          </div>
        </div>

        {/* フォーム */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-8">
          {/* 講座テーマ */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              講座テーマ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              placeholder="例：未経験から始めるReactエンジニア講座"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
            <p className="text-xs text-slate-400 mt-2">受講者に伝わる、具体的なテーマを入力してください</p>
          </div>

          {/* 全体時間 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              全体時間（目安）
            </label>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <input
                type="number"
                value={totalDuration}
                onChange={(e) => setTotalDuration(Number(e.target.value))}
                min={1}
                max={600}
                className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-center text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <span className="text-slate-600">分</span>
            </div>
          </div>

          {/* 章構成 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              章構成 <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              {chapterTitles.map((title, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => updateChapterTitle(index, e.target.value)}
                    placeholder={`第${index + 1}章のタイトル`}
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                  {chapterTitles.length > 1 && (
                    <button
                      onClick={() => removeChapter(index)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addChapter}
              className="mt-4 flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              章を追加
            </button>
          </div>

          {/* 送信ボタン */}
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleSubmit}
              disabled={!isValid}
              className={`
                w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all
                ${isValid
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'}
              `}
            >
              次へ
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-center text-xs text-slate-400 mt-3">
              ※ 章構成は後から変更できます
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

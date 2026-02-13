'use client';

/**
 * トークン使用量ページ (/app/usage)
 * 認証必須（middleware で保護済み）
 *
 * generation_logs テーブルをクエリして
 * ユーザーごとのGemini API トークン消費を可視化
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, BarChart3, Zap, Clock, Hash } from 'lucide-react';

// ===============================
// 型定義
// ===============================

interface GenerationLog {
  id: string;
  action_type: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  model: string | null;
  duration_ms: number | null;
  success: boolean;
  created_at: string;
}

interface ActionSummary {
  action_type: string;
  count: number;
  total_prompt_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  avg_duration_ms: number;
}

interface DailySummary {
  date: string;
  count: number;
  total_tokens: number;
}

// ===============================
// ユーティリティ
// ===============================

const ACTION_LABELS: Record<string, string> = {
  outline_generation: '骨子生成',
  script_generation: '台本生成',
  slide_generation: 'スライド生成',
  image_prompt_translation: '画像プロンプト翻訳',
  image_generation: '画像生成',
};

function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ===============================
// コンポーネント
// ===============================

export default function UsagePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [actionSummary, setActionSummary] = useState<ActionSummary[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalCalls, setTotalCalls] = useState(0);

  useEffect(() => {
    fetchUsageData();
  }, []);

  async function fetchUsageData() {
    const supabase = createClient();

    // 認証チェック
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login?redirect=/app/usage');
      return;
    }

    // 今月の開始日
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // 直近50件のログ取得
    const { data: recentLogs, error } = await supabase
      .from('generation_logs')
      .select('id, action_type, input_tokens, output_tokens, total_tokens, model, duration_ms, success, created_at')
      .eq('user_id', user.id)
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[usage] Failed to fetch logs:', error);
      setLoading(false);
      return;
    }

    const allLogs = recentLogs || [];
    setLogs(allLogs);

    // サマリー計算
    const total = allLogs.reduce((sum, l) => sum + (l.total_tokens || 0), 0);
    setTotalTokens(total);
    setTotalCalls(allLogs.length);

    // 機能別集計
    const actionMap = new Map<string, ActionSummary>();
    for (const log of allLogs) {
      const key = log.action_type;
      const existing = actionMap.get(key) || {
        action_type: key,
        count: 0,
        total_prompt_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        avg_duration_ms: 0,
      };
      existing.count++;
      existing.total_prompt_tokens += log.input_tokens || 0;
      existing.total_output_tokens += log.output_tokens || 0;
      existing.total_tokens += log.total_tokens || 0;
      existing.avg_duration_ms += log.duration_ms || 0;
      actionMap.set(key, existing);
    }
    // 平均durationを計算
    const summaries = Array.from(actionMap.values()).map(s => ({
      ...s,
      avg_duration_ms: s.count > 0 ? Math.round(s.avg_duration_ms / s.count) : 0,
    }));
    setActionSummary(summaries);

    // 日別集計
    const dailyMap = new Map<string, DailySummary>();
    for (const log of allLogs) {
      const date = log.created_at.split('T')[0];
      const existing = dailyMap.get(date) || { date, count: 0, total_tokens: 0 };
      existing.count++;
      existing.total_tokens += log.total_tokens || 0;
      dailyMap.set(date, existing);
    }
    const dailies = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    setDailySummary(dailies);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05060f] text-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">使用量データを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05060f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#05060f]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/app" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <ArrowLeft size={18} className="text-gray-400" />
          </Link>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-indigo-400" />
            <h1 className="text-lg font-bold">Token Usage</h1>
          </div>
          <span className="text-xs text-gray-500 ml-2">今月の使用量</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* ===== サマリーカード ===== */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-yellow-400" />
              <span className="text-xs text-gray-400 font-medium">合計トークン</span>
            </div>
            <p className="text-2xl font-black tabular-nums">{formatNumber(totalTokens)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Hash size={16} className="text-blue-400" />
              <span className="text-xs text-gray-400 font-medium">API呼び出し回数</span>
            </div>
            <p className="text-2xl font-black tabular-nums">{formatNumber(totalCalls)}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-green-400" />
              <span className="text-xs text-gray-400 font-medium">平均トークン/回</span>
            </div>
            <p className="text-2xl font-black tabular-nums">
              {totalCalls > 0 ? formatNumber(Math.round(totalTokens / totalCalls)) : '—'}
            </p>
          </div>
        </section>

        {/* ===== 機能別内訳 ===== */}
        <section>
          <h2 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
            <BarChart3 size={14} />
            機能別内訳
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-white/5">
                  <th className="text-left py-2 px-3 font-medium">機能</th>
                  <th className="text-right py-2 px-3 font-medium">回数</th>
                  <th className="text-right py-2 px-3 font-medium">Prompt</th>
                  <th className="text-right py-2 px-3 font-medium">Output</th>
                  <th className="text-right py-2 px-3 font-medium">合計</th>
                  <th className="text-right py-2 px-3 font-medium">平均ms</th>
                </tr>
              </thead>
              <tbody>
                {actionSummary.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-gray-500">データなし</td></tr>
                ) : (
                  actionSummary.map(s => (
                    <tr key={s.action_type} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 text-gray-300">{ACTION_LABELS[s.action_type] || s.action_type}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{s.count}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-400">{formatNumber(s.total_prompt_tokens)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-400">{formatNumber(s.total_output_tokens)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium">{formatNumber(s.total_tokens)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-gray-400">{formatNumber(s.avg_duration_ms)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== 日別推移 ===== */}
        <section>
          <h2 className="text-sm font-bold text-gray-300 mb-3">日別推移</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-white/5">
                  <th className="text-left py-2 px-3 font-medium">日付</th>
                  <th className="text-right py-2 px-3 font-medium">呼び出し回数</th>
                  <th className="text-right py-2 px-3 font-medium">合計トークン</th>
                </tr>
              </thead>
              <tbody>
                {dailySummary.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-6 text-gray-500">データなし</td></tr>
                ) : (
                  dailySummary.map(d => (
                    <tr key={d.date} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 text-gray-300">{d.date}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{d.count}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium">{formatNumber(d.total_tokens)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== 直近ログ ===== */}
        <section>
          <h2 className="text-sm font-bold text-gray-300 mb-3">直近ログ（最大50件）</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-white/5">
                  <th className="text-left py-2 px-3 font-medium">日時</th>
                  <th className="text-left py-2 px-3 font-medium">機能</th>
                  <th className="text-right py-2 px-3 font-medium">Prompt</th>
                  <th className="text-right py-2 px-3 font-medium">Output</th>
                  <th className="text-right py-2 px-3 font-medium">合計</th>
                  <th className="text-left py-2 px-3 font-medium">Model</th>
                  <th className="text-right py-2 px-3 font-medium">ms</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-500">
                    まだログがありません。骨子→台本→スライドを生成すると、ここに表示されます。
                  </td></tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2 px-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="py-2 px-3 text-gray-300 text-xs">{ACTION_LABELS[log.action_type] || log.action_type}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-400">{formatNumber(log.input_tokens || 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-400">{formatNumber(log.output_tokens || 0)}</td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium">{formatNumber(log.total_tokens || 0)}</td>
                      <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">{log.model || '—'}</td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-400">{log.duration_ms ? formatNumber(log.duration_ms) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== 注記 ===== */}
        <section className="text-xs text-gray-500 space-y-1 pb-10">
          <p>* トークン数は Gemini API の usageMetadata から取得しています。</p>
          <p>* 画像生成（Imagen 4）にはトークン概念がないため、トークン数は0と表示されます。</p>
          <p>* 1クレジット消費に対する実トークン数は、機能や入力量により変動します。</p>
        </section>
      </main>
    </div>
  );
}

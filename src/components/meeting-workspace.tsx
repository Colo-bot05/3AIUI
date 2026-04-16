"use client";

import { useState } from "react";

import { MODE_OPTIONS } from "@/features/meeting/mode-config";
import type { MeetingMode, MeetingRunResult } from "@/features/meeting/types";

const DEFAULT_THEME = "商用LLMを使って、ローカルLLM構築の設計議論を加速するMVPを考えたい";

const INITIAL_RESULT: MeetingRunResult = {
  theme: DEFAULT_THEME,
  mode: "design_review",
  generatedAt: "2026-04-16T00:00:00.000Z",
  responses: [
    {
      role: "vision",
      label: "構想AI",
      viewpoint: "可能性を押し広げる提案役",
      emphasis: "新しい価値の打ち出し",
      content:
        "3AIをただ並べるのではなく、“会議”として見せることでプロダクトの意味が立ちます。\n\nユーザーはテーマを入力したあと、3つの人格が異なる立場で考え、それを最後に統合する流れを一度で体験できるべきです。",
    },
    {
      role: "reality",
      label: "現実AI",
      viewpoint: "実装・運用の現実性を見る実務役",
      emphasis: "実装順序とコスト感",
      content:
        "MVPでは、UIとモックAPIの境界を先に作れば十分です。\n\n本物のLLM接続を急がず、まずは入力・実行・3AI表示・統合結果表示までの一連の導線を壊れない形で整えましょう。",
    },
    {
      role: "audit",
      label: "監査AI",
      viewpoint: "抜け漏れやリスクを止める監査役",
      emphasis: "失敗条件の先回り",
      content:
        "最初のPRで守るべきなのは、責務を混ぜないことと、広げすぎないことです。\n\nCI・Docker・READMEまで含めておくと、次のPR以降が安全に進められます。",
    },
  ],
  synthesis: {
    agreements: [
      "3AIの役割が一目で分かるUIにする。",
      "統合結果エリアを画面の主役の1つとして扱う。",
      "モック実装でもAPI境界を作って将来差し替えやすくする。",
    ],
    openQuestions: [
      "実LLM接続時のProvider Adapterの責務範囲。",
      "会話履歴保存の初期スキーマ設計。",
      "発言を逐次ストリーミングにするかどうか。",
    ],
    recommendation:
      "最初の土台では、会議UI・モックAPI・Docker・CI・READMEを整え、次のPRで永続化と実オーケストレーションの足場へ進むのが自然です。",
  },
};

const ROLE_STYLES = {
  vision: "from-orange-100 to-amber-50 border-orange-200",
  reality: "from-sky-100 to-cyan-50 border-sky-200",
  audit: "from-emerald-100 to-teal-50 border-emerald-200",
} as const;

export function MeetingWorkspace() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [mode, setMode] = useState<MeetingMode>("design_review");
  const [result, setResult] = useState<MeetingRunResult>(INITIAL_RESULT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/meeting/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ theme, mode }),
      });

      if (!response.ok) {
        throw new Error("会議の生成に失敗しました。");
      }

      const nextResult = (await response.json()) as MeetingRunResult;
      setResult(nextResult);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "不明なエラーが発生しました。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <section className="glass-panel grid-pattern overflow-hidden rounded-[2rem]">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.4fr_0.9fr] lg:px-10 lg:py-10">
          <div className="space-y-5">
            <span className="section-title">3AI Meeting UI / MVP</span>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
                1つのテーマを、3つの視点で議論し、最後に統合結論まで導く。
              </h1>
              <p className="max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
                構想AI・現実AI・監査AIがそれぞれ異なる役割で発言し、最後に合意事項と未決事項、
                推奨案をまとめるMVPです。初回はモック実装ですが、後から商用LLMやローカルLLMへ差し替えやすい形にしています。
              </p>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-zinc-900/10 bg-white/75 p-5 shadow-[0_18px_50px_rgba(25,25,25,0.09)]">
            <div className="space-y-5">
              <div>
                <p className="section-title">Theme</p>
                <textarea
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  rows={4}
                  className="mt-2 w-full resize-none rounded-2xl border border-zinc-900/10 bg-white px-4 py-3 text-sm leading-7 text-zinc-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                  placeholder="議論したいテーマを入力"
                />
              </div>

              <div>
                <p className="section-title">Mode</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {MODE_OPTIONS.map((option) => {
                    const active = option.value === mode;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMode(option.value)}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-orange-500 bg-orange-50 text-zinc-950 shadow-sm"
                            : "border-zinc-900/10 bg-white text-zinc-500 hover:border-zinc-900/20 hover:bg-zinc-50"
                        }`}
                      >
                        <div className="text-sm font-semibold">{option.label}</div>
                        <div className="mt-1 text-xs leading-5">{option.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                >
                  {loading ? "会議を生成中..." : "3AI会議を実行"}
                </button>
                <p className="text-xs leading-6 text-zinc-500">
                  API層はモック実装です。後から Provider Adapter を差し込めるように分離しています。
                </p>
              </div>

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="section-title">Discussion</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
                3AI の発言
              </h2>
            </div>
            <p className="text-xs text-zinc-500">
              Theme: <span className="font-medium text-zinc-700">{result.theme}</span>
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {result.responses.map((response) => (
              <article
                key={response.role}
                className={`rounded-[1.5rem] border bg-gradient-to-b p-5 shadow-[0_18px_40px_rgba(25,25,25,0.06)] ${ROLE_STYLES[response.role]}`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="section-title">{response.label}</p>
                      <h3 className="mt-2 text-lg font-semibold text-zinc-950">
                        {response.viewpoint}
                      </h3>
                    </div>
                    <span className="rounded-full border border-zinc-900/10 bg-white/80 px-3 py-1 font-mono text-[11px] text-zinc-600">
                      {response.emphasis}
                    </span>
                  </div>
                  <p className="rich-text text-sm text-zinc-700">{response.content}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="glass-panel rounded-[1.75rem] p-6">
          <div className="space-y-6">
            <div>
              <p className="section-title">Synthesis</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
                統合結果
              </h2>
              <p className="mt-2 text-sm leading-7 text-zinc-600">
                3つの視点を受けて、合意事項・未決事項・推奨案をひと目で確認できます。
              </p>
            </div>

            <section className="rounded-[1.5rem] border border-zinc-900/10 bg-white/70 p-5">
              <h3 className="text-sm font-semibold text-zinc-950">合意事項</h3>
              <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-700">
                {result.synthesis.agreements.map((agreement) => (
                  <li key={agreement} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-orange-500" />
                    <span>{agreement}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[1.5rem] border border-zinc-900/10 bg-white/70 p-5">
              <h3 className="text-sm font-semibold text-zinc-950">未決事項</h3>
              <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-700">
                {result.synthesis.openQuestions.map((question) => (
                  <li key={question} className="flex gap-3">
                    <span className="mt-2 h-2 w-2 rounded-full bg-sky-500" />
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-[1.5rem] border border-orange-200 bg-orange-50/80 p-5">
              <h3 className="text-sm font-semibold text-zinc-950">推奨案</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-700">
                {result.synthesis.recommendation}
              </p>
            </section>
          </div>
        </aside>
      </section>
    </div>
  );
}

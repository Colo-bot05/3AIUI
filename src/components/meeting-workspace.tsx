"use client";

import { useState } from "react";

import { MODE_OPTIONS } from "@/features/meeting/mode-config";
import {
  buildConversationStateSnapshot,
  getAllowedStatesForMode,
  getInitialConversationState,
  isExplicitSynthesisTrigger,
} from "@/features/meeting/state";
import type {
  ConversationState,
  DebateModel,
  DebateRole,
  DebateRoleAssignments,
  MeetingMessageType,
  MeetingMode,
  MeetingRunResult,
  SpeakerRole,
} from "@/features/meeting/types";

const DEFAULT_THEME =
  "商用LLMを使って、ローカルLLM構築の設計議論を加速するMVPを考えたい";

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
  vision: {
    bubble: "border-orange-200 bg-orange-50/90",
    marker: "bg-orange-500",
    accent: "text-orange-900",
    model: "GPT",
  },
  reality: {
    bubble: "border-sky-200 bg-sky-50/90",
    marker: "bg-sky-500",
    accent: "text-sky-900",
    model: "Gemini",
  },
  audit: {
    bubble: "border-emerald-200 bg-emerald-50/90",
    marker: "bg-emerald-500",
    accent: "text-emerald-900",
    model: "Claude",
  },
} as const;

const PANEL_PLACEHOLDERS = {
  brainstorm: {
    heading: "発散メモ",
    items: [
      "アイデア一覧は統合指示後に表示",
      "有望案の抽出はまだ未実行",
      "補足観点は次の整理待ち",
    ],
    note: "ユーザーが「統合して」「ここまでで整理して」と指示するまで、発散中の表示を維持します。",
  },
  design_review: {
    heading: "論点メモ",
    items: [
      "合意事項はまだ未確定",
      "未決事項は議論の進行に応じて整理",
      "懸念点と次アクションは後続PRで連動予定",
    ],
    note: "ディスカッションでは、ユーザーの整理指示があるまで議論中の状態を保つ前提です。",
  },
  debate: {
    heading: "判定メモ",
    items: [
      "賛成側・反対側・審判の割当UIは次PRで接続",
      "判定結果はまだ未実行",
      "残る論点の整理だけを表示枠として先置き",
    ],
    note: "このPRではレイアウトだけを先に作り、判定ロジックや役割制約は実装しません。",
  },
} as const;

const DEBATE_MODELS: Array<{ value: DebateModel; label: string }> = [
  { value: "gpt", label: "GPT" },
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
];

const DEBATE_ROLE_LABELS: Record<DebateRole, string> = {
  pro: "賛成側AI",
  con: "反対側AI",
  judge: "審判AI",
};

const INITIAL_DEBATE_ASSIGNMENTS: DebateRoleAssignments = {
  pro: "gpt",
  con: "gemini",
  judge: "claude",
};

type TimelineEntry = {
  id: string;
  messageType: MeetingMessageType;
  title: string;
  label: string;
  accentClass: string;
  markerClass: string;
  body: string;
  meta?: string;
  side?: "left" | "right";
};

type SummarySection = {
  title: string;
  tone: string;
  items?: string[];
  body?: string;
};

function formatTimestamp(isoTimestamp: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoTimestamp));
}

export function MeetingWorkspace() {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [submittedPrompt, setSubmittedPrompt] = useState(DEFAULT_THEME);
  const [mode, setMode] = useState<MeetingMode>("design_review");
  const [conversationState, setConversationState] = useState<ConversationState>(
    getInitialConversationState("design_review"),
  );
  const [result, setResult] = useState<MeetingRunResult>(INITIAL_RESULT);
  const [lastDiscussionMode, setLastDiscussionMode] =
    useState<MeetingMode>("design_review");
  const [debateAssignments, setDebateAssignments] = useState<DebateRoleAssignments>(
    INITIAL_DEBATE_ASSIGNMENTS,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDuplicateDebateAssignments =
    mode === "debate" &&
    new Set(
      Object.values(debateAssignments).filter(
        (value): value is DebateModel => value !== "",
      ),
    ).size !== Object.values(debateAssignments).filter(Boolean).length;
  const hasIncompleteDebateAssignments =
    mode === "debate" &&
    Object.values(debateAssignments).some((value) => value === "");

  async function handleRun() {
    const trimmedInput = theme.trim();
    const isSynthesisRequest = isExplicitSynthesisTrigger(trimmedInput, mode);

    if (mode === "debate") {
      setSubmittedPrompt(trimmedInput || DEFAULT_THEME);

      if (hasIncompleteDebateAssignments) {
        setError("ディベートを開始するには、賛成側・反対側・審判をすべて選択してください。");
        return;
      }

      if (hasDuplicateDebateAssignments) {
        setError("同じAIを複数のディベート役割に割り当てることはできません。");
        return;
      }
    }

    if (isSynthesisRequest) {
      setSubmittedPrompt(trimmedInput);

      if (lastDiscussionMode !== mode) {
        setError("先にこのモードで議論を表示してから統合してください。");
        return;
      }

      setError(null);
      setConversationState("synthesized");
      return;
    }

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
      setSubmittedPrompt(trimmedInput || DEFAULT_THEME);
      setResult(nextResult);
      setLastDiscussionMode(mode);
      setConversationState(
        mode === "brainstorm"
          ? "brainstorming"
          : mode === "debate"
            ? "debating"
            : "discussing",
      );
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

  const activeMode = MODE_OPTIONS.find((option) => option.value === mode) ?? MODE_OPTIONS[1];
  const activeState = buildConversationStateSnapshot(mode, conversationState);
  const stateCandidates = getAllowedStatesForMode(mode).map((state) =>
    buildConversationStateSnapshot(mode, state),
  );
  const activePlaceholder = PANEL_PLACEHOLDERS[mode];
  const hasSynthesis =
    mode !== "debate" && conversationState === "synthesized";
  const debateAssignmentSummary = [
    `${DEBATE_ROLE_LABELS.pro}: ${
      DEBATE_MODELS.find((item) => item.value === debateAssignments.pro)?.label ?? "未選択"
    }`,
    `${DEBATE_ROLE_LABELS.con}: ${
      DEBATE_MODELS.find((item) => item.value === debateAssignments.con)?.label ?? "未選択"
    }`,
    `${DEBATE_ROLE_LABELS.judge}: ${
      DEBATE_MODELS.find((item) => item.value === debateAssignments.judge)?.label ?? "未選択"
    }`,
  ].join("\n");

  const synthesisBody = [
    "合意事項",
    ...result.synthesis.agreements.map((item) => `- ${item}`),
    "",
    "未決事項",
    ...result.synthesis.openQuestions.map((item) => `- ${item}`),
    "",
    "推奨案",
    result.synthesis.recommendation,
  ].join("\n");

  const synthesisSections: SummarySection[] = [
    {
      title: "合意事項",
      tone: "border-orange-200 bg-orange-50/85",
      items: result.synthesis.agreements,
    },
    {
      title: "未決事項",
      tone: "border-sky-200 bg-sky-50/85",
      items: result.synthesis.openQuestions,
    },
    {
      title: "推奨案",
      tone: "border-violet-200 bg-violet-50/90",
      body: result.synthesis.recommendation,
    },
  ];

  const timelineEntries: TimelineEntry[] = [
    {
      id: "status",
      messageType: "system_status",
      title: "ワークスペース状態",
      label: activeState.label,
      accentClass: "text-zinc-700",
      markerClass: "bg-zinc-400",
      body: activeState.hint,
      meta: `system_status / ${activeState.state}`,
    },
    {
      id: "user-theme",
      messageType: "user",
      title: "ユーザー",
      label: "テーマ投稿",
      accentClass: "text-zinc-950",
      markerClass: "bg-zinc-950",
      body:
        mode === "debate"
          ? `${submittedPrompt}\n\n現在の割当\n${debateAssignmentSummary}`
          : submittedPrompt,
      meta:
        mode === "debate"
          ? `mode: ${activeMode.label} / roles assigned`
          : `mode: ${activeMode.label}`,
      side: "right",
    },
    ...result.responses.map((response, index) => ({
      id: response.role,
      messageType: "ai_message" as const,
      title: response.label,
      label: response.viewpoint,
      accentClass: ROLE_STYLES[response.role].accent,
      markerClass: ROLE_STYLES[response.role].marker,
      body: response.content,
      meta: `${ROLE_STYLES[response.role].model} / turn ${index + 1}`,
    })),
    ...(mode === "debate"
      ? [
          {
            id: "synthesis-waiting",
            messageType: "debate_judgment" as const,
            title: "判定待ち",
            label: "ユーザーが判定指示を出すまで保留",
            accentClass: "text-violet-900",
            markerClass: "bg-violet-500",
            body: "この位置に最終判定メッセージが入る想定です。今回はレイアウトのみで、勝敗や推奨結論はまだ生成しません。",
            meta: "debate_judgment placeholder",
          },
        ]
      : hasSynthesis
        ? [
            {
              id: "synthesis-result",
              messageType: "synthesis" as const,
              title: "統合結果",
              label: "ユーザー明示指示で生成",
              accentClass: "text-violet-900",
              markerClass: "bg-violet-500",
              body: synthesisBody,
              meta: "synthesis / explicit trigger",
            },
          ]
        : [
            {
              id: "synthesis-waiting",
              messageType: "synthesis" as const,
              title: "統合待ち",
              label: "ユーザーが整理指示を出すまで保留",
              accentClass: "text-violet-900",
              markerClass: "bg-violet-500",
              body: "この位置に統合メッセージが入る想定です。ユーザーが明示的に整理を依頼するまで、AI はまだ最終結論を固定しません。",
              meta: "synthesis placeholder",
            },
          ]),
  ];

  return (
    <div className="grid gap-6 pb-8 xl:grid-cols-[minmax(0,1.35fr)_380px]">
      <section className="glass-panel grid-pattern overflow-hidden rounded-[2rem]">
        <div className="border-b border-zinc-900/10 px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <span className="section-title">3AI Group Chat Workspace</span>
              <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
                3AI が会話し、ユーザーが必要なタイミングで整理を指示する。
              </h1>
              <p className="max-w-3xl text-base leading-8 text-zinc-600 sm:text-lg">
                3AI を比較するのではなく、ひとつのテーマをめぐって役割付きで会話するワークスペースです。
                このPRではタイムライン型レイアウトを先に整え、統合や判定の本ロジックはまだ載せません。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${activeMode.panelTone}`}
              >
                {activeMode.label} / {activeState.label}
              </span>
              <span className="rounded-full border border-zinc-900/10 bg-white/80 px-4 py-2 text-sm text-zinc-600">
                mock conversation
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="timeline-rail space-y-5">
            {timelineEntries.map((entry) => {
              const isUser = entry.side === "right";
              const isSystem = entry.messageType === "system_status";
              const isSummaryPlaceholder =
                entry.messageType === "synthesis" ||
                entry.messageType === "debate_judgment";

              return (
                <article
                  key={entry.id}
                  className={`relative flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser ? (
                    <div
                      className={`relative z-10 mt-3 h-4 w-4 shrink-0 rounded-full border-4 border-[#f7f0e6] ${entry.markerClass}`}
                    />
                  ) : null}

                  <div
                    className={`max-w-[90%] rounded-[1.6rem] border px-5 py-4 shadow-[0_18px_40px_rgba(25,25,25,0.06)] sm:max-w-[78%] ${
                      isSystem
                        ? "border-zinc-900/10 bg-white/70"
                        : isSummaryPlaceholder
                          ? "border-violet-200 bg-violet-50/85"
                          : isUser
                            ? "border-zinc-900/10 bg-zinc-950 text-white"
                            : ROLE_STYLES[entry.id as SpeakerRole]?.bubble ??
                              "border-white/60 bg-white/80"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isUser
                            ? "text-white"
                            : isSummaryPlaceholder
                              ? "text-violet-950"
                              : entry.accentClass
                        }`}
                      >
                        {entry.title}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${
                          isUser
                            ? "border-white/20 bg-white/10 text-white/80"
                            : isSummaryPlaceholder
                              ? "border-violet-200 bg-white/60 text-violet-700"
                              : "border-zinc-900/10 bg-white/75 text-zinc-500"
                        }`}
                      >
                        {entry.label}
                      </span>
                    </div>

                    <p
                      className={`mt-3 rich-text text-sm ${
                        isUser ? "text-white/92" : "text-zinc-700"
                      }`}
                    >
                      {entry.messageType === "synthesis" && hasSynthesis ? null : entry.body}
                    </p>

                    {entry.messageType === "synthesis" && hasSynthesis ? (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl border border-violet-200 bg-white/75 px-4 py-3">
                          <div className="text-xs font-mono uppercase tracking-[0.18em] text-violet-500">
                            synthesis note
                          </div>
                          <p className="mt-2 text-sm leading-7 text-zinc-700">
                            ユーザーの明示指示を受けて、ここまでの議論を整理した結果です。
                          </p>
                        </div>

                        <div className="grid gap-3">
                          {synthesisSections.map((section) => (
                            <section
                              key={section.title}
                              className={`rounded-2xl border px-4 py-3 ${section.tone}`}
                            >
                              <div className="text-xs font-mono uppercase tracking-[0.18em] text-zinc-500">
                                {section.title}
                              </div>
                              {section.items ? (
                                <ul className="mt-2 space-y-2 text-sm leading-7 text-zinc-700">
                                  {section.items.map((item) => (
                                    <li key={item} className="flex gap-3">
                                      <span className="mt-2 h-2 w-2 rounded-full bg-zinc-500/60" />
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-sm leading-7 text-zinc-700">
                                  {section.body}
                                </p>
                              )}
                            </section>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {entry.meta ? (
                      <div
                        className={`mt-4 text-[11px] font-mono uppercase tracking-[0.18em] ${
                          isUser ? "text-white/60" : "text-zinc-400"
                        }`}
                      >
                        {entry.meta}
                      </div>
                    ) : null}
                  </div>

                  {isUser ? (
                    <div className="relative z-10 mt-3 h-4 w-4 shrink-0 rounded-full border-4 border-[#f7f0e6] bg-zinc-950" />
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="glass-panel rounded-[2rem] p-5 sm:p-6 xl:sticky xl:top-8 xl:self-start">
        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <p className="section-title">Control Panel</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
                会話コントロール
              </h2>
              <p className="mt-2 text-sm leading-7 text-zinc-600">
                右パネルは操作と状態確認の置き場です。今回のPRでは要約値や状態値はプレースホルダー表示です。
              </p>
            </div>

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
              <div className="mt-2 grid gap-2">
                {MODE_OPTIONS.map((option) => {
                  const active = option.value === mode;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setMode(option.value);
                        setConversationState(getInitialConversationState(option.value));
                        setError(null);
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-zinc-950 bg-zinc-950 text-white shadow-sm"
                          : "border-zinc-900/10 bg-white text-zinc-600 hover:border-zinc-900/20 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold">{option.label}</div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${
                            active
                              ? "border-white/20 bg-white/10 text-white/80"
                              : option.panelTone
                          }`}
                        >
                          {buildConversationStateSnapshot(
                            option.value,
                            getInitialConversationState(option.value),
                          ).label}
                        </span>
                      </div>
                      <div
                        className={`mt-1 text-xs leading-5 ${
                          active ? "text-white/75" : ""
                        }`}
                      >
                        {option.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {mode === "debate" ? (
              <div className="rounded-[1.5rem] border border-zinc-900/10 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-zinc-950">
                    ディベート役割設定
                  </h3>
                  <span className="rounded-full border border-zinc-900/10 bg-zinc-100 px-2.5 py-1 text-[11px] font-mono text-zinc-600">
                    validation active
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {(Object.keys(DEBATE_ROLE_LABELS) as DebateRole[]).map((role) => (
                    <label
                      key={role}
                      className="block rounded-2xl border border-zinc-900/10 bg-white px-3 py-3"
                    >
                      <div className="text-xs font-mono uppercase tracking-[0.18em] text-zinc-400">
                        {DEBATE_ROLE_LABELS[role]}
                      </div>
                      <select
                        value={debateAssignments[role]}
                        onChange={(event) => {
                          const nextValue = event.target.value as DebateModel | "";
                          setDebateAssignments((current) => ({
                            ...current,
                            [role]: nextValue,
                          }));
                          setError(null);
                        }}
                        className="mt-2 w-full rounded-xl border border-zinc-900/10 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 outline-none transition focus:border-zinc-900/30 focus:ring-4 focus:ring-zinc-100"
                      >
                        <option value="">未選択</option>
                        {DEBATE_MODELS.map((model) => (
                          <option key={model.value} value={model.value}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="mt-4 space-y-2 text-xs leading-6 text-zinc-500">
                  <p>同じAIを複数役割に割り当てることはできません。</p>
                  <p>3つすべて選ばれていないとディベートは開始できません。</p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleRun}
                disabled={
                  loading ||
                  (mode === "debate" &&
                    (hasIncompleteDebateAssignments ||
                      hasDuplicateDebateAssignments))
                }
                className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {loading ? "会話を更新中..." : "会話を実行 / 統合"}
              </button>
              <p className="text-xs leading-6 text-zinc-500">
                {mode === "debate"
                  ? "ディベートでは3役割のAI割当が必須です。今回は割当UIと重複禁止のみを実装しています。"
                  : "ブレストとディスカッションでは、ユーザーが「統合して」「整理して」といった明示指示を出した時だけ統合結果を表示します。"}
              </p>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <div>
              <p className="section-title">Status & Summary</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
                右サイド要約
              </h2>
              <p className="mt-2 text-sm leading-7 text-zinc-600">
                ここは最終的に合意事項や判定を集約する場所です。今はレイアウトだけ先に用意しています。
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-zinc-900/10 bg-white/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-zinc-950">現在状態</h3>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${activeMode.panelTone}`}
                >
                  {activeState.label}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-zinc-600">
                {activeState.hint}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {stateCandidates.map((candidate) => (
                  <span
                    key={candidate.state}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-mono ${
                      candidate.state === activeState.state
                        ? "border-zinc-900/20 bg-zinc-900 text-white"
                        : "border-zinc-900/10 bg-white text-zinc-500"
                    }`}
                  >
                    {candidate.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-zinc-900/10 bg-white/75 p-4">
              <h3 className="text-sm font-semibold text-zinc-950">{activePlaceholder.heading}</h3>
              {mode === "debate" ? (
                <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-700">
                  {(Object.keys(DEBATE_ROLE_LABELS) as DebateRole[]).map((role) => (
                    <div key={role} className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-900/10 bg-zinc-50 px-3 py-3">
                      <div>
                        <div className="text-xs font-mono uppercase tracking-[0.18em] text-zinc-400">
                          {DEBATE_ROLE_LABELS[role]}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-900">
                          {DEBATE_MODELS.find((item) => item.value === debateAssignments[role])?.label ??
                            "未選択"}
                        </div>
                      </div>
                      <span className="rounded-full border border-zinc-900/10 bg-white px-2.5 py-1 text-[11px] font-mono text-zinc-500">
                        {debateAssignments[role] ? "assigned" : "required"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : hasSynthesis ? (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-orange-200 bg-orange-50/80 px-3 py-3">
                      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-orange-700">
                        agreements
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-orange-950">
                        {result.synthesis.agreements.length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-3 py-3">
                      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-sky-700">
                        open points
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-sky-950">
                        {result.synthesis.openQuestions.length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-50/80 px-3 py-3">
                      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-violet-700">
                        status
                      </div>
                      <div className="mt-2 text-sm font-semibold text-violet-950">
                        ready
                      </div>
                    </div>
                  </div>

                  {synthesisSections.map((section) => (
                    <section
                      key={section.title}
                      className={`rounded-2xl border px-4 py-4 ${section.tone}`}
                    >
                      <div className="text-xs font-mono uppercase tracking-[0.18em] text-zinc-500">
                        {section.title}
                      </div>
                      {section.items ? (
                        <ul className="mt-2 space-y-2 text-sm leading-7 text-zinc-700">
                          {section.items.map((item) => (
                            <li key={item} className="flex gap-3">
                              <span className="mt-2 h-2 w-2 rounded-full bg-zinc-500/60" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm leading-7 text-zinc-700">
                          {section.body}
                        </p>
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                <ul className="mt-3 space-y-3 text-sm leading-7 text-zinc-700">
                  {activePlaceholder.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 rounded-full bg-zinc-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/80 p-4">
              <h3 className="text-sm font-semibold text-zinc-950">
                次の実装でつなぐもの
              </h3>
              <p className="mt-3 text-sm leading-7 text-zinc-600">
                {mode === "debate"
                  ? "次のPRで、審判AIの判定トリガーと判定メッセージ生成を追加します。"
                  : hasSynthesis
                  ? "今回は明示トリガーで統合メッセージを出せるようになりました。次のPRで trigger 判定の精度や会話履歴前提の整理を広げます。"
                  : activePlaceholder.note}
              </p>
              <div className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-400">
                {mode === "debate"
                  ? "debate role assignment ready"
                  : hasSynthesis
                  ? "explicit synthesis completed"
                  : "waiting for explicit synthesis request"}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-zinc-900/10 bg-zinc-950 p-4 text-white">
              <div className="text-xs font-mono uppercase tracking-[0.18em] text-white/55">
                Last mock refresh
              </div>
              <div className="mt-2 text-lg font-semibold">
                {formatTimestamp(result.generatedAt)}
              </div>
              <div className="mt-2 text-sm leading-7 text-white/72">
                現在は mock provider で返した発言をタイムラインに並べています。統合結果はまだ自動確定しません。
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

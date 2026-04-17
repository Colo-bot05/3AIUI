import type { ChangeEvent, RefObject } from "react";

import type { WorkspaceAttachmentItem } from "@/features/attachments/types";
import { MODE_OPTIONS } from "@/features/meeting/mode-config";
import type {
  DebateJudgmentDisplay,
  SynthesisDisplay,
} from "@/features/meeting/presentation";
import {
  buildConversationStateSnapshot,
  getInitialConversationState,
} from "@/features/meeting/state";
import type {
  ConversationStateSnapshot,
  DebateAssignmentLabels,
  DebateModel,
  DebateRole,
  DebateRoleAssignments,
  MeetingMode,
  MeetingRunResult,
} from "@/features/meeting/types";

import { ActionBar } from "./action-bar";
import { AttachmentPanel } from "./attachment-panel";
import {
  DEBATE_MODELS,
  DEBATE_ROLE_LABELS,
  formatTimestamp,
  type ActionLabels,
  type ActivePlaceholder,
  type WorkspaceAction,
} from "./shared";

export interface ControlSidebarProps {
  theme: string;
  onThemeChange: (value: string) => void;
  mode: MeetingMode;
  onModeChange: (mode: MeetingMode) => void;
  attachments: WorkspaceAttachmentItem[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAttachmentSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onAttachmentRemove: (id: string) => void;
  debateAssignments: DebateRoleAssignments;
  onDebateAssignmentChange: (role: DebateRole, value: DebateModel | "") => void;
  loading: boolean;
  actionLabels: ActionLabels;
  canContinueDiscussion: boolean;
  canFinalizeDiscussion: boolean;
  hasIncompleteDebateAssignments: boolean;
  hasDuplicateDebateAssignments: boolean;
  onRun: (action: WorkspaceAction) => void;
  error: string | null;
  activeMode: (typeof MODE_OPTIONS)[number];
  activeState: ConversationStateSnapshot;
  stateCandidates: ConversationStateSnapshot[];
  activePlaceholder: ActivePlaceholder;
  hasSynthesis: boolean;
  hasJudgment: boolean;
  synthesisDisplay: SynthesisDisplay;
  debateJudgmentDisplay: DebateJudgmentDisplay | null;
  debateAssignmentLabels: DebateAssignmentLabels;
  result: MeetingRunResult;
  onOpenPromptSettings: () => void;
}

export function ControlSidebar({
  theme,
  onThemeChange,
  mode,
  onModeChange,
  attachments,
  fileInputRef,
  onAttachmentSelect,
  onAttachmentRemove,
  debateAssignments,
  onDebateAssignmentChange,
  loading,
  actionLabels,
  canContinueDiscussion,
  canFinalizeDiscussion,
  hasIncompleteDebateAssignments,
  hasDuplicateDebateAssignments,
  onRun,
  error,
  activeMode,
  activeState,
  stateCandidates,
  activePlaceholder,
  hasSynthesis,
  hasJudgment,
  synthesisDisplay,
  debateJudgmentDisplay,
  debateAssignmentLabels,
  result,
  onOpenPromptSettings,
}: ControlSidebarProps) {
  return (
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
              onChange={(event) => onThemeChange(event.target.value)}
              rows={4}
              className="mt-2 w-full resize-none rounded-2xl border border-zinc-900/10 bg-white px-4 py-3 text-sm leading-7 text-zinc-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              placeholder="議論したいテーマを入力"
            />
          </div>

          <AttachmentPanel
            attachments={attachments}
            fileInputRef={fileInputRef}
            onSelect={onAttachmentSelect}
            onRemove={onAttachmentRemove}
          />

          <div>
            <p className="section-title">Mode</p>
            <div className="mt-2 grid gap-2">
              {MODE_OPTIONS.map((option) => {
                const active = option.value === mode;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onModeChange(option.value)}
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

          <div className="rounded-[1.5rem] border border-zinc-900/10 bg-white/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-title">Prompt Settings</p>
                <h3 className="mt-2 text-sm font-semibold text-zinc-950">
                  役割ごとのプロンプト
                </h3>
              </div>
              <button
                type="button"
                onClick={onOpenPromptSettings}
                className="rounded-full border border-zinc-900/10 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                編集
              </button>
            </div>
            <p className="mt-3 text-xs leading-6 text-zinc-500">
              3 役割の system prompt を編集できます。保存した内容は以降のすべての会議実行に毎回反映されます（sessionStorage に保存）。
            </p>
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
                        onDebateAssignmentChange(role, nextValue);
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

          <ActionBar
            mode={mode}
            loading={loading}
            actionLabels={actionLabels}
            canContinueDiscussion={canContinueDiscussion}
            canFinalizeDiscussion={canFinalizeDiscussion}
            hasIncompleteDebateAssignments={hasIncompleteDebateAssignments}
            hasDuplicateDebateAssignments={hasDuplicateDebateAssignments}
            onRun={onRun}
          />

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
            {mode === "debate" && hasJudgment && debateJudgmentDisplay ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-3">
                    <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-emerald-700">
                      judgment
                    </div>
                    <div className="mt-2 text-sm font-semibold text-emerald-950">
                      ready
                    </div>
                  </div>
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/80 px-3 py-3">
                    <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-orange-700">
                      pro
                    </div>
                    <div className="mt-2 text-sm font-semibold text-orange-950">
                      {debateAssignmentLabels.pro}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-3 py-3">
                    <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-sky-700">
                      con
                    </div>
                    <div className="mt-2 text-sm font-semibold text-sky-950">
                      {debateAssignmentLabels.con}
                    </div>
                  </div>
                </div>

                {debateJudgmentDisplay.sections.map((section) => (
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
            ) : mode === "debate" ? (
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

                {synthesisDisplay.sections.map((section) => (
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
                ? hasJudgment
                  ? "今回はユーザーの明示指示で判定結果を表示できるようになりました。次のPRでは debate の会話段階をさらに細かく分けます。"
                  : "ユーザーが「判定して」「結論を出して」と指示した時だけ判定結果を表示する前提です。"
                : hasSynthesis
                ? "今回は明示トリガーで統合メッセージを出せるようになりました。次のPRで trigger 判定の精度や会話履歴前提の整理を広げます。"
                : activePlaceholder.note}
            </p>
            <div className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-400">
              {mode === "debate"
                ? hasJudgment
                  ? "explicit judgment completed"
                  : "waiting for explicit judgment request"
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
  );
}

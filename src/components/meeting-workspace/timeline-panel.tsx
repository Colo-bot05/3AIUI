import type {
  DebateJudgmentDisplay,
  SynthesisDisplay,
} from "@/features/meeting/presentation";
import type { MODE_OPTIONS } from "@/features/meeting/mode-config";
import type {
  ConversationStateSnapshot,
  SpeakerRole,
} from "@/features/meeting/types";

import { ROLE_STYLES, type TimelineEntry } from "./shared";

export interface TimelinePanelProps {
  activeMode: (typeof MODE_OPTIONS)[number];
  activeState: ConversationStateSnapshot;
  timelineEntries: TimelineEntry[];
  hasSynthesis: boolean;
  hasJudgment: boolean;
  synthesisDisplay: SynthesisDisplay | null;
  debateJudgmentDisplay: DebateJudgmentDisplay | null;
  nextSpeakerLabel: string | null;
}

export function TimelinePanel({
  activeMode,
  activeState,
  timelineEntries,
  hasSynthesis,
  hasJudgment,
  synthesisDisplay,
  debateJudgmentDisplay,
  nextSpeakerLabel,
}: TimelinePanelProps) {
  return (
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

                  {(entry.messageType === "synthesis" && hasSynthesis) ||
                  (entry.messageType === "debate_judgment" && hasJudgment) ? (
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl border border-violet-200 bg-white/75 px-4 py-3">
                        <div className="text-xs font-mono uppercase tracking-[0.18em] text-violet-500">
                          {entry.messageType === "synthesis"
                            ? "synthesis note"
                            : "judgment note"}
                        </div>
                        <p className="mt-2 text-sm leading-7 text-zinc-700">
                          {entry.messageType === "synthesis"
                            ? "ユーザーの明示指示を受けて、ここまでの議論を整理した結果です。"
                            : "ユーザーの明示指示を受けて、ここまでのディベートを審判観点で整理した結果です。"}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        {(entry.messageType === "synthesis"
                          ? synthesisDisplay?.sections ?? []
                          : debateJudgmentDisplay?.sections ?? []
                        ).map((section) => (
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

          {nextSpeakerLabel ? (
            <div className="flex items-center gap-3 pl-10">
              <span className="rounded-full border border-zinc-900/10 bg-white/80 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                次: {nextSpeakerLabel}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

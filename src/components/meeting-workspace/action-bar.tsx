import type { MeetingMode } from "@/features/meeting/types";

import type { ActionLabels, WorkspaceAction } from "./shared";

export interface ActionBarProps {
  mode: MeetingMode;
  loading: boolean;
  actionLabels: ActionLabels;
  canContinueDiscussion: boolean;
  canFinalizeDiscussion: boolean;
  hasIncompleteDebateAssignments: boolean;
  hasDuplicateDebateAssignments: boolean;
  onRun: (action: WorkspaceAction) => void;
}

export function ActionBar({
  mode,
  loading,
  actionLabels,
  canContinueDiscussion,
  canFinalizeDiscussion,
  hasIncompleteDebateAssignments,
  hasDuplicateDebateAssignments,
  onRun,
}: ActionBarProps) {
  return (
    <div className="space-y-3 rounded-[1.5rem] border border-zinc-900/10 bg-zinc-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-950">アクション</h3>
        <span className="rounded-full border border-zinc-900/10 bg-white px-2.5 py-1 text-[11px] font-mono text-zinc-500">
          continue / finalize
        </span>
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => onRun("continue")}
          disabled={!canContinueDiscussion}
          className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {loading ? "会話を更新中..." : actionLabels.continue}
        </button>

        <div className="rounded-2xl border border-violet-200 bg-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.18em] text-violet-500">
                finalize
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-950">
                {actionLabels.finalize}
              </div>
            </div>
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-mono text-violet-700">
              end action
            </span>
          </div>
          <p className="mt-2 text-xs leading-6 text-zinc-600">
            {actionLabels.finalizeNote}
          </p>
          <button
            type="button"
            onClick={() => onRun("finalize")}
            disabled={!canFinalizeDiscussion}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-violet-300 bg-violet-50 px-5 py-3 text-sm font-semibold text-violet-900 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
          >
            {loading ? "会話を更新中..." : actionLabels.finalize}
          </button>
        </div>
      </div>

      <p className="text-xs leading-6 text-zinc-500">
        {mode === "debate"
          ? hasIncompleteDebateAssignments || hasDuplicateDebateAssignments
            ? "ディベートでは3役割のAI割当が揃うまで、継続も判定も実行できません。"
            : actionLabels.helper
          : canFinalizeDiscussion
            ? actionLabels.helper
            : "統合は、先にこのモードで会話を生成してから実行できます。"}
      </p>
    </div>
  );
}

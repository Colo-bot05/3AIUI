"use client";

import { useState } from "react";

import { DEFAULT_ROLE_PROMPTS } from "@/features/meeting/default-prompts";
import type { RolePrompts } from "@/features/meeting/types";

export interface PromptSettingsPanelProps {
  onClose: () => void;
  currentPrompts: RolePrompts;
  onSave: (prompts: RolePrompts) => void;
}

const ROLE_ENTRIES: Array<{
  key: keyof RolePrompts;
  label: string;
  hint: string;
}> = [
  {
    key: "vision",
    label: "構想AI (vision)",
    hint: "可能性を押し広げる提案役の人格・指示を書きます。",
  },
  {
    key: "reality",
    label: "現実AI (reality)",
    hint: "実装・運用の現実性を見る実務役の人格・指示を書きます。",
  },
  {
    key: "audit",
    label: "監査AI (audit)",
    hint: "抜け漏れやリスクを止める監査役の人格・指示を書きます。",
  },
];

export function PromptSettingsPanel({
  onClose,
  currentPrompts,
  onSave,
}: PromptSettingsPanelProps) {
  const [draft, setDraft] = useState<RolePrompts>(currentPrompts);

  function updateField(key: keyof RolePrompts, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    onSave(draft);
    onClose();
  }

  function handleReset() {
    setDraft(DEFAULT_ROLE_PROMPTS);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-zinc-900/10 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Prompt Settings"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="section-title">Prompt Settings</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-zinc-950">
              役割ごとのプロンプト
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              3 役割それぞれの system prompt を書き換えられます。保存した内容は次回の会議実行から反映され、進行中の会議には影響しません。保存先は sessionStorage のみで、ページ再読み込みで消えます。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-900/10 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-900/20 hover:bg-zinc-50"
          >
            閉じる
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {ROLE_ENTRIES.map((entry) => (
            <div key={entry.key}>
              <label
                htmlFor={`prompt-${entry.key}`}
                className="text-sm font-semibold text-zinc-950"
              >
                {entry.label}
              </label>
              <p className="mt-1 text-xs leading-6 text-zinc-500">{entry.hint}</p>
              <textarea
                id={`prompt-${entry.key}`}
                value={draft[entry.key]}
                onChange={(event) => updateField(entry.key, event.target.value)}
                rows={4}
                className="mt-2 w-full resize-y rounded-2xl border border-zinc-900/10 bg-white px-4 py-3 text-sm leading-7 text-zinc-800 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-zinc-900/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-900/20 hover:bg-zinc-50"
          >
            デフォルトに戻す
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-900/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-900/20 hover:bg-zinc-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-zinc-950 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

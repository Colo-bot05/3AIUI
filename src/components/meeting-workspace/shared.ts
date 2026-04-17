import type { ParsedAttachmentResponse, WorkspaceAttachmentItem } from "@/features/attachments/types";
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  SUPPORTED_ATTACHMENT_EXTENSIONS,
} from "@/features/attachments/types";
import type { MODE_OPTIONS } from "@/features/meeting/mode-config";
import type {
  DebateJudgmentDisplay,
  SynthesisDisplay,
} from "@/features/meeting/presentation";
import type {
  ConversationStateSnapshot,
  DebateModel,
  DebateRole,
  DebateRoleAssignments,
  MeetingMessageType,
  MeetingMode,
  MeetingRunResult,
} from "@/features/meeting/types";
import type {
  SessionAttachmentContext,
  SessionAttachmentReference,
} from "@/features/session/types";

export const DEFAULT_THEME =
  "商用LLMを使って、ローカルLLM構築の設計議論を加速するMVPを考えたい";

export const INITIAL_RESULT: MeetingRunResult = {
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

export const ROLE_STYLES = {
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

export const PANEL_PLACEHOLDERS = {
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

export const DEBATE_MODELS: Array<{ value: DebateModel; label: string }> = [
  { value: "gpt", label: "GPT" },
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
];

export const DEBATE_ROLE_LABELS: Record<DebateRole, string> = {
  pro: "賛成側AI",
  con: "反対側AI",
  judge: "審判AI",
};

export const INITIAL_DEBATE_ASSIGNMENTS: DebateRoleAssignments = {
  pro: "gpt",
  con: "gemini",
  judge: "claude",
};

export type TimelineEntry = {
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

export type WorkspaceAction = "continue" | "finalize";

export interface ActionLabels {
  continue: string;
  finalize: string;
  helper: string;
  finalizeNote: string;
}

export type ActivePlaceholder =
  (typeof PANEL_PLACEHOLDERS)[keyof typeof PANEL_PLACEHOLDERS];

export function formatTimestamp(isoTimestamp: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(isoTimestamp));
}

export function pickModelLabel(value: DebateModel | "") {
  return DEBATE_MODELS.find((item) => item.value === value)?.label ?? "未選択";
}

export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function hasReadableAttachmentPreview(excerpt: string) {
  return excerpt.trim().length >= 8;
}

export function isHardAttachmentError(error?: string) {
  if (!error) {
    return false;
  }

  return (
    error.includes("対応していないファイル形式") ||
    error.includes("ファイルサイズが上限を超えています")
  );
}

export function buildSessionAttachmentReference(
  attachment: WorkspaceAttachmentItem,
): SessionAttachmentReference {
  return {
    id: attachment.id,
    filename: attachment.filename,
    extension: attachment.extension,
    mimeType: attachment.mimeType,
    size: attachment.size,
    status: attachment.status,
  };
}

export function buildSessionAttachmentContext(
  attachments: WorkspaceAttachmentItem[],
): SessionAttachmentContext | undefined {
  if (attachments.length === 0) {
    return undefined;
  }

  const references = attachments.map(buildSessionAttachmentReference);

  return {
    attachmentIds: references.map((attachment) => attachment.id),
    attachmentCount: references.length,
    attachmentNames: references.map((attachment) => attachment.filename),
    attachments: references,
  };
}

export function buildAttachmentErrorItem(
  file: Pick<File, "name" | "type" | "size">,
  extension: WorkspaceAttachmentItem["extension"],
  error: string,
): WorkspaceAttachmentItem {
  return {
    id: `attachment-error-${Math.random().toString(36).slice(2, 10)}`,
    filename: file.name,
    extension,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    extractedText: "",
    excerpt: "",
    status: "error",
    error,
  };
}

export async function parseSelectedAttachmentFile(
  file: File,
): Promise<WorkspaceAttachmentItem> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (
    !SUPPORTED_ATTACHMENT_EXTENSIONS.includes(
      extension as (typeof SUPPORTED_ATTACHMENT_EXTENSIONS)[number],
    )
  ) {
    return buildAttachmentErrorItem(file, "txt", "対応していないファイル形式です。");
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return buildAttachmentErrorItem(
      file,
      extension as WorkspaceAttachmentItem["extension"],
      "ファイルサイズが上限を超えています。",
    );
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/attachments/parse", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as ParsedAttachmentResponse;

    if (!response.ok || !payload.attachment) {
      return buildAttachmentErrorItem(
        file,
        extension as WorkspaceAttachmentItem["extension"],
        payload.error?.message ?? "ファイル解析に失敗しました。",
      );
    }

    return {
      ...payload.attachment,
      status: "ready",
    };
  } catch {
    return buildAttachmentErrorItem(
      file,
      extension as WorkspaceAttachmentItem["extension"],
      "ファイル解析に失敗しました。",
    );
  }
}

export function buildFallbackAttachmentErrorItem(
  file: File | undefined,
): WorkspaceAttachmentItem {
  const extension = file?.name.split(".").pop()?.toLowerCase() ?? "";
  return buildAttachmentErrorItem(
    {
      name: file?.name ?? "unknown",
      type: file?.type || "application/octet-stream",
      size: file?.size ?? 0,
    },
    SUPPORTED_ATTACHMENT_EXTENSIONS.includes(
      extension as (typeof SUPPORTED_ATTACHMENT_EXTENSIONS)[number],
    )
      ? (extension as WorkspaceAttachmentItem["extension"])
      : "txt",
    "ファイル解析に失敗しました。",
  );
}

export function pickActionLabels(mode: MeetingMode): ActionLabels {
  return mode === "debate"
    ? {
        continue: "議論を続ける",
        finalize: "判定する",
        helper:
          "議論の継続と判定は別操作です。判定はユーザーが明示的に締めたい時だけ実行します。",
        finalizeNote: "ここまでの主張を審判観点で整理して結論を返します。",
      }
    : {
        continue: "会話を続ける",
        finalize: "統合する",
        helper:
          "会話の継続と統合は別操作です。統合はここまでの内容を締める時だけ使います。",
        finalizeNote: "ここまでの会話を整理して要約・推奨案を返します。",
      };
}

export interface BuildTimelineEntriesInput {
  mode: MeetingMode;
  submittedPrompt: string;
  activeMode: (typeof MODE_OPTIONS)[number];
  activeState: ConversationStateSnapshot;
  debateAssignmentSummary: string;
  attachmentSummary: string;
  result: MeetingRunResult;
  hasSynthesis: boolean;
  hasJudgment: boolean;
  synthesisDisplay: SynthesisDisplay;
  debateJudgmentDisplay: DebateJudgmentDisplay | null;
}

export function buildTimelineEntries({
  mode,
  submittedPrompt,
  activeMode,
  activeState,
  debateAssignmentSummary,
  attachmentSummary,
  result,
  hasSynthesis,
  hasJudgment,
  synthesisDisplay,
  debateJudgmentDisplay,
}: BuildTimelineEntriesInput): TimelineEntry[] {
  return [
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
          ? `${submittedPrompt}\n\n現在の割当\n${debateAssignmentSummary}${
              attachmentSummary ? `\n\n前提資料\n${attachmentSummary}` : ""
            }`
          : `${submittedPrompt}${
              attachmentSummary ? `\n\n前提資料\n${attachmentSummary}` : ""
            }`,
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
      ? hasJudgment && debateJudgmentDisplay
        ? [
            {
              id: "debate-judgment",
              messageType: "debate_judgment" as const,
              title: "判定結果",
              label: "ユーザー明示指示で生成",
              accentClass: "text-violet-900",
              markerClass: "bg-violet-500",
              body: debateJudgmentDisplay.body,
              meta: "debate_judgment / explicit trigger",
            },
          ]
        : [
            {
              id: "synthesis-waiting",
              messageType: "debate_judgment" as const,
              title: "判定待ち",
              label: "ユーザーが判定指示を出すまで保留",
              accentClass: "text-violet-900",
              markerClass: "bg-violet-500",
              body: "この位置に最終判定メッセージが入る想定です。ユーザーが明示的に判定を依頼するまで、審判AIは結論を固定しません。",
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
              body: synthesisDisplay.body,
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
}

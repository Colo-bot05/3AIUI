import type {
  ConversationState,
  ConversationStateSnapshot,
  MeetingMode,
} from "./types";

const INITIAL_STATE_BY_MODE: Record<MeetingMode, ConversationState> = {
  brainstorm: "brainstorming",
  design_review: "discussing",
  debate: "debating",
};

const STATE_LABELS: Record<ConversationState, string> = {
  brainstorming: "発散中",
  discussing: "議論中",
  debating: "主張中",
  awaiting_synthesis: "統合待ち",
  awaiting_judgment: "判定待ち",
  synthesized: "統合済み",
  judged: "判定済み",
};

const STATE_HINTS: Record<ConversationState, string> = {
  brainstorming: "アイデアを広げる途中で、まだ結論を固定しない状態です。",
  discussing: "論点を深掘りしている途中で、まだ合意を確定しない状態です。",
  debating: "賛成・反対の主張を出し始める前提の状態です。",
  awaiting_synthesis: "ユーザーの整理指示を受けて、統合メッセージ待ちに入る想定の状態です。",
  awaiting_judgment: "ユーザーの判定指示を受けて、審判AIが整理する想定の状態です。",
  synthesized: "統合メッセージを出した後の状態です。",
  judged: "判定メッセージを出した後の状態です。",
};

export function getInitialConversationState(mode: MeetingMode): ConversationState {
  return INITIAL_STATE_BY_MODE[mode];
}

export function getAllowedStatesForMode(mode: MeetingMode): ConversationState[] {
  if (mode === "brainstorm") {
    return ["brainstorming", "awaiting_synthesis", "synthesized"];
  }

  if (mode === "design_review") {
    return ["discussing", "awaiting_synthesis", "synthesized"];
  }

  return ["debating", "awaiting_judgment", "judged"];
}

export function buildConversationStateSnapshot(
  mode: MeetingMode,
  state: ConversationState,
): ConversationStateSnapshot {
  return {
    mode,
    state,
    label: STATE_LABELS[state],
    hint: STATE_HINTS[state],
  };
}

const SYNTHESIS_TRIGGERS: Record<"brainstorm" | "design_review", string[]> = {
  brainstorm: ["統合して", "ここまでで整理して", "案をまとめて", "方向性を出して"],
  design_review: ["統合して", "整理して", "合意点を出して", "論点をまとめて"],
};

export function isExplicitSynthesisTrigger(
  input: string,
  mode: MeetingMode,
): boolean {
  if (mode === "debate") {
    return false;
  }

  const normalizedInput = input.trim();
  return SYNTHESIS_TRIGGERS[mode].some((trigger) =>
    normalizedInput.includes(trigger),
  );
}

const JUDGMENT_TRIGGERS = [
  "判定して",
  "統合して",
  "結論を出して",
  "どっちが妥当か整理して",
];

export function isExplicitJudgmentTrigger(
  input: string,
  mode: MeetingMode,
): boolean {
  if (mode !== "debate") {
    return false;
  }

  const normalizedInput = input.trim();
  return JUDGMENT_TRIGGERS.some((trigger) =>
    normalizedInput.includes(trigger),
  );
}

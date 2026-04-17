import Anthropic from "@anthropic-ai/sdk";

import { DEFAULT_ROLE_PROMPTS } from "@/features/meeting/default-prompts";
import type {
  ContinueActionInput,
  ContinueActionResult,
  JudgeActionInput,
  JudgeActionResult,
  MeetingActionInput,
  MeetingActionResult,
  MeetingAttachment,
  MeetingMode,
  RoleResponse,
  SpeakerRole,
  SynthesizeActionInput,
  SynthesizeActionResult,
} from "@/features/meeting/types";
import type { MeetingProviderAdapter } from "@/lib/orchestrator/provider-adapter";

const ROLE_META: Record<SpeakerRole, { label: string; viewpoint: string; emphasis: string }> = {
  vision: {
    label: "構想AI",
    viewpoint: "可能性を押し広げる提案役",
    emphasis: "新しい価値の打ち出し",
  },
  reality: {
    label: "現実AI",
    viewpoint: "実装・運用の現実性を見る実務役",
    emphasis: "実装順序とコスト感",
  },
  audit: {
    label: "監査AI",
    viewpoint: "抜け漏れやリスクを止める監査役",
    emphasis: "失敗条件の先回り",
  },
};

const MODE_GUIDANCE: Record<MeetingMode, string> = {
  brainstorm:
    "発散モード。結論を固定せず、打席を増やして候補を広げる前提で案を出す。",
  design_review:
    "ディスカッションモード。責務分離と将来差し替えやすさを軸に、論点を順番に深掘りする。",
  debate:
    "ディベートモード。構想側・現実側が対立視点で論じ、audit が判定を担当する。",
};

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;
const MAX_ATTACHMENT_CHARS_PER_FILE = 4000;

const turnTool: Anthropic.Tool = {
  name: "produce_turn",
  description:
    "次の発言者として、1 人分の発言 content を 1 本だけ返す。必ずこのツールで回答すること。",
  input_schema: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description:
          "発言本文。日本語で 2〜3 段落。段落区切りは \\n\\n。前の発言者の主張を踏まえて自分の立場から話すこと。",
      },
    },
    required: ["content"],
  },
};

const synthesisTool: Anthropic.Tool = {
  name: "produce_synthesis",
  description: "audit 役として会議履歴を統合する。必ずこのツールで回答すること。",
  input_schema: {
    type: "object",
    properties: {
      agreements: {
        type: "array",
        items: { type: "string" },
        description: "合意事項を3〜5項目。",
      },
      openQuestions: {
        type: "array",
        items: { type: "string" },
        description: "未決事項・確認が必要な論点を2〜4項目。",
      },
      recommendation: {
        type: "string",
        description: "推奨案を1パラグラフで。",
      },
    },
    required: ["agreements", "openQuestions", "recommendation"],
  },
};

const judgmentTool: Anthropic.Tool = {
  name: "produce_judgment",
  description: "audit 役としてディベートを判定する。必ずこのツールで回答すること。",
  input_schema: {
    type: "object",
    properties: {
      verdictHeadline: { type: "string" },
      verdictDetail: {
        type: "string",
        description:
          "判定詳細。審判ラベルは含めず、「現時点では〜が妥当です。」の形で中立に。",
      },
      reasoning: { type: "string" },
      proLeadPoint: {
        type: "string",
        description: "構想側（賛成側）の要点の1行要約。ラベルは含めない。",
      },
      conLeadPoint: {
        type: "string",
        description: "現実側（反対側）の要点の1行要約。ラベルは含めない。",
      },
      openPoints: {
        type: "array",
        items: { type: "string" },
      },
      nextSteps: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "verdictHeadline",
      "verdictDetail",
      "reasoning",
      "proLeadPoint",
      "conLeadPoint",
      "openPoints",
      "nextSteps",
    ],
  },
};

function createClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Set it in the environment (see .env.example) or switch MEETING_PROVIDER to 'mock'.",
    );
  }
  return new Anthropic({ apiKey });
}

function buildAttachmentSection(attachments: MeetingAttachment[]): string {
  if (attachments.length === 0) {
    return "";
  }
  const blocks = attachments.map((attachment, index) => {
    const text = attachment.extractedText.slice(0, MAX_ATTACHMENT_CHARS_PER_FILE);
    const truncatedNote =
      attachment.extractedText.length > MAX_ATTACHMENT_CHARS_PER_FILE
        ? "\n\n[この資料の本文は上限で切り詰められています]"
        : "";
    return `### 資料 ${index + 1}: ${attachment.filename} (${attachment.extension})\n\n${text}${truncatedNote}`;
  });
  return ["", "前提資料:", "", ...blocks].join("\n");
}

function buildHistoryText(history: RoleResponse[]): string {
  if (history.length === 0) {
    return "（まだ発言なし）";
  }
  return history
    .map(
      (entry, index) =>
        `ターン${index + 1}・${ROLE_META[entry.role].label} (${entry.role}):\n${entry.content}`,
    )
    .join("\n\n---\n\n");
}

function extractToolInput<T>(
  message: Anthropic.Message,
  toolName: string,
): T {
  const toolBlock = message.content.find(
    (block) => block.type === "tool_use" && block.name === toolName,
  );
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(
      `Anthropic response missing expected tool_use block for ${toolName}.`,
    );
  }
  return toolBlock.input as T;
}

async function produceContinueTurn(
  input: ContinueActionInput,
): Promise<ContinueActionResult> {
  const client = createClient();
  const normalizedTheme =
    input.theme.trim() || "ローカルLLM構築を加速する3AI会議UI";
  const effectiveRolePrompts = input.rolePrompts ?? DEFAULT_ROLE_PROMPTS;
  const speakerMeta = ROLE_META[input.nextSpeaker];
  const speakerPrompt = effectiveRolePrompts[input.nextSpeaker];
  const hasAttachments = (input.attachments ?? []).length > 0;

  const system = [
    `あなたは 3 人の AI が同席する会議の ${input.nextSpeaker} (${speakerMeta.label}) として発言します。`,
    `あなたの人格: ${speakerPrompt}`,
    `モード: ${input.mode} — ${MODE_GUIDANCE[input.mode]}`,
    "",
    "このターンでは自分 (この役) の発言だけを返してください。他の役の発言を代わりに書いてはいけません。",
    "必ず produce_turn ツールで発言内容を返すこと。平文で返答してはいけません。",
    "これまでの会話履歴を踏まえ、自分の立場・視点から 2〜3 段落で話すこと。",
    hasAttachments
      ? "前提資料（添付ファイル）が提供されている場合、その具体的な記述・数値・用語を少なくとも 1 箇所は引用または参照して発言に活かすこと。資料に書かれていない推測は避け、書かれている内容を起点に話すこと。"
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const user = [
    `テーマ: ${normalizedTheme}`,
    buildAttachmentSection(input.attachments ?? []),
    "",
    "これまでの会話:",
    buildHistoryText(input.history),
    "",
    `あなたは次の発言者 (${input.nextSpeaker} / ${speakerMeta.label}) です。あなた自身の発言だけを書いてください。`,
    hasAttachments
      ? "上に列挙された前提資料を必ず参照し、その内容に触れる形で発言を組み立ててください。"
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    tools: [turnTool],
    tool_choice: { type: "tool", name: "produce_turn" },
    messages: [{ role: "user", content: user }],
  });

  const { content } = extractToolInput<{ content: string }>(message, "produce_turn");

  return {
    action: "continue",
    turn: {
      role: input.nextSpeaker,
      label: speakerMeta.label,
      viewpoint: speakerMeta.viewpoint,
      emphasis: speakerMeta.emphasis,
      content,
    },
  };
}

async function produceSynthesis(
  input: SynthesizeActionInput,
): Promise<SynthesizeActionResult> {
  const client = createClient();
  const normalizedTheme =
    input.theme.trim() || "ローカルLLM構築を加速する3AI会議UI";
  const effectiveRolePrompts = input.rolePrompts ?? DEFAULT_ROLE_PROMPTS;
  const auditMeta = ROLE_META.audit;
  const hasAttachments = (input.attachments ?? []).length > 0;

  const system = [
    `あなたは audit (${auditMeta.label}) として会議履歴を統合・要約します。`,
    `あなたの人格: ${effectiveRolePrompts.audit}`,
    `モード: ${input.mode} — ${MODE_GUIDANCE[input.mode]}`,
    "",
    "必ず produce_synthesis ツールで構造化した結果を返すこと。平文で返答してはいけません。",
    hasAttachments
      ? "前提資料（添付ファイル）がある場合、その記述を根拠として合意事項・未決事項・推奨案に織り込むこと。"
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const user = [
    `テーマ: ${normalizedTheme}`,
    buildAttachmentSection(input.attachments ?? []),
    "",
    "これまでの会話:",
    buildHistoryText(input.history),
    "",
    "これまでの 2 役の発言を読み、合意事項・未決事項・推奨案を整理してください。",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    tools: [synthesisTool],
    tool_choice: { type: "tool", name: "produce_synthesis" },
    messages: [{ role: "user", content: user }],
  });

  const synthesis = extractToolInput<SynthesizeActionResult["synthesis"]>(
    message,
    "produce_synthesis",
  );

  return { action: "synthesize", synthesis };
}

async function produceJudgment(
  input: JudgeActionInput,
): Promise<JudgeActionResult> {
  const client = createClient();
  const normalizedTheme =
    input.theme.trim() || "ローカルLLM構築を加速する3AI会議UI";
  const effectiveRolePrompts = input.rolePrompts ?? DEFAULT_ROLE_PROMPTS;
  const auditMeta = ROLE_META.audit;
  const labels = input.debateAssignmentLabels;

  const labelLines = labels
    ? [
        "役割割当 (参考):",
        `- 構想側 (pro): ${labels.pro}`,
        `- 現実側 (con): ${labels.con}`,
        `- 審判 (judge): ${labels.judge}`,
      ]
    : [];

  const hasAttachments = (input.attachments ?? []).length > 0;

  const system = [
    `あなたは audit / 審判 (${auditMeta.label}) としてディベートを判定します。`,
    `あなたの人格: ${effectiveRolePrompts.audit}`,
    `モード: ${input.mode} — ${MODE_GUIDANCE[input.mode]}`,
    "",
    "必ず produce_judgment ツールで構造化した判定結果を返すこと。平文で返答してはいけません。",
    "判定詳細には審判ラベルを含めず、「現時点では〜が妥当です。」の中立表現で返すこと。",
    hasAttachments
      ? "前提資料（添付ファイル）がある場合、その記述を判定理由や残論点に織り込むこと。"
      : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const user = [
    `テーマ: ${normalizedTheme}`,
    buildAttachmentSection(input.attachments ?? []),
    "",
    "これまでのディベート:",
    buildHistoryText(input.history),
    "",
    ...labelLines,
    "",
    "構想側 / 現実側の要点を 1 行ずつ要約し、総合判定と理由、残論点、次に確認すべきステップを出してください。",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    tools: [judgmentTool],
    tool_choice: { type: "tool", name: "produce_judgment" },
    messages: [{ role: "user", content: user }],
  });

  const debateJudgment = extractToolInput<JudgeActionResult["debateJudgment"]>(
    message,
    "produce_judgment",
  );

  return { action: "judge", debateJudgment };
}

async function performAction(
  input: MeetingActionInput,
): Promise<MeetingActionResult> {
  switch (input.action) {
    case "continue":
      return produceContinueTurn(input);
    case "synthesize":
      return produceSynthesis(input);
    case "judge":
      return produceJudgment(input);
  }
}

export const anthropicMeetingProvider: MeetingProviderAdapter = {
  name: "anthropic",
  performAction,
};

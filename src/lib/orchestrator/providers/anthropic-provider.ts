import Anthropic from "@anthropic-ai/sdk";

import type {
  DebateJudgmentResult,
  MeetingAttachment,
  MeetingMode,
  MeetingRunResult,
  RoleResponse,
  RunMeetingInput,
  SpeakerRole,
  SynthesisResult,
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
    "ディベートモード。賛否を分けて意思決定の材料を見える化する。最後に審判役が判定を返す。",
};

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 4096;
const MAX_ATTACHMENT_CHARS_PER_FILE = 4000;

const meetingResultTool: Anthropic.Tool = {
  name: "produce_meeting_result",
  description:
    "3人のAI（構想AI / 現実AI / 監査AI）による会議の結果を、構造化した形で返すためのツール。必ずこのツールで回答すること。",
  input_schema: {
    type: "object",
    properties: {
      responses: {
        type: "array",
        description:
          "3人のAIそれぞれの発言。必ず vision / reality / audit の3つを含めること。",
        items: {
          type: "object",
          properties: {
            role: {
              type: "string",
              enum: ["vision", "reality", "audit"],
            },
            content: {
              type: "string",
              description:
                "そのロールの発言本文。日本語で、2〜3段落。段落区切りは \\n\\n。",
            },
          },
          required: ["role", "content"],
        },
      },
      synthesis: {
        type: "object",
        properties: {
          agreements: {
            type: "array",
            items: { type: "string" },
            description: "3人が合意できる前提・事実を3〜5項目。",
          },
          openQuestions: {
            type: "array",
            items: { type: "string" },
            description: "未決事項・確認が必要な論点を2〜4項目。",
          },
          recommendation: {
            type: "string",
            description: "現時点で最も妥当な推奨案を1パラグラフで。",
          },
        },
        required: ["agreements", "openQuestions", "recommendation"],
      },
      debateJudgment: {
        type: "object",
        description:
          "debateモード時のみ出力。それ以外のモードでは省略すること。",
        properties: {
          verdictHeadline: {
            type: "string",
            description: "判定の1行見出し（例: 追加検証付きで賛成側案を前進）",
          },
          verdictDetail: {
            type: "string",
            description:
              "判定の詳細。審判役のラベルは含めず、「現時点では〜が妥当です。」の形で中立的に。",
          },
          reasoning: {
            type: "string",
            description: "判定に至った理由を1パラグラフで。",
          },
          proLeadPoint: {
            type: "string",
            description: "賛成側の主要な主張の1行要約（ラベルは含めない）。",
          },
          conLeadPoint: {
            type: "string",
            description: "反対側の主要な主張の1行要約（ラベルは含めない）。",
          },
          openPoints: {
            type: "array",
            items: { type: "string" },
            description: "残る論点を2〜4項目。",
          },
          nextSteps: {
            type: "array",
            items: { type: "string" },
            description: "次に確認すべきアクションを2〜3項目。",
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
    },
    required: ["responses", "synthesis"],
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

function buildSystemPrompt(mode: MeetingMode): string {
  const lines = [
    "あなたは 3 人の AI が同席する会議の進行役です。",
    "3 人の役割は次のとおり。",
    `- vision (${ROLE_META.vision.label}): ${ROLE_META.vision.viewpoint} / ${ROLE_META.vision.emphasis}`,
    `- reality (${ROLE_META.reality.label}): ${ROLE_META.reality.viewpoint} / ${ROLE_META.reality.emphasis}`,
    `- audit (${ROLE_META.audit.label}): ${ROLE_META.audit.viewpoint} / ${ROLE_META.audit.emphasis}`,
    "",
    `現在のモード: ${mode} — ${MODE_GUIDANCE[mode]}`,
    "",
    "必ず produce_meeting_result ツールを使って構造化された回答を返してください。平文で返答してはいけません。",
    "各ロールの発言は日本語で、具体性を持って書くこと。`content` は段落を \\n\\n で区切ること。",
    mode === "debate"
      ? "debate モードでは debateJudgment も必ず埋めること。"
      : "debate モード以外では debateJudgment を省略すること。",
  ];
  return lines.join("\n");
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

function buildUserPrompt(theme: string, attachments: MeetingAttachment[]): string {
  const attachmentSection = buildAttachmentSection(attachments);
  return [
    `テーマ: ${theme}`,
    attachmentSection,
    "",
    "このテーマについて、3 人の AI それぞれの観点で発言してください。その後、synthesis（合意事項・未決事項・推奨案）を必ずまとめてください。",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

interface ToolInputShape {
  responses: Array<{ role: SpeakerRole; content: string }>;
  synthesis: SynthesisResult;
  debateJudgment?: DebateJudgmentResult;
}

function extractToolInput(response: Anthropic.Message): ToolInputShape {
  const toolBlock = response.content.find((block) => block.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(
      "Anthropic response did not include the expected tool_use block.",
    );
  }
  return toolBlock.input as ToolInputShape;
}

function mapResponses(
  toolResponses: ToolInputShape["responses"],
): RoleResponse[] {
  const byRole = new Map(toolResponses.map((item) => [item.role, item]));
  return (["vision", "reality", "audit"] as SpeakerRole[]).map((role) => {
    const meta = ROLE_META[role];
    const produced = byRole.get(role);
    return {
      role,
      label: meta.label,
      viewpoint: meta.viewpoint,
      emphasis: meta.emphasis,
      content: produced?.content ?? "",
    };
  });
}

async function runAnthropicMeeting({
  theme,
  mode,
  attachments = [],
}: RunMeetingInput): Promise<MeetingRunResult> {
  const client = createClient();
  const normalizedTheme = theme.trim() || "ローカルLLM構築を加速する3AI会議UI";

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: buildSystemPrompt(mode),
    tools: [meetingResultTool],
    tool_choice: { type: "tool", name: "produce_meeting_result" },
    messages: [
      {
        role: "user",
        content: buildUserPrompt(normalizedTheme, attachments),
      },
    ],
  });

  const toolInput = extractToolInput(message);
  const responses = mapResponses(toolInput.responses);

  const result: MeetingRunResult = {
    theme: normalizedTheme,
    mode,
    responses,
    synthesis: toolInput.synthesis,
    generatedAt: new Date().toISOString(),
  };

  if (mode === "debate" && toolInput.debateJudgment) {
    result.debateJudgment = toolInput.debateJudgment;
  }

  return result;
}

export const anthropicMeetingProvider: MeetingProviderAdapter = {
  name: "anthropic",
  runMeeting: runAnthropicMeeting,
};

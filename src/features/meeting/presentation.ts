import type {
  DebateAssignmentLabels,
  DebateJudgmentResult,
  SynthesisResult,
} from "./types";

export interface SummarySection {
  title: string;
  tone: string;
  items?: string[];
  body?: string;
}

export interface SynthesisDisplay {
  body: string;
  sections: SummarySection[];
}

export interface DebateJudgmentDisplay {
  body: string;
  sections: SummarySection[];
}

export function buildSynthesisDisplay(
  synthesis: SynthesisResult,
): SynthesisDisplay {
  return {
    body: [
      "合意事項",
      ...synthesis.agreements.map((item) => `- ${item}`),
      "",
      "未決事項",
      ...synthesis.openQuestions.map((item) => `- ${item}`),
      "",
      "推奨案",
      synthesis.recommendation,
    ].join("\n"),
    sections: [
      {
        title: "合意事項",
        tone: "border-orange-200 bg-orange-50/85",
        items: synthesis.agreements,
      },
      {
        title: "未決事項",
        tone: "border-sky-200 bg-sky-50/85",
        items: synthesis.openQuestions,
      },
      {
        title: "推奨案",
        tone: "border-violet-200 bg-violet-50/90",
        body: synthesis.recommendation,
      },
    ],
  };
}

export function buildDebateJudgmentDisplay(
  judgment: DebateJudgmentResult,
  labels: DebateAssignmentLabels,
): DebateJudgmentDisplay {
  return {
    body: [
      "判定",
      `${labels.judge} の暫定判断: ${judgment.verdictHeadline}`,
      "",
      "次に確認すべきこと",
      ...judgment.nextSteps.map((item) => `- ${item}`),
    ].join("\n"),
    sections: [
      {
        title: "賛成側の要点",
        tone: "border-orange-200 bg-orange-50/85",
        items: [`${labels.pro}: ${judgment.proLeadPoint}`],
      },
      {
        title: "反対側の要点",
        tone: "border-sky-200 bg-sky-50/85",
        items: [`${labels.con}: ${judgment.conLeadPoint}`],
      },
      {
        title: "判定",
        tone: "border-emerald-200 bg-emerald-50/90",
        body: `${labels.judge} の暫定判断として、${judgment.verdictDetail}`,
      },
      {
        title: "判定理由",
        tone: "border-violet-200 bg-violet-50/90",
        body: judgment.reasoning,
      },
      {
        title: "残る論点",
        tone: "border-zinc-200 bg-zinc-50/90",
        items: judgment.openPoints,
      },
    ],
  };
}

import type {
  ContinueActionInput,
  ContinueActionResult,
  JudgeActionInput,
  JudgeActionResult,
  MeetingActionInput,
  MeetingActionResult,
  MeetingMode,
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

const MODE_GUIDANCE: Record<
  MeetingMode,
  { intro: string; agreementsLead: string; recommendationLead: string }
> = {
  brainstorm: {
    intro: "まずは打席数を増やし、あとで絞り込む前提で候補を広げます。",
    agreementsLead: "価値の核として残す候補",
    recommendationLead: "まず試すべき小さな前進",
  },
  design_review: {
    intro: "責務分離と将来差し替えやすさを軸にレビューします。",
    agreementsLead: "設計上、早めに固めるべき前提",
    recommendationLead: "破綻しにくい最小設計",
  },
  debate: {
    intro: "賛否をあえて分けて、意思決定の材料を見える化します。",
    agreementsLead: "立場が違っても共有できる事実",
    recommendationLead: "今の条件で最も妥当な着地点",
  },
};

const TURN_PARAGRAPHS: Record<Exclude<SpeakerRole, "audit">, string[]> = {
  vision: [
    "まず大枠の可能性として、このテーマは 3AI を「比較画面」ではなく「会議室」として見せた時に初めて意味を持ちます。役割が分かれていること自体が価値になります。",
    "次のステップとして、ユーザーが指示を出さない限り結論を固定しない設計が重要です。発散と収束を別操作に分け、ユーザーが主導権を持てる UI が必要です。",
    "さらに発展させると、provider を差し替えても UX が変わらない構造を前提に、将来の商用 / ローカル LLM 両方を見据えて設計できます。",
  ],
  reality: [
    "実装の現実線としては、まずモック orchestrator を API 越しに呼ぶ形で UI と生成ロジックの境界を先に固めるのが安全です。",
    "現実的には、1 ターン = 1 役という構造にしておけば、ターンごとの課金・ストリーミング・ログ保存を後からでも設計しやすくなります。",
    "運用面では、環境変数ベースの provider 切替と、attachment 本文の長さ上限など、壊れやすいところに先にガードを置くのが堅実です。",
  ],
};

function buildMockTurnContent(
  role: Exclude<SpeakerRole, "audit">,
  mode: MeetingMode,
  theme: string,
  turnIndex: number,
): string {
  const modeGuide = MODE_GUIDANCE[mode];
  const meta = ROLE_META[role];
  const paragraphs = TURN_PARAGRAPHS[role];
  const base = paragraphs[turnIndex % paragraphs.length];
  const normalizedTheme = theme.trim() || "ローカルLLM構築を加速する3AI会議UI";
  return [
    `${modeGuide.intro} テーマ「${normalizedTheme}」に対する ${meta.label} としての発言です（ターン ${turnIndex + 1}）。`,
    base,
  ].join("\n\n");
}

async function produceMockTurn(
  input: ContinueActionInput,
): Promise<ContinueActionResult> {
  const meta = ROLE_META[input.nextSpeaker];
  const turnIndex = input.history.length;
  const content = buildMockTurnContent(
    input.nextSpeaker,
    input.mode,
    input.theme,
    turnIndex,
  );
  return {
    action: "continue",
    turn: {
      role: input.nextSpeaker,
      label: meta.label,
      viewpoint: meta.viewpoint,
      emphasis: meta.emphasis,
      content,
    },
  };
}

async function produceMockSynthesis(
  input: SynthesizeActionInput,
): Promise<SynthesizeActionResult> {
  const modeGuide = MODE_GUIDANCE[input.mode];
  const normalizedTheme =
    input.theme.trim() || "ローカルLLM構築を加速する3AI会議UI";
  const turnCount = input.history.length;
  return {
    action: "synthesize",
    synthesis: {
      agreements: [
        `${modeGuide.agreementsLead}として、「${normalizedTheme}」は 3AI の役割分担を明示した会議 UI として扱う。`,
        "ユーザーが明示指示を出すまで、AI は最終結論を固定しない。",
        `モック provider でも ${turnCount} ターン分の会話を履歴として扱える境界を先に作った。`,
      ],
      openQuestions: [
        "各ターンの応答をストリーミングに載せ替えるかどうか。",
        "attachment 本文をどの粒度で要約して provider に渡すか。",
        "会話履歴の永続化スキーマをどう設計するか。",
      ],
      recommendation: `${modeGuide.recommendationLead}として、会議 UI・provider 境界・session 永続化 scaffold の 3 点を優先で固めるのが妥当です。`,
    },
  };
}

async function produceMockJudgment(
  input: JudgeActionInput,
): Promise<JudgeActionResult> {
  const visionTurns = input.history.filter((entry) => entry.role === "vision");
  const realityTurns = input.history.filter((entry) => entry.role === "reality");
  const proLead = visionTurns[0]?.content.split("\n\n")[0] ?? "";
  const conLead = realityTurns[0]?.content.split("\n\n")[0] ?? "";
  return {
    action: "judge",
    debateJudgment: {
      verdictHeadline: "追加検証付きで構想側案を前進",
      verdictDetail:
        "現時点では「追加検証付きで構想側の方向を前進させる」が妥当です。",
      reasoning:
        "構想側は前進案を示し、現実側はリスク整理を提供しているため、結論を止めるより条件付きで進める方が意思決定しやすい状態です。",
      proLeadPoint: proLead,
      conLeadPoint: conLead,
      openPoints: [
        "追加検証をどの指標で判定するか",
        "ローカルLLM構築コストの見積精度",
        "商用LLM依存をどこまで許容するか",
      ],
      nextSteps: ["追加検証の評価基準", "実装コストと依存範囲"],
    },
  };
}

async function performAction(
  input: MeetingActionInput,
): Promise<MeetingActionResult> {
  switch (input.action) {
    case "continue":
      return produceMockTurn(input);
    case "synthesize":
      return produceMockSynthesis(input);
    case "judge":
      return produceMockJudgment(input);
  }
}

export const mockMeetingProvider: MeetingProviderAdapter = {
  name: "mock",
  performAction,
};

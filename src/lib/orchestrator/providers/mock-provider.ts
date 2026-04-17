import type {
  MeetingAttachment,
  DebateJudgmentResult,
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

const MODE_GUIDANCE: Record<
  MeetingMode,
  {
    intro: string;
    agreementsLead: string;
    recommendationLead: string;
  }
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

function buildAttachmentContext(attachments: MeetingAttachment[]) {
  if (attachments.length === 0) {
    return null;
  }

  const filenames = attachments.map((attachment) => attachment.filename).join(" / ");
  const firstAttachment = attachments[0];

  return {
    filenames,
    firstExcerpt: firstAttachment.excerpt,
    count: attachments.length,
  };
}

function buildRoleContent(
  role: SpeakerRole,
  theme: string,
  mode: MeetingMode,
  attachments: MeetingAttachment[],
): RoleResponse {
  const meta = ROLE_META[role];
  const modeGuide = MODE_GUIDANCE[mode];
  const attachmentContext = buildAttachmentContext(attachments);

  const roleParagraphs: Record<SpeakerRole, string[]> = {
    vision: [
      `${modeGuide.intro} テーマ「${theme}」は、3つのAIを単に並べるのではなく、役割を持った会議室として見せると印象が一段上がります。`,
      "MVPでは、テーマ入力から3視点の意見、そして統合結論までを一画面で流れるように体験させるべきです。入力、議論、結論が一直線につながると“使えそう感”が出ます。",
      "将来的には Provider Adapter を差し替えても UI が変わらない構造にしておくと、商用LLMとローカルLLMの両方へ展開しやすくなります。",
    ],
    reality: [
      "実装の現実線としては、まずモックの orchestrator をAPI越しに呼ぶ形にして、UIと生成ロジックの境界を先に作るのが安全です。",
      "フロントは App Router の1画面、バックエンド側は /api/meeting/run で十分です。レスポンスの形を先に固定すれば、あとで本物のLLM接続へ差し替えても影響範囲を抑えられます。",
      "Docker では app と postgres を先に用意しておき、今回DB未使用でも DATABASE_URL を通しておけば、後続PRで永続化を足しやすくなります。",
    ],
    audit: [
      "注意点は、最初のPRで“全部入り”にしないことです。会話保存、本番接続、AWS固有実装まで触ると、レビュー対象が広がりすぎます。",
      "また、見た目を整える一方で、責務が page.tsx に集中すると後で崩れやすいです。UIコンポーネント、型、モックオーケストレータを分けておくべきです。",
      "CI では lint / typecheck / build を最小セットに固定し、PR段階で壊れていないことを機械的に確認できる状態を作るのがMVPの守りになります。",
    ],
  };

  if (attachmentContext) {
    roleParagraphs[role].unshift(
      `添付資料（${attachmentContext.count}件: ${attachmentContext.filenames}）を前提に見ると、まず押さえるべきポイントは「${attachmentContext.firstExcerpt}」です。`,
    );
  }

  return {
    role,
    label: meta.label,
    viewpoint: meta.viewpoint,
    emphasis: meta.emphasis,
    content: roleParagraphs[role].join("\n\n"),
  };
}

function extractLeadPoint(content: string) {
  return content.split("\n\n")[0] ?? content;
}

function buildMockDebateJudgment(responses: RoleResponse[]): DebateJudgmentResult {
  return {
    verdictHeadline: "追加検証付きで賛成側案を前進",
    verdictDetail:
      "現時点では「追加検証付きで賛成側の方向を前進させる」が妥当です。",
    reasoning:
      "賛成側は前進案を示し、反対側はリスク整理を提供しているため、結論を止めるより条件付きで進める方が意思決定しやすい状態です。",
    proLeadPoint: extractLeadPoint(responses[0]?.content ?? ""),
    conLeadPoint: extractLeadPoint(responses[1]?.content ?? ""),
    openPoints: [
      "追加検証をどの指標で判定するか",
      "ローカルLLM構築コストの見積精度",
      "商用LLM依存をどこまで許容するか",
    ],
    nextSteps: ["追加検証の評価基準", "実装コストと依存範囲"],
  };
}

async function runMockMeeting({
  theme,
  mode,
  attachments = [],
}: RunMeetingInput): Promise<MeetingRunResult> {
  const normalizedTheme = theme.trim() || "ローカルLLM構築を加速する3AI会議UI";
  const modeGuide = MODE_GUIDANCE[mode];
  const attachmentContext = buildAttachmentContext(attachments);

  const responses: RoleResponse[] = [
    buildRoleContent("vision", normalizedTheme, mode, attachments),
    buildRoleContent("reality", normalizedTheme, mode, attachments),
    buildRoleContent("audit", normalizedTheme, mode, attachments),
  ];
  const synthesis: SynthesisResult = {
    agreements: [
      `${modeGuide.agreementsLead}として、3AIの役割を明示した会議UIにする。`,
      "初回はモックデータで成立させ、UI層とAPI層の境界を先に作る。",
      ...(attachmentContext
        ? [`添付資料（${attachmentContext.filenames}）を会議コンテキストとして扱えるようにする。`]
        : []),
      "将来のAWS/ECS移行を見据え、Docker・環境変数・PostgreSQL前提の土台を先に置く。",
    ],
    openQuestions: [
      "各AIの発言を逐次生成にするか、まとめて返すか。",
      ...(attachmentContext
        ? ["資料テキストをどこまで要約して provider に渡すか。"]
        : []),
      "会話履歴保存をRDB中心にするか、イベントログ中心にするか。",
      "実LLM接続時に各Providerの出力差をどこまで統一フォーマットへ寄せるか。",
    ],
    recommendation: `${modeGuide.recommendationLead}として、まずは単一画面の会議UI、モックorchestrator API、CI、Docker、READMEまでを1セットで整えるのが最適です。${
      attachmentContext
        ? ` 添付資料から抽出したテキストを前提条件として会話へ流し込むと、議論の具体性を一段上げられます。`
        : ""
    }`,
  };

  return {
    theme: normalizedTheme,
    mode,
    responses,
    synthesis,
    debateJudgment: buildMockDebateJudgment(responses),
    generatedAt: new Date().toISOString(),
  };
}

export const mockMeetingProvider: MeetingProviderAdapter = {
  name: "mock",
  runMeeting: runMockMeeting,
};

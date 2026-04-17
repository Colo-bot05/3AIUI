import type {
  DebateAssignmentLabels,
  MeetingMode,
  MeetingRunResult,
  PreparedDebateJudgmentContent,
  PreparedSynthesisContent,
  RoleResponse,
  RunMeetingInput,
  SpeakerRole,
  SynthesisResult,
} from "@/features/meeting/types";

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

function buildRoleContent(
  role: SpeakerRole,
  theme: string,
  mode: MeetingMode,
): RoleResponse {
  const meta = ROLE_META[role];
  const modeGuide = MODE_GUIDANCE[mode];

  const roleParagraphs: Record<SpeakerRole, string[]> = {
    vision: [
      `${modeGuide.intro} テーマ「${theme}」は、3つのAIを単に並べるのではなく、役割を持った会議室として見せると印象が一段上がります。`,
      `MVPでは、テーマ入力から3視点の意見、そして統合結論までを一画面で流れるように体験させるべきです。入力、議論、結論が一直線につながると“使えそう感”が出ます。`,
      `将来的には Provider Adapter を差し替えても UI が変わらない構造にしておくと、商用LLMとローカルLLMの両方へ展開しやすくなります。`,
    ],
    reality: [
      `実装の現実線としては、まずモックの orchestrator をAPI越しに呼ぶ形にして、UIと生成ロジックの境界を先に作るのが安全です。`,
      `フロントは App Router の1画面、バックエンド側は /api/meeting/run で十分です。レスポンスの形を先に固定すれば、あとで本物のLLM接続へ差し替えても影響範囲を抑えられます。`,
      `Docker では app と postgres を先に用意しておき、今回DB未使用でも DATABASE_URL を通しておけば、後続PRで永続化を足しやすくなります。`,
    ],
    audit: [
      `注意点は、最初のPRで“全部入り”にしないことです。会話保存、本番接続、AWS固有実装まで触ると、レビュー対象が広がりすぎます。`,
      `また、見た目を整える一方で、責務が page.tsx に集中すると後で崩れやすいです。UIコンポーネント、型、モックオーケストレータを分けておくべきです。`,
      `CI では lint / typecheck / build を最小セットに固定し、PR段階で壊れていないことを機械的に確認できる状態を作るのがMVPの守りになります。`,
    ],
  };

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

export function buildMockSynthesisContent(
  synthesis: SynthesisResult,
): PreparedSynthesisContent {
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

export function buildMockDebateJudgmentContent({
  responses,
  labels,
}: {
  responses: RoleResponse[];
  labels: DebateAssignmentLabels;
}): PreparedDebateJudgmentContent {
  return {
    body: [
      "判定",
      `${labels.judge} の暫定判断: 追加検証付きで賛成側案を前進`,
      "",
      "次に確認すべきこと",
      "- 追加検証の評価基準",
      "- 実装コストと依存範囲",
    ].join("\n"),
    sections: [
      {
        title: "賛成側の要点",
        tone: "border-orange-200 bg-orange-50/85",
        items: [`${labels.pro}: ${extractLeadPoint(responses[0]?.content ?? "")}`],
      },
      {
        title: "反対側の要点",
        tone: "border-sky-200 bg-sky-50/85",
        items: [`${labels.con}: ${extractLeadPoint(responses[1]?.content ?? "")}`],
      },
      {
        title: "判定",
        tone: "border-emerald-200 bg-emerald-50/90",
        body: `${labels.judge} の暫定判断として、現時点では「追加検証付きで賛成側の方向を前進させる」が妥当です。`,
      },
      {
        title: "判定理由",
        tone: "border-violet-200 bg-violet-50/90",
        body: "賛成側は前進案を示し、反対側はリスク整理を提供しているため、結論を止めるより条件付きで進める方が意思決定しやすい状態です。",
      },
      {
        title: "残る論点",
        tone: "border-zinc-200 bg-zinc-50/90",
        items: [
          "追加検証をどの指標で判定するか",
          "ローカルLLM構築コストの見積精度",
          "商用LLM依存をどこまで許容するか",
        ],
      },
    ],
  };
}

export async function runMockMeeting({
  theme,
  mode,
}: RunMeetingInput): Promise<MeetingRunResult> {
  const normalizedTheme = theme.trim() || "ローカルLLM構築を加速する3AI会議UI";
  const modeGuide = MODE_GUIDANCE[mode];

  const responses: RoleResponse[] = [
    buildRoleContent("vision", normalizedTheme, mode),
    buildRoleContent("reality", normalizedTheme, mode),
    buildRoleContent("audit", normalizedTheme, mode),
  ];
  const synthesis: SynthesisResult = {
    agreements: [
      `${modeGuide.agreementsLead}として、3AIの役割を明示した会議UIにする。`,
      "初回はモックデータで成立させ、UI層とAPI層の境界を先に作る。",
      "将来のAWS/ECS移行を見据え、Docker・環境変数・PostgreSQL前提の土台を先に置く。",
    ],
    openQuestions: [
      "各AIの発言を逐次生成にするか、まとめて返すか。",
      "会話履歴保存をRDB中心にするか、イベントログ中心にするか。",
      "実LLM接続時に各Providerの出力差をどこまで統一フォーマットへ寄せるか。",
    ],
    recommendation: `${modeGuide.recommendationLead}として、まずは単一画面の会議UI、モックorchestrator API、CI、Docker、READMEまでを1セットで整えるのが最適です。`,
  };

  return {
    theme: normalizedTheme,
    mode,
    responses,
    synthesis,
    preparedSynthesis: buildMockSynthesisContent(synthesis),
    generatedAt: new Date().toISOString(),
  };
}

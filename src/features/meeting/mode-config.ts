import type { MeetingMode } from "./types";

export const MODE_OPTIONS: Array<{
  value: MeetingMode;
  label: string;
  description: string;
}> = [
  {
    value: "brainstorm",
    label: "ブレスト",
    description: "着想を広げ、実現案の候補を素早く出す",
  },
  {
    value: "design_review",
    label: "設計レビュー",
    description: "構成・責務・リスクの抜け漏れを確認する",
  },
  {
    value: "debate",
    label: "ディベート",
    description: "対立する論点を並べ、判断材料を整理する",
  },
];

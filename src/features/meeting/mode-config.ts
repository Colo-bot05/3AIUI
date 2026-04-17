import type { MeetingMode } from "./types";

export const MODE_OPTIONS: Array<{
  value: MeetingMode;
  label: string;
  description: string;
  timelineStatus: string;
  panelTone: string;
}> = [
  {
    value: "brainstorm",
    label: "ブレスト",
    description: "着想を広げ、実現案の候補を素早く出す",
    timelineStatus: "発散中",
    panelTone: "bg-orange-100 text-orange-900 border-orange-200",
  },
  {
    value: "design_review",
    label: "ディスカッション",
    description: "論点整理や設計検討を、順番に深掘りする",
    timelineStatus: "議論中",
    panelTone: "bg-sky-100 text-sky-900 border-sky-200",
  },
  {
    value: "debate",
    label: "ディベート",
    description: "対立する論点を並べ、判断材料を整理する",
    timelineStatus: "主張中",
    panelTone: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
];

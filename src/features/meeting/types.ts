export type MeetingMode = "brainstorm" | "design_review" | "debate";

export type SpeakerRole = "vision" | "reality" | "audit";

export interface RoleResponse {
  role: SpeakerRole;
  label: string;
  viewpoint: string;
  content: string;
  emphasis: string;
}

export interface SynthesisResult {
  agreements: string[];
  openQuestions: string[];
  recommendation: string;
}

export interface MeetingRunResult {
  theme: string;
  mode: MeetingMode;
  responses: RoleResponse[];
  synthesis: SynthesisResult;
  generatedAt: string;
}

export interface RunMeetingInput {
  theme: string;
  mode: MeetingMode;
}

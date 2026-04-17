export type MeetingMode = "brainstorm" | "design_review" | "debate";
export type MeetingProvider =
  | "mock"
  | "openai"
  | "anthropic"
  | "google"
  | "local";
export type MeetingMessageType =
  | "user"
  | "ai_message"
  | "synthesis"
  | "debate_judgment"
  | "system_status";
export type ConversationState =
  | "brainstorming"
  | "discussing"
  | "debating"
  | "awaiting_synthesis"
  | "awaiting_judgment"
  | "synthesized"
  | "judged";
export type DebateModel = "gpt" | "gemini" | "claude";
export type DebateRole = "pro" | "con" | "judge";

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

export interface ConversationStateSnapshot {
  mode: MeetingMode;
  state: ConversationState;
  label: string;
  hint: string;
}

export interface DebateRoleAssignments {
  pro: DebateModel | "";
  con: DebateModel | "";
  judge: DebateModel | "";
}

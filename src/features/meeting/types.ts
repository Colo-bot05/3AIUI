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
export type SupportedAttachmentExtension =
  | "pdf"
  | "docx"
  | "pptx"
  | "xlsx"
  | "md"
  | "txt";

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

export interface DebateJudgmentResult {
  verdictHeadline: string;
  verdictDetail: string;
  reasoning: string;
  proLeadPoint: string;
  conLeadPoint: string;
  openPoints: string[];
  nextSteps: string[];
}

export interface DebateAssignmentLabels {
  pro: string;
  con: string;
  judge: string;
}

export interface MeetingAttachment {
  id: string;
  filename: string;
  extension: SupportedAttachmentExtension;
  mimeType: string;
  size: number;
  extractedText: string;
  excerpt: string;
}

export interface MeetingRunResult {
  theme: string;
  mode: MeetingMode;
  responses: RoleResponse[];
  synthesis?: SynthesisResult;
  debateJudgment?: DebateJudgmentResult;
  generatedAt: string;
}

export interface RolePrompts {
  vision: string;
  reality: string;
  audit: string;
}

export type MeetingAction = "continue" | "synthesize" | "judge";

export interface MeetingActionBaseInput {
  theme: string;
  mode: MeetingMode;
  attachments?: MeetingAttachment[];
  rolePrompts?: RolePrompts;
  history: RoleResponse[];
  meetingId?: string;
}

export interface ContinueActionInput extends MeetingActionBaseInput {
  action: "continue";
  nextSpeaker: Exclude<SpeakerRole, "audit">;
}

export interface SynthesizeActionInput extends MeetingActionBaseInput {
  action: "synthesize";
}

export interface JudgeActionInput extends MeetingActionBaseInput {
  action: "judge";
  debateAssignmentLabels?: DebateAssignmentLabels;
}

export type MeetingActionInput =
  | ContinueActionInput
  | SynthesizeActionInput
  | JudgeActionInput;

export interface ContinueActionResult {
  action: "continue";
  turn: RoleResponse;
  meetingId?: string;
}

export interface SynthesizeActionResult {
  action: "synthesize";
  synthesis: SynthesisResult;
  meetingId?: string;
}

export interface JudgeActionResult {
  action: "judge";
  debateJudgment: DebateJudgmentResult;
  meetingId?: string;
}

export type MeetingActionResult =
  | ContinueActionResult
  | SynthesizeActionResult
  | JudgeActionResult;

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

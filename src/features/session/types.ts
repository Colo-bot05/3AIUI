import type { ConversationState, MeetingMode } from "@/features/meeting/types";

export type SessionEventType =
  | "meeting_generated"
  | "synthesis_requested"
  | "judgment_requested";

export interface SessionEntry {
  id: string;
  type: SessionEventType;
  mode: MeetingMode;
  prompt: string;
  conversationState: ConversationState;
  createdAt: string;
}

export interface MeetingSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  entries: SessionEntry[];
}

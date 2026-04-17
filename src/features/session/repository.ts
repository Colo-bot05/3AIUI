import type { ConversationState, MeetingMode } from "@/features/meeting/types";

import type {
  MeetingSession,
  SessionAttachmentContext,
  SessionEntry,
  SessionEventType,
} from "./types";

export interface CreateSessionInput {
  initialMode: MeetingMode;
}

export interface AppendSessionEntryInput {
  sessionId: string;
  type: SessionEventType;
  mode: MeetingMode;
  prompt: string;
  conversationState: ConversationState;
  attachmentContext?: SessionAttachmentContext;
}

export interface SessionRepository {
  createSession(input: CreateSessionInput): Promise<MeetingSession>;
  getSession(sessionId: string): Promise<MeetingSession | null>;
  appendEntry(input: AppendSessionEntryInput): Promise<SessionEntry>;
}

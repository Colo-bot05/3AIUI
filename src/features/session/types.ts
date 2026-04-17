import type { AttachmentParseStatus } from "@/features/attachments/types";
import type {
  ConversationState,
  MeetingMode,
  SupportedAttachmentExtension,
} from "@/features/meeting/types";

export type SessionEventType =
  | "attachment_attached"
  | "attachment_removed"
  | "meeting_generated"
  | "synthesis_requested"
  | "judgment_requested";

export interface SessionAttachmentReference {
  id: string;
  filename: string;
  extension: SupportedAttachmentExtension;
  mimeType: string;
  size: number;
  status: AttachmentParseStatus;
}

export interface SessionAttachmentContext {
  attachmentIds: string[];
  attachmentCount: number;
  attachmentNames: string[];
  attachments: SessionAttachmentReference[];
}

export interface SessionEntry {
  id: string;
  type: SessionEventType;
  mode: MeetingMode;
  prompt: string;
  conversationState: ConversationState;
  attachmentContext?: SessionAttachmentContext;
  createdAt: string;
}

export interface MeetingSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  entries: SessionEntry[];
}

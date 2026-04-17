import type {
  MeetingAttachment,
  SupportedAttachmentExtension,
} from "@/features/meeting/types";

export type AttachmentParseStatus = "ready" | "error";

export interface AttachmentParseError {
  filename: string;
  message: string;
}

export interface ParsedAttachmentResponse {
  attachment?: MeetingAttachment;
  error?: AttachmentParseError;
}

export interface WorkspaceAttachmentItem extends MeetingAttachment {
  status: AttachmentParseStatus;
  error?: string;
}

export const SUPPORTED_ATTACHMENT_EXTENSIONS: SupportedAttachmentExtension[] = [
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "md",
  "txt",
];

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_TEXT_LENGTH = 12000;
export const MAX_ATTACHMENT_EXCERPT_LENGTH = 400;

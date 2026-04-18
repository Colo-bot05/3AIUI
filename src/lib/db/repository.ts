import { asc, desc, eq, isNull, sql } from "drizzle-orm";

import type {
  DebateAssignmentLabels,
  DebateJudgmentResult,
  MeetingDetail,
  MeetingMode,
  MeetingSummary,
  RolePrompts,
  SpeakerRole,
  SynthesisResult,
} from "@/features/meeting/types";

import { getDatabaseClient } from "./client";
import {
  attachments,
  auditOutputs,
  meetings,
  promptSettings,
  turns,
} from "./schema";

export type AttachmentExtractStatus =
  | "ready"
  | "extract_failed"
  | "format_error";

function warn(label: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[db] ${label} failed: ${message}`);
}

export async function createMeeting(input: {
  topic: string;
  mode: MeetingMode;
  debateAssignments?: DebateAssignmentLabels;
}): Promise<string | null> {
  const db = getDatabaseClient();
  if (!db) {
    return null;
  }
  try {
    const [row] = await db
      .insert(meetings)
      .values({
        topic: input.topic,
        mode: input.mode,
        debateAssignments: input.debateAssignments ?? null,
      })
      .returning({ id: meetings.id });
    return row?.id ?? null;
  } catch (error) {
    warn("createMeeting", error);
    return null;
  }
}

export async function appendTurn(input: {
  meetingId: string;
  turnIndex: number;
  role: SpeakerRole;
  model?: string | null;
  content: string;
  action: "continue";
}): Promise<void> {
  const db = getDatabaseClient();
  if (!db) {
    return;
  }
  try {
    await db.insert(turns).values({
      meetingId: input.meetingId,
      turnIndex: input.turnIndex,
      role: input.role,
      model: input.model ?? null,
      content: input.content,
      action: input.action,
    });
    await db
      .update(meetings)
      .set({ updatedAt: new Date() })
      .where(eq(meetings.id, input.meetingId));
  } catch (error) {
    warn("appendTurn", error);
  }
}

export async function createAttachmentRow(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  extractStatus: AttachmentExtractStatus;
  previewText: string | null;
  meetingId?: string | null;
}): Promise<string | null> {
  const db = getDatabaseClient();
  if (!db) {
    return null;
  }
  try {
    const [row] = await db
      .insert(attachments)
      .values({
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        extractStatus: input.extractStatus,
        previewText: input.previewText,
        meetingId: input.meetingId ?? null,
      })
      .returning({ id: attachments.id });
    return row?.id ?? null;
  } catch (error) {
    warn("createAttachmentRow", error);
    return null;
  }
}

export async function deleteAttachmentRow(id: string): Promise<void> {
  const db = getDatabaseClient();
  if (!db) {
    return;
  }
  try {
    await db.delete(attachments).where(eq(attachments.id, id));
  } catch (error) {
    warn("deleteAttachmentRow", error);
  }
}

export async function linkOrphanAttachments(meetingId: string): Promise<void> {
  const db = getDatabaseClient();
  if (!db) {
    return;
  }
  try {
    await db
      .update(attachments)
      .set({ meetingId })
      .where(isNull(attachments.meetingId));
  } catch (error) {
    warn("linkOrphanAttachments", error);
  }
}

export async function upsertDefaultPrompts(
  rolePrompts: RolePrompts,
): Promise<void> {
  const db = getDatabaseClient();
  if (!db) {
    return;
  }
  try {
    const entries: Array<{ role: keyof RolePrompts; promptText: string }> = [
      { role: "vision", promptText: rolePrompts.vision },
      { role: "reality", promptText: rolePrompts.reality },
      { role: "audit", promptText: rolePrompts.audit },
    ];
    for (const entry of entries) {
      await db
        .insert(promptSettings)
        .values({
          meetingId: null,
          role: entry.role,
          promptText: entry.promptText,
        })
        .onConflictDoUpdate({
          target: [promptSettings.meetingId, promptSettings.role],
          set: {
            promptText: entry.promptText,
            createdAt: sql`now()`,
          },
        });
    }
  } catch (error) {
    warn("upsertDefaultPrompts", error);
  }
}

export async function saveMeetingPromptSnapshot(
  meetingId: string,
  rolePrompts: RolePrompts,
): Promise<void> {
  const db = getDatabaseClient();
  if (!db) {
    return;
  }
  try {
    // Remove any existing snapshot for this meeting first (idempotent call).
    await db
      .delete(promptSettings)
      .where(eq(promptSettings.meetingId, meetingId));
    await db.insert(promptSettings).values([
      { meetingId, role: "vision", promptText: rolePrompts.vision },
      { meetingId, role: "reality", promptText: rolePrompts.reality },
      { meetingId, role: "audit", promptText: rolePrompts.audit },
    ]);
  } catch (error) {
    warn("saveMeetingPromptSnapshot", error);
  }
}

export async function loadDefaultPrompts(): Promise<RolePrompts | null> {
  const db = getDatabaseClient();
  if (!db) {
    return null;
  }
  try {
    const rows = await db
      .select({ role: promptSettings.role, promptText: promptSettings.promptText })
      .from(promptSettings)
      .where(isNull(promptSettings.meetingId));
    if (rows.length === 0) {
      return null;
    }
    const byRole = new Map(rows.map((row) => [row.role, row.promptText]));
    const vision = byRole.get("vision");
    const reality = byRole.get("reality");
    const audit = byRole.get("audit");
    if (!vision || !reality || !audit) {
      return null;
    }
    return { vision, reality, audit };
  } catch (error) {
    warn("loadDefaultPrompts", error);
    return null;
  }
}

export async function saveAuditOutput(input: {
  meetingId: string;
  kind: "synthesis" | "judge";
  content: SynthesisResult | DebateJudgmentResult;
}): Promise<void> {
  const db = getDatabaseClient();
  if (!db) {
    return;
  }
  try {
    await db.insert(auditOutputs).values({
      meetingId: input.meetingId,
      kind: input.kind,
      content: input.content,
    });
    await db
      .update(meetings)
      .set({ updatedAt: new Date() })
      .where(eq(meetings.id, input.meetingId));
  } catch (error) {
    warn("saveAuditOutput", error);
  }
}

export async function listMeetings(limit = 50): Promise<MeetingSummary[]> {
  const db = getDatabaseClient();
  if (!db) {
    return [];
  }
  try {
    const rows = await db
      .select({
        id: meetings.id,
        topic: meetings.topic,
        mode: meetings.mode,
        createdAt: meetings.createdAt,
        updatedAt: meetings.updatedAt,
      })
      .from(meetings)
      .orderBy(desc(meetings.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      topic: row.topic,
      mode: row.mode as MeetingSummary["mode"],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  } catch (error) {
    warn("listMeetings", error);
    return [];
  }
}

export async function getMeetingById(id: string): Promise<MeetingDetail | null> {
  const db = getDatabaseClient();
  if (!db) {
    return null;
  }
  try {
    const [meetingRow] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, id))
      .limit(1);
    if (!meetingRow) {
      return null;
    }
    const turnRows = await db
      .select()
      .from(turns)
      .where(eq(turns.meetingId, id))
      .orderBy(asc(turns.turnIndex));
    const auditRows = await db
      .select()
      .from(auditOutputs)
      .where(eq(auditOutputs.meetingId, id));
    const attachmentRows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.meetingId, id));
    const promptRows = await db
      .select()
      .from(promptSettings)
      .where(eq(promptSettings.meetingId, id));

    const synthesisRow = auditRows.find((row) => row.kind === "synthesis");
    const judgeRow = auditRows.find((row) => row.kind === "judge");

    const promptsByRole = new Map(
      promptRows.map((row) => [row.role, row.promptText]),
    );
    const rolePrompts: RolePrompts | null =
      promptsByRole.has("vision") &&
      promptsByRole.has("reality") &&
      promptsByRole.has("audit")
        ? {
            vision: promptsByRole.get("vision")!,
            reality: promptsByRole.get("reality")!,
            audit: promptsByRole.get("audit")!,
          }
        : null;

    return {
      id: meetingRow.id,
      topic: meetingRow.topic,
      mode: meetingRow.mode as MeetingDetail["mode"],
      createdAt: meetingRow.createdAt.toISOString(),
      updatedAt: meetingRow.updatedAt.toISOString(),
      turns: turnRows.map((row) => ({
        turnIndex: row.turnIndex,
        role: row.role as SpeakerRole,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
      })),
      synthesis: (synthesisRow?.content as SynthesisResult | undefined) ?? null,
      debateJudgment:
        (judgeRow?.content as DebateJudgmentResult | undefined) ?? null,
      attachments: attachmentRows.map((row) => ({
        id: row.id,
        filename: row.filename,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        extractStatus: row.extractStatus,
        previewText: row.previewText,
      })),
      rolePrompts,
    };
  } catch (error) {
    warn("getMeetingById", error);
    return null;
  }
}

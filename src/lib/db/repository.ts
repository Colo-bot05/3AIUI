import { eq } from "drizzle-orm";

import type {
  DebateAssignmentLabels,
  DebateJudgmentResult,
  MeetingMode,
  SpeakerRole,
  SynthesisResult,
} from "@/features/meeting/types";

import { getDatabaseClient } from "./client";
import { auditOutputs, meetings, turns } from "./schema";

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

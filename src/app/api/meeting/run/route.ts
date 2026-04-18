import type {
  ContinueActionInput,
  JudgeActionInput,
  MeetingAction,
  MeetingActionInput,
  MeetingActionResult,
  MeetingMode,
  SynthesizeActionInput,
} from "@/features/meeting/types";
import {
  appendTurn,
  createMeeting,
  saveAuditOutput,
} from "@/lib/db/repository";
import { runMeetingAction } from "@/lib/orchestrator/provider-registry";

const VALID_MODES: MeetingMode[] = ["brainstorm", "design_review", "debate"];
const VALID_ACTIONS: MeetingAction[] = ["continue", "synthesize", "judge"];

async function ensureMeetingId(
  input: MeetingActionInput,
): Promise<string | null> {
  if (input.meetingId) {
    return input.meetingId;
  }
  if (input.action !== "continue" || input.history.length > 0) {
    // synthesize / judge without meetingId means the prior continue never
    // persisted. Skip DB writes rather than creating a half-linked row.
    return null;
  }
  return createMeeting({
    topic: input.theme.trim() || "Untitled meeting",
    mode: input.mode,
  });
}

async function persistContinue(
  input: ContinueActionInput,
  meetingId: string | null,
  result: Extract<MeetingActionResult, { action: "continue" }>,
) {
  if (!meetingId) {
    return;
  }
  await appendTurn({
    meetingId,
    turnIndex: input.history.length + 1,
    role: result.turn.role,
    content: result.turn.content,
    action: "continue",
  });
}

async function persistSynthesize(
  input: SynthesizeActionInput,
  meetingId: string | null,
  result: Extract<MeetingActionResult, { action: "synthesize" }>,
) {
  if (!meetingId) {
    return;
  }
  await saveAuditOutput({
    meetingId,
    kind: "synthesis",
    content: result.synthesis,
  });
}

async function persistJudge(
  input: JudgeActionInput,
  meetingId: string | null,
  result: Extract<MeetingActionResult, { action: "judge" }>,
) {
  if (!meetingId) {
    return;
  }
  await saveAuditOutput({
    meetingId,
    kind: "judge",
    content: result.debateJudgment,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<MeetingActionInput>;

  if (!body.action || !VALID_ACTIONS.includes(body.action)) {
    return Response.json(
      { error: "Invalid action. Use continue, synthesize, or judge." },
      { status: 400 },
    );
  }

  if (!body.mode || !VALID_MODES.includes(body.mode)) {
    return Response.json(
      { error: "Invalid mode. Use brainstorm, design_review, or debate." },
      { status: 400 },
    );
  }

  if (body.action === "continue") {
    if (body.nextSpeaker !== "vision" && body.nextSpeaker !== "reality") {
      return Response.json(
        { error: "Continue requires nextSpeaker to be 'vision' or 'reality'." },
        { status: 400 },
      );
    }
  }

  const attachments = body.attachments ?? [];
  const firstAttachment = attachments[0];
  console.log(
    "[meeting/run] action=%s mode=%s attachments=%d firstLen=%d",
    body.action,
    body.mode,
    attachments.length,
    firstAttachment?.extractedText?.length ?? 0,
  );

  const input = body as MeetingActionInput;
  const result = await runMeetingAction(input, process.env.MEETING_PROVIDER);

  let meetingId = input.meetingId ?? null;
  try {
    meetingId = await ensureMeetingId(input);
    if (result.action === "continue") {
      await persistContinue(input as ContinueActionInput, meetingId, result);
    } else if (result.action === "synthesize") {
      await persistSynthesize(input as SynthesizeActionInput, meetingId, result);
    } else if (result.action === "judge") {
      await persistJudge(input as JudgeActionInput, meetingId, result);
    }
  } catch (error) {
    console.warn(
      "[db] persistence failed:",
      error instanceof Error ? error.message : error,
    );
  }

  return Response.json({ ...result, meetingId: meetingId ?? undefined });
}

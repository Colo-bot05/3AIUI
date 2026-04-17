import type {
  MeetingAction,
  MeetingActionInput,
  MeetingMode,
} from "@/features/meeting/types";
import { runMeetingAction } from "@/lib/orchestrator/provider-registry";

const VALID_MODES: MeetingMode[] = ["brainstorm", "design_review", "debate"];
const VALID_ACTIONS: MeetingAction[] = ["continue", "synthesize", "judge"];

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

  const result = await runMeetingAction(
    body as MeetingActionInput,
    process.env.MEETING_PROVIDER,
  );
  return Response.json(result);
}

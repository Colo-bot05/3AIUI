import type { MeetingAttachment, MeetingMode } from "@/features/meeting/types";
import { runMeetingWithProvider } from "@/lib/orchestrator/provider-registry";

const VALID_MODES: MeetingMode[] = ["brainstorm", "design_review", "debate"];

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<{
    theme: string;
    mode: MeetingMode;
    attachments: MeetingAttachment[];
  }>;

  const theme = body.theme?.trim() ?? "";
  const mode = body.mode;
  const attachments = body.attachments ?? [];

  if (!mode || !VALID_MODES.includes(mode)) {
    return Response.json(
      { error: "Invalid mode. Use brainstorm, design_review, or debate." },
      { status: 400 },
    );
  }

  const result = await runMeetingWithProvider(
    { theme, mode, attachments },
    process.env.MEETING_PROVIDER,
  );
  return Response.json(result);
}

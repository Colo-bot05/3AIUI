import { runMockMeeting } from "@/lib/orchestrator/mock-orchestrator";
import type { MeetingMode } from "@/features/meeting/types";

const VALID_MODES: MeetingMode[] = ["brainstorm", "design_review", "debate"];

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<{
    theme: string;
    mode: MeetingMode;
  }>;

  const theme = body.theme?.trim() ?? "";
  const mode = body.mode;

  if (!mode || !VALID_MODES.includes(mode)) {
    return Response.json(
      { error: "Invalid mode. Use brainstorm, design_review, or debate." },
      { status: 400 },
    );
  }

  const result = await runMockMeeting({ theme, mode });
  return Response.json(result);
}

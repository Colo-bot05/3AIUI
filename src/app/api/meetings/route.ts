import { listMeetings } from "@/lib/db/repository";

export async function GET() {
  const meetings = await listMeetings(50);
  return Response.json({ meetings });
}

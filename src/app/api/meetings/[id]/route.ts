import { getMeetingById } from "@/lib/db/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }
  const meeting = await getMeetingById(id);
  if (!meeting) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json(meeting);
}

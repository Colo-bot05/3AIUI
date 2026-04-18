import { deleteAttachmentRow } from "@/lib/db/repository";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }
  await deleteAttachmentRow(id);
  return Response.json({ ok: true });
}

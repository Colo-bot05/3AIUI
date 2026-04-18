import { parseAttachmentFile } from "@/lib/attachments/parse-attachment";
import { createAttachmentRow } from "@/lib/db/repository";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { error: { filename: "unknown", message: "ファイルが見つかりません。" } },
      { status: 400 },
    );
  }

  try {
    const result = await parseAttachmentFile(file);

    if (result.error) {
      const extractStatus =
        result.error.message.includes("対応していないファイル形式") ||
        result.error.message.includes("ファイルサイズが上限を超えています")
          ? "format_error"
          : "extract_failed";
      // Still persist metadata so the UI can show + later allow manual removal.
      await createAttachmentRow({
        filename: result.error.filename,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        extractStatus,
        previewText: null,
      });
      return Response.json(result, { status: 400 });
    }

    if (result.attachment) {
      const dbId = await createAttachmentRow({
        filename: result.attachment.filename,
        mimeType: result.attachment.mimeType,
        sizeBytes: result.attachment.size,
        extractStatus: "ready",
        previewText: result.attachment.excerpt || null,
      });
      if (dbId) {
        result.attachment = { ...result.attachment, id: dbId };
      }
    }

    return Response.json(result);
  } catch {
    return Response.json(
      {
        error: {
          filename: file.name,
          message: "ファイル解析中にエラーが発生しました。",
        },
      },
      { status: 500 },
    );
  }
}

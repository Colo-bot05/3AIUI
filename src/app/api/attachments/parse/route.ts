import { parseAttachmentFile } from "@/lib/attachments/parse-attachment";

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
      return Response.json(result, { status: 400 });
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

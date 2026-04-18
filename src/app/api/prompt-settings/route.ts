import type { RolePrompts } from "@/features/meeting/types";
import { upsertDefaultPrompts } from "@/lib/db/repository";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<{
    rolePrompts: RolePrompts;
  }>;
  const rolePrompts = body.rolePrompts;
  if (
    !rolePrompts ||
    typeof rolePrompts.vision !== "string" ||
    typeof rolePrompts.reality !== "string" ||
    typeof rolePrompts.audit !== "string"
  ) {
    return Response.json(
      { error: "rolePrompts must include vision / reality / audit strings." },
      { status: 400 },
    );
  }
  await upsertDefaultPrompts(rolePrompts);
  return Response.json({ ok: true });
}

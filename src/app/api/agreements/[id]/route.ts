import { auth } from "@/server/auth";
import { handle, json, HttpError } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const v = auth.get(id);
    if (!v) throw new HttpError("NOT_FOUND", "no such agreement", 404);
    return json(v);
  });
}

import { auth } from "@/server/auth";
import { handle, json, HttpError } from "@/server/http";
export const dynamic = "force-dynamic";
/** Requires the pairing token (header x-cs-pairing). Session cookies of any role are NOT sufficient. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const token = req.headers.get("x-cs-pairing") ?? "";
    if (!token || !auth.checkPairing(id, token))
      throw new HttpError("UNAUTHORIZED_CAPABILITY", "valid pairing token required", 403);
    return json(auth.approve(id, token));
  });
}

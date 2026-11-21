import { auth } from "@/server/auth";
import { handle, json } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    return json({ valid: auth.checkPairing(id, req.headers.get("x-cs-pairing") ?? "") });
  });
}

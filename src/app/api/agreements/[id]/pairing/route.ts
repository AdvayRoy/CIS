import { auth } from "@/server/auth";
import { handle, json, requireRole } from "@/server/http";
export const dynamic = "force-dynamic";
/** customer capability: mint a short-lived pairing token for the phone approval context. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    requireRole(req, "customer");
    const { id } = await ctx.params;
    const p = auth.issuePairing(id);
    return json({ ...p, approvePath: `/approve/${id}#t=${p.token}` });
  });
}

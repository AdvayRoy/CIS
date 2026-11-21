import { auth } from "@/server/auth";
import { bank } from "@/server/bank";
import { chain } from "@/server/chain";
import { handle, json, requireRole } from "@/server/http";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  return handle(async () => {
    requireRole(req, "operator");
    auth.reset(); bank.reset();
    let chainReset = true;
    try { await chain.reset(); } catch (e) { chainReset = false; console.error("[reset] chain", e); }
    return json({ ok: true, chainReset });
  });
}

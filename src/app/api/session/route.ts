import { z } from "zod";
import { auth } from "@/server/auth";
import { handle, json, readJson, HttpError } from "@/server/http";
export const dynamic = "force-dynamic";
const Body = z.object({ role: z.enum(["customer", "merchant", "operator"]), key: z.string().min(1) });
/** Demo sign-in. Disclosed: role keys stand in for real authentication. */
export async function POST(req: Request) {
  return handle(async () => {
    const { role, key } = Body.parse(await readJson(req));
    const s = auth.issueSession(role, key);
    if (!s) throw new HttpError("UNAUTHORIZED_CAPABILITY", "wrong key", 403);
    return json({ ok: true, role }, 200, { "set-cookie": s.cookie });
  });
}
export async function GET(req: Request) {
  return handle(() => json({ caps: auth.capsFromRequest(req) }));
}

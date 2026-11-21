import { z } from "zod";
import { chain } from "@/server/chain";
import { handle, json, readJson, requireRole } from "@/server/http";
export const dynamic = "force-dynamic";
const Body = z.object({ which: z.enum(["protected", "vulnerable"]) });
/** Operator only: actually send the shop's later transferFrom drain. */
export async function POST(req: Request) {
  return handle(async () => {
    requireRole(req, "operator");
    const { which } = Body.parse(await readJson(req));
    return json(await chain.attemptDrain(which));
  });
}

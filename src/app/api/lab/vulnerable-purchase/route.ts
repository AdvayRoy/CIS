import { chain } from "@/server/chain";
import { handle, json, requireRole } from "@/server/http";
export const dynamic = "force-dynamic";
/** INTENTIONALLY VULNERABLE comparison fixture (operator only). */
export async function POST(req: Request) {
  return handle(async () => { requireRole(req, "operator"); return json(await chain.runVulnerablePurchase()); });
}

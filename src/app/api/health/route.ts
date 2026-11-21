import { json } from "@/server/http";
import { chain } from "@/server/chain";
export const dynamic = "force-dynamic";
export async function GET() {
  const c = await chain.status().catch(() => ({ available: false, chainId: null, blockNumber: null }));
  return json({ ok: true, serverTime: Date.now(), chain: c });
}

import { auth } from "@/server/auth";
import { bank } from "@/server/bank";
import { chain } from "@/server/chain";
import { handle, json } from "@/server/http";
import type { Overview } from "@/shared/contract";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => {
    const [status, binding, sc] = await Promise.all([
      chain.status().catch(() => ({ available: false, chainId: null, blockNumber: null })),
      chain.binding().catch(() => null),
      chain.scenarios().catch(() => ({ protected: null, vulnerable: null })),
    ]);
    let accounts: Overview["bank"]["accounts"] = []; let bankOk = true;
    try { accounts = bank.accounts(); } catch { bankOk = false; }
    const body: Overview = {
      serverTime: Date.now(),
      labels: { bank: "Bank simulation", chain: "Local-chain demo" },
      bank: { available: bankOk && accounts.length > 0, accounts },
      chain: { available: status.available, chainId: status.chainId, blockNumber: status.blockNumber,
        token: binding?.token ?? null, protected: sc.protected, vulnerable: sc.vulnerable },
      agreements: auth.list(),
    };
    return json(body);
  });
}

/**
 * Reset the local-chain demo to its deterministic snapshot (or redeploy if the snapshot is gone).
 * Run: pnpm tsx scripts/chain/reset.ts
 */
import { chain } from "../../src/server/chain/index";

chain.reset().then(
  async () => {
    console.log("chain reset ok");
    console.log(JSON.stringify(await chain.scenarios(), null, 2));
  },
  (e) => {
    console.error(`reset failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);

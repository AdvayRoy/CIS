/**
 * Deploy the CounterSign local-chain demo to Anvil.
 * Run: pnpm tsx scripts/chain/deploy.ts
 * Env (names only): ANVIL_RPC_URL, CS_EXECUTOR_PRIVATE_KEY, CS_SIGNER_PRIVATE_KEY, CS_CHAIN_DEPLOYMENT.
 */
import { deployAll } from "../../src/server/chain/deploy";
import { deploymentPath, rpcUrl } from "../../src/server/chain/config";

deployAll().then(
  (d) => {
    console.log(`deployed to ${rpcUrl()} (chainId ${d.chainId})`);
    console.log(JSON.stringify(d, null, 2));
    console.log(`wrote ${deploymentPath()}`);
  },
  (e) => {
    console.error(`deploy failed: ${e instanceof Error ? e.message : String(e)}`);
    console.error("Is Anvil running? Start it with: anvil --port 8545");
    process.exit(1);
  },
);

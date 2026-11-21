// OWNER: worker C (w/bank). The ONLY module that touches the demo signer key. Never import this outside src/server/auth.
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

/** Anvil account #1: public test key, local demo only. */
const DEFAULT_SIGNER_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

let cached: ReturnType<typeof privateKeyToAccount> | null = null;
export function signerAccount() {
  if (!cached) cached = privateKeyToAccount((process.env.CS_SIGNER_PRIVATE_KEY || DEFAULT_SIGNER_KEY) as Hex);
  return cached;
}

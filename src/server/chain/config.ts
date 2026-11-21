// Server-only chain configuration. Read lazily so tests and scripts can set env first.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

// Anvil's well-known public test keys. Local chain only; never funded anywhere real.
const ANVIL_KEY_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
/** Where the hostile shop's sweep sends funds (Anvil account #3 address; no key used). */
export const ATTACKER_ADDRESS = "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as const;

export const rpcUrl = () => process.env.ANVIL_RPC_URL || "http://127.0.0.1:8545";
export const deploymentPath = () => resolve(process.env.CS_CHAIN_DEPLOYMENT || "./data/deployment.json");
export const executorAccount = () => privateKeyToAccount((process.env.CS_EXECUTOR_PRIVATE_KEY || ANVIL_KEY_0) as Hex);
import { auth } from "../auth";
/** Only the ADDRESS of the customer signer is ever derived here; the chain rail never signs with it. */
export const signerAddress = () => auth.signerAddress() as Hex;

export interface Deployment {
  chainId: number;
  token: Hex;
  shop: Hex;
  account: Hex;
  vulnerable: Hex;
  attacker: Hex;
  signer: Hex;
  executor: Hex;
  deployBlock: string;
  snapshotId: string;
  deployedAt: number;
}

export function readDeployment(): Deployment | null {
  try {
    const p = deploymentPath();
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as Deployment;
  } catch {
    return null;
  }
}

export function writeDeployment(d: Deployment): void {
  const p = deploymentPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(d, null, 2) + "\n");
}

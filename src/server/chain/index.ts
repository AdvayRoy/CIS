// OWNER: worker D (w/crypto). Replace this stub with the real implementation of ChainPort.
import type { ChainPort } from "@/shared/ports";
const ni = async (): Promise<never> => { throw new Error("NOT_IMPLEMENTED: chain"); };
export const chain: ChainPort = {
  status: async () => ({ available: false, chainId: null, blockNumber: null }),
  binding: async () => null,
  scenarios: async () => ({ protected: null, vulnerable: null }),
  executeProtected: ni, runVulnerablePurchase: ni, attemptDrain: ni,
  reset: async () => {},
};

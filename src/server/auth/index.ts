// OWNER: worker C (w/bank). Replace this stub with the real implementation of AuthPort.
import type { AuthPort } from "@/shared/ports";
const ni = (): never => { throw new Error("NOT_IMPLEMENTED: auth"); };
export const auth: AuthPort = {
  capsFromRequest: () => ({ customer: false, merchant: false, operator: false }),
  issueSession: ni, createAgreement: ni, issuePairing: ni, approve: ni, decline: ni,
  checkPairing: () => false, get: () => null, list: () => [], recordOutcome: ni,
  signerAddress: ni, reset: () => {},
};

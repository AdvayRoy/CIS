// OWNER: worker C (w/bank). Replace this stub with the real implementation of BankPort.
import type { BankPort } from "@/shared/ports";
export const bank: BankPort = {
  execute: () => { throw new Error("NOT_IMPLEMENTED: bank"); },
  accounts: () => [],
  reset: () => {},
};

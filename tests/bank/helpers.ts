import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function tempDb(): string {
  const path = join(mkdtempSync(join(tmpdir(), "cs-bank-")), "test.db");
  process.env.CS_DB_PATH = path;
  return path;
}
export const CUSTOMER = "ACC-CUSTOMER-001";
export const MERCHANT = "ACC-MERCHANT-001";
export const ATTACKER = "ACC-UNKNOWN-777";

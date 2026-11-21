// Separate OS process with its own SQLite connection: executes one attempt and prints the outcome.
import { auth } from "../../../src/server/auth";
import { bank } from "../../../src/server/bank";

const [id, recipient, amount, startAt] = process.argv.slice(2);
const wait = Number(startAt) - Date.now();
setTimeout(() => {
  const view = auth.get(id)!;
  const out = bank.execute(view, { agreementId: id, recipient, amount, operation: "bank.transfer", continuingAllowance: "0" });
  process.stdout.write(JSON.stringify({ accepted: out.decision.accepted, reason: out.decision.reason, transferId: out.evidence.receipt && out.evidence.receipt.kind === "ledger" ? out.evidence.receipt.transferId : null }));
}, Math.max(0, wait));

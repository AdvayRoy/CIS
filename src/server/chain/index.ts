// OWNER: worker D (w/crypto). ChainPort backed by a private Anvil node via viem.
// The RPC URL and executor key stay on the server; every number returned is read from the EVM.
import {
  BaseError, createPublicClient, createTestClient, createWalletClient, decodeErrorResult, decodeFunctionData,
  encodeFunctionData, http, isAddress, isAddressEqual, parseEventLogs, type Hex,
} from "viem";
import type { ChainPort, Outcome } from "@/shared/ports";
import type {
  AgreementState, AgreementView, Asset, Decision, FieldDiff, Observed, PaymentAttempt, Reason, Receipt, TokenScenario,
} from "@/shared/contract";
import { cryptoTypedData } from "../../shared/typedData";
import { CounterSignAccountAbi, DemoShopAbi, MockTokenAbi, VulnerableWalletAbi } from "./artifacts";
import { executorAccount, readDeployment, rpcUrl, writeDeployment, type Deployment } from "./config";
import { deployAll } from "./deploy";

const OPERATION = "crypto.purchase";
const ZERO = BigInt(0);
const ONE = BigInt(1);
const DEMO_ITEM_ID = ONE;
const DEMO_PRICE = BigInt("100000000000000000000");
/** Explicit gas so reverting transactions are still mined and leave a real receipt. */
const GAS = BigInt(600_000);
const ERROR_ABI = [...CounterSignAccountAbi, ...DemoShopAbi, ...MockTokenAbi, ...VulnerableWalletAbi] as const;

const REVERT_REASON: Record<string, Reason> = {
  Expired: "EXPIRED",
  NonceUsed: "REPLAYED",
  ShopMismatch: "RECIPIENT_MISMATCH",
  AmountExceedsLimit: "AMOUNT_EXCEEDS_LIMIT",
  InvalidSignature: "INVALID_SIGNATURE",
};

const transport = () => http(rpcUrl(), { timeout: 5_000, retryCount: 0 });
const pub = () => createPublicClient({ transport: transport() });
const now = () => Date.now();

function wallet(chainId: number) {
  return createWalletClient({
    account: executorAccount(),
    chain: {
      id: chainId, name: "Local-chain demo",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl()] } },
    },
    transport: transport(),
  });
}

/** Serialise every state-changing call: one executor key, one nonce sequence. */
// Kept on globalThis so separately bundled route handlers share the same queue.
const shared = globalThis as unknown as { __csChainQueue?: Promise<unknown> };
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const prev = shared.__csChainQueue ?? Promise.resolve();
  const run = prev.then(fn, fn);
  shared.__csChainQueue = run.catch(() => undefined);
  return run;
}

/** Deployment that is actually live on the connected node, else null. */
async function live(): Promise<Deployment | null> {
  const d = readDeployment();
  if (!d) return null;
  try {
    const client = pub();
    const [chainId, code] = await Promise.all([client.getChainId(), client.getCode({ address: d.account })]);
    if (chainId !== d.chainId || !code || code === "0x") return null;
    return d;
  } catch {
    return null;
  }
}

function errorName(data: Hex | undefined): string | null {
  if (!data || data === "0x") return null;
  try {
    return decodeErrorResult({ abi: ERROR_ABI, data }).errorName;
  } catch {
    return data.slice(0, 10);
  }
}

function revertDataOf(e: unknown): Hex | undefined {
  if (e instanceof BaseError) {
    const inner = e.walk((x) => typeof (x as { data?: unknown }).data === "string" || typeof (x as { data?: { data?: unknown } }).data?.data === "string");
    const d = (inner as { data?: unknown } | null)?.data;
    if (typeof d === "string" && d.startsWith("0x")) return d as Hex;
    const dd = (d as { data?: unknown } | undefined)?.data;
    if (typeof dd === "string" && dd.startsWith("0x")) return dd as Hex;
  }
  return undefined;
}

/** Decode why a mined transaction reverted by replaying it against the parent block state. */
async function revertReasonOf(tx: { from: Hex; to: Hex; input: Hex; blockNumber: bigint }): Promise<string> {
  try {
    await pub().call({ account: tx.from, to: tx.to, data: tx.input, gas: GAS, blockNumber: tx.blockNumber - ONE });
    return "reverted";
  } catch (e) {
    return errorName(revertDataOf(e)) ?? "reverted";
  }
}

/** Send with explicit gas (no simulation gate) and wait for the mined receipt. */
async function sendAndMine(d: Deployment, to: Hex, data: Hex) {
  const hash = await wallet(d.chainId).sendTransaction({ to, data, gas: GAS });
  // Once a hash exists the transaction may still be mined, so a slow receipt must not be reported as a
  // failure: keep reconciling by hash (up to ~2 minutes) before giving up.
  let receipt: Awaited<ReturnType<ReturnType<typeof pub>["waitForTransactionReceipt"]>> | null = null;
  for (let i = 0; i < 8 && !receipt; i++) {
    try {
      receipt = await pub().waitForTransactionReceipt({ hash, pollingInterval: 50, timeout: 15_000 });
    } catch (e) {
      if (i === 7) throw e;
    }
  }
  if (!receipt) throw new Error("receipt unavailable");
  const reverted = receipt.status !== "success";
  const revertReason = reverted
    ? await revertReasonOf({ from: receipt.from, to, input: data, blockNumber: receipt.blockNumber })
    : null;
  return { hash, receipt, reverted, revertReason };
}

// ---- history derived from the chain itself (blocks since deployment) ----

type Drain = NonNullable<TokenScenario["drainAttempt"]>;
interface History {
  key: string;
  scannedTo: bigint;
  scannedHash: Hex | null;
  purchaseTx: Record<string, string>;
  drain: Record<string, Drain>;
}
let history: History | null = null;

async function scan(d: Deployment): Promise<History> {
  const client = pub();
  const key = `${rpcUrl()}|${d.account}|${d.deployBlock}`;
  const start = BigInt(d.deployBlock);
  const latest = await client.getBlockNumber();
  let h = history;
  if (h && h.key === key && h.scannedHash && h.scannedTo <= latest) {
    // detect evm_revert: the block we stopped at must still be the same block
    const b = await client.getBlock({ blockNumber: h.scannedTo });
    if (b.hash !== h.scannedHash) h = null;
  } else {
    h = null;
  }
  if (!h) h = { key, scannedTo: start, scannedHash: null, purchaseTx: {}, drain: {} };
  for (let n = h.scannedTo + (h.scannedHash ? ONE : ZERO); n <= latest; n++) {
    const block = await client.getBlock({ blockNumber: n, includeTransactions: true });
    for (const tx of block.transactions) {
      if (!tx.to) continue;
      const receipt = await client.getTransactionReceipt({ hash: tx.hash });
      for (const log of parseEventLogs({ abi: DemoShopAbi, logs: receipt.logs, eventName: "Purchased" })) {
        if (isAddressEqual(log.address, d.shop)) h.purchaseTx[log.args.buyer.toLowerCase()] = tx.hash;
      }
      if (isAddressEqual(tx.to, d.shop)) {
        try {
          const call = decodeFunctionData({ abi: DemoShopAbi, data: tx.input });
          if (call.functionName === "sweep") {
            const [from, amount] = call.args;
            const succeeded = receipt.status === "success";
            h.drain[from.toLowerCase()] = {
              txHash: tx.hash, succeeded, amountRequested: amount.toString(),
              revertReason: succeeded ? null : await revertReasonOf({ from: tx.from, to: tx.to, input: tx.input, blockNumber: n }),
            };
          }
        } catch { /* not a shop call we know */ }
      }
    }
    h.scannedTo = n;
    h.scannedHash = block.hash;
  }
  if (!h.scannedHash) {
    const b = await client.getBlock({ blockNumber: h.scannedTo });
    h.scannedHash = b.hash;
  }
  history = h;
  return h;
}

async function readScenario(d: Deployment, label: "protected" | "vulnerable"): Promise<TokenScenario> {
  const client = pub();
  const customer = label === "protected" ? d.account : d.vulnerable;
  const erc20 = { address: d.token, abi: MockTokenAbi } as const;
  const [customerBalance, shopBalance, attackerBalance, allowance, count, h] = await Promise.all([
    client.readContract({ ...erc20, functionName: "balanceOf", args: [customer] }),
    client.readContract({ ...erc20, functionName: "balanceOf", args: [d.shop] }),
    client.readContract({ ...erc20, functionName: "balanceOf", args: [d.attacker] }),
    client.readContract({ ...erc20, functionName: "allowance", args: [customer, d.shop] }),
    client.readContract({ address: d.shop, abi: DemoShopAbi, functionName: "purchaseCount", args: [customer] }),
    scan(d),
  ]);
  return {
    label, customer, shop: d.shop,
    customerBalance: customerBalance.toString(), shopBalance: shopBalance.toString(),
    attackerBalance: attackerBalance.toString(), allowance: allowance.toString(),
    purchased: count > ZERO,
    lastPurchaseTx: h.purchaseTx[customer.toLowerCase()] ?? null,
    drainAttempt: h.drain[customer.toLowerCase()] ?? null,
  };
}

async function observe(d: Deployment | null, view: AgreementView): Promise<Observed> {
  const zero: Observed = { payerBalance: "0", recipientBalance: "0", allowance: null, executionCount: 0, observedAt: now() };
  if (!d) return zero;
  try {
    const client = pub();
    const erc20 = { address: d.token, abi: MockTokenAbi } as const;
    const recipient = isAddress(view.agreement.recipient) ? (view.agreement.recipient as Hex) : d.shop;
    const [payerBalance, recipientBalance, allowance, used] = await Promise.all([
      client.readContract({ ...erc20, functionName: "balanceOf", args: [d.account] }),
      client.readContract({ ...erc20, functionName: "balanceOf", args: [recipient] }),
      client.readContract({ ...erc20, functionName: "allowance", args: [d.account, recipient] }),
      client.readContract({ address: d.account, abi: CounterSignAccountAbi, functionName: "nonceUsed", args: [BigInt(view.agreement.nonce)] }),
    ]);
    return {
      payerBalance: payerBalance.toString(), recipientBalance: recipientBalance.toString(),
      allowance: allowance.toString(), executionCount: used ? 1 : 0, observedAt: now(),
    };
  } catch {
    return zero;
  }
}

/** Advisory comparison of the untrusted attempt with the approved facts. The contract is the enforcement. */
function precheck(view: AgreementView, attempt: PaymentAttempt, d: Deployment | null): { diffs: FieldDiff[]; reason: Reason } {
  const a = view.agreement;
  const diffs: FieldDiff[] = [];
  let reason: Reason = "OK";
  const flag = (r: Reason, diff: FieldDiff) => { diffs.push(diff); if (reason === "OK") reason = r; };
  const sameRecipient = isAddress(a.recipient) && isAddress(attempt.recipient)
    ? isAddressEqual(a.recipient, attempt.recipient) : a.recipient === attempt.recipient;
  if (!sameRecipient) flag("RECIPIENT_MISMATCH", { field: "recipient", approved: a.recipient, attempted: attempt.recipient });
  if (BigInt(attempt.amount) > BigInt(a.amount)) flag("AMOUNT_EXCEEDS_LIMIT", { field: "amount", approved: a.amount, attempted: attempt.amount });
  if (attempt.operation !== OPERATION || a.operation !== OPERATION)
    flag("OPERATION_NOT_ALLOWED", { field: "operation", approved: a.operation, attempted: attempt.operation });
  if ((attempt.continuingAllowance ?? "0") !== "0")
    flag("CONTINUING_PERMISSION_NOT_ALLOWED", { field: "continuingAllowance", approved: "0", attempted: attempt.continuingAllowance });
  if (d && a.domain && (a.domain.chainId !== d.chainId || !isAddressEqual(a.domain.verifyingContract as Hex, d.account)))
    flag("DOMAIN_MISMATCH", {
      field: "domain", approved: `${a.domain.chainId}:${a.domain.verifyingContract}`, attempted: `${d.chainId}:${d.account}`,
    });
  return { diffs, reason };
}

async function executeProtected(view: AgreementView, attempt: PaymentAttempt): Promise<Outcome> {
  const d = await live();
  const a = view.agreement;
  const pre = precheck(view, attempt, d);
  const finish = async (
    accepted: boolean, reason: Reason, state: AgreementState, receipt: Receipt | null, diffs: FieldDiff[] = pre.diffs,
  ): Promise<Outcome> => {
    const decision: Decision = { accepted, reason, diffs: accepted ? [] : diffs, decidedAt: now() };
    const observed = await observe(d, view);
    return { decision, state, evidence: { agreement: a, attempt, decision, receipt, observed } };
  };

  if (a.rail !== "crypto") return finish(false, "RAIL_MISMATCH", "rejected", null);
  if (!d) return finish(false, "RAIL_UNAVAILABLE", "failed", null);
  if (view.state === "declined") return finish(false, "DECLINED", "declined", null);
  const sig = view.approval?.signature;
  if (!sig || !/^0x[0-9a-fA-F]*$/.test(sig)) return finish(false, "NOT_APPROVED", view.state, null);
  if (!a.domain || !a.asset.address) return finish(false, "DOMAIN_MISMATCH", "rejected", null);
  // The adapter has exactly one operation and never leaves an allowance. An attempt asking for anything
  // else cannot be expressed as a call to it, so nothing is submitted.
  if (attempt.operation !== OPERATION || a.operation !== OPERATION) return finish(false, "OPERATION_NOT_ALLOWED", "rejected", null);
  if ((attempt.continuingAllowance ?? "0") !== "0") return finish(false, "CONTINUING_PERMISSION_NOT_ALLOWED", "rejected", null);
  if (!isAddress(attempt.recipient)) return finish(false, "RECIPIENT_MISMATCH", "rejected", null);

  // Everything else goes to the chain with the ATTEMPTED shop and price. The contract decides.
  const message = cryptoTypedData(a).message;
  const data = encodeFunctionData({
    abi: CounterSignAccountAbi, functionName: "executePurchase",
    args: [message, sig as Hex, attempt.recipient as Hex, BigInt(attempt.amount)],
  });
  return serial(async () => {
    let sent: Awaited<ReturnType<typeof sendAndMine>>;
    try {
      sent = await sendAndMine(d, d.account, data);
    } catch {
      return finish(false, "RAIL_UNAVAILABLE", "failed", null);
    }
    const receipt: Receipt = {
      kind: "chain", chainId: d.chainId, txHash: sent.hash, blockNumber: sent.receipt.blockNumber.toString(),
      status: sent.reverted ? "reverted" : "success", revertReason: sent.revertReason,
    };
    if (!sent.reverted) return finish(true, "OK", "settled", receipt);

    let reason: Reason = REVERT_REASON[sent.revertReason ?? ""] ?? "EXECUTION_REVERTED";
    if (reason === "INVALID_SIGNATURE" && pre.reason === "DOMAIN_MISMATCH") reason = "DOMAIN_MISMATCH";
    const diffs = [...pre.diffs];
    if (reason === "EXPIRED" && !diffs.some((x) => x.field === "expiry"))
      diffs.push({ field: "expiry", approved: String(a.expiry), attempted: String(Math.floor(now() / 1000)) });
    if (reason === "REPLAYED" && !diffs.some((x) => x.field === "nonce"))
      diffs.push({ field: "nonce", approved: a.nonce, attempted: a.nonce });
    // A replay is refused, but the first purchase stays settled on-chain.
    const state: AgreementState = reason === "REPLAYED" ? "settled" : reason === "EXPIRED" ? "expired" : "rejected";
    return finish(false, reason, state, receipt, diffs);
  });
}

async function requireLive(): Promise<Deployment> {
  const d = await live();
  if (!d) throw new Error("RAIL_UNAVAILABLE: local chain or deployment missing");
  return d;
}

export const chain: ChainPort = {
  async status() {
    try {
      const d = await live();
      if (!d) return { available: false, chainId: null, blockNumber: null };
      const blockNumber = await pub().getBlockNumber();
      return { available: true, chainId: d.chainId, blockNumber: blockNumber.toString() };
    } catch {
      return { available: false, chainId: null, blockNumber: null };
    }
  },

  async binding() {
    const d = await live();
    if (!d) return null;
    const token: Asset = { code: "CSUSD", decimals: 18, address: d.token };
    return { chainId: d.chainId, verifyingContract: d.account, token, payer: d.account, shop: d.shop };
  },

  async scenarios() {
    try {
      const d = await live();
      if (!d) return { protected: null, vulnerable: null };
      const p = await readScenario(d, "protected");
      const v = await readScenario(d, "vulnerable");
      return { protected: p, vulnerable: v };
    } catch {
      return { protected: null, vulnerable: null };
    }
  },

  executeProtected,

  /** INTENTIONALLY VULNERABLE comparison: unlimited approve + purchase, allowance left behind. */
  async runVulnerablePurchase() {
    const d = await requireLive();
    return serial(async () => {
      const data = encodeFunctionData({
        abi: VulnerableWalletAbi, functionName: "buy", args: [d.token, d.shop, DEMO_ITEM_ID, DEMO_PRICE],
      });
      await sendAndMine(d, d.vulnerable, data);
      return readScenario(d, "vulnerable");
    });
  },

  /** The shop's later drain: sweep the customer's full remaining balance. Really sent, in both cases. */
  async attemptDrain(which) {
    const d = await requireLive();
    return serial(async () => {
      const customer = which === "protected" ? d.account : d.vulnerable;
      const balance = await pub().readContract({ address: d.token, abi: MockTokenAbi, functionName: "balanceOf", args: [customer] });
      const data = encodeFunctionData({ abi: DemoShopAbi, functionName: "sweep", args: [customer, balance] });
      await sendAndMine(d, d.shop, data);
      return readScenario(d, which);
    });
  },

  async reset() {
    await serial(async () => {
      history = null;
      const d = await live();
      if (d) {
        const test = createTestClient({ mode: "anvil", transport: transport() });
        try {
          const ok = (await test.request({ method: "evm_revert", params: [d.snapshotId as Hex] })) as unknown as boolean;
          if (ok) {
            const snapshotId = await test.snapshot();
            writeDeployment({ ...d, snapshotId });
            return;
          }
        } catch { /* fall through to redeploy */ }
      }
      await deployAll();
    });
  },
};

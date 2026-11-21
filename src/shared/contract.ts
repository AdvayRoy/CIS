/**
 * CounterSign shared contract. FROZEN at base commit; only the lead edits this file.
 * All amounts are integer base/minor units serialized as decimal strings.
 */
import { z } from "zod";

export const RAILS = ["bank", "crypto"] as const;
export const RailSchema = z.enum(RAILS);
export type Rail = z.infer<typeof RailSchema>;

export const AmountSchema = z.string().regex(/^(0|[1-9][0-9]{0,77})$/, "integer base units as decimal string");

export const STATES = [
  "awaiting_approval", "approved", "executing", "rejected",
  "settled", "declined", "expired", "failed",
] as const;
export const StateSchema = z.enum(STATES);
export type AgreementState = z.infer<typeof StateSchema>;

/** Operations a rail supports. Exactly one is bound into an agreement. */
export const OPERATIONS = ["bank.transfer", "crypto.purchase"] as const;
export const OperationSchema = z.enum(OPERATIONS);
export type Operation = z.infer<typeof OperationSchema>;

export const AssetSchema = z.object({
  code: z.string().min(1).max(12),      // "AED" | "CSUSD"
  decimals: z.number().int().min(0).max(36),
  /** token contract address for crypto, null for bank */
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/).nullable(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const PaymentAgreementSchema = z.object({
  id: z.string().uuid(),
  /** payer identifier: bank account id (e.g. "ACC-CUSTOMER-001") or 0x smart-account address */
  payer: z.string().min(1),
  /** exact recipient identifier: bank account id or 0x address of the purchase contract */
  recipient: z.string().min(1),
  /** display only; never treated as verified identity */
  recipientDisplayName: z.string().max(80),
  rail: RailSchema,
  asset: AssetSchema,
  /** bank: exact debit. crypto: maximum token debit for the purchase. */
  amount: AmountSchema,
  operation: OperationSchema,
  /** crypto only: item identifier passed to the purchase contract */
  itemId: z.string().nullable(),
  /** unix seconds */
  expiry: z.number().int().positive(),
  /** decimal string; single use */
  nonce: z.string().regex(/^[0-9]{1,78}$/),
  /** crypto: EIP-712 domain binding. bank: null. */
  domain: z.object({
    chainId: z.number().int(),
    verifyingContract: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  }).nullable(),
  createdAt: z.number().int(),
});
export type PaymentAgreement = z.infer<typeof PaymentAgreementSchema>;

/** What the merchant/lab may propose. Server fills id, nonce, createdAt, domain, asset. */
export const AgreementDraftSchema = z.object({
  rail: RailSchema,
  recipient: z.string().min(1),
  recipientDisplayName: z.string().max(80),
  amount: AmountSchema,
  itemId: z.string().nullable().optional(),
  /** seconds from now; server clamps to [5, 900] */
  ttlSeconds: z.number().int().min(1).max(900).optional(),
});
export type AgreementDraft = z.infer<typeof AgreementDraftSchema>;

/** What an executor actually asks for. Untrusted input. */
export const PaymentAttemptSchema = z.object({
  agreementId: z.string().uuid(),
  recipient: z.string().min(1),
  amount: AmountSchema,
  operation: z.string().min(1),
  /** continuing permissions requested beyond this payment, e.g. residual allowance. "0" = none. */
  continuingAllowance: AmountSchema.default("0"),
});
export type PaymentAttempt = z.infer<typeof PaymentAttemptSchema>;

export const REASONS = [
  "OK",
  "NOT_FOUND",
  "NOT_APPROVED",
  "DECLINED",
  "INVALID_SIGNATURE",
  "EXPIRED",
  "REPLAYED",
  "RECIPIENT_MISMATCH",
  "AMOUNT_MISMATCH",
  "AMOUNT_EXCEEDS_LIMIT",
  "OPERATION_NOT_ALLOWED",
  "CONTINUING_PERMISSION_NOT_ALLOWED",
  "RAIL_MISMATCH",
  "DOMAIN_MISMATCH",
  "INSUFFICIENT_FUNDS",
  "EXECUTION_REVERTED",
  "UNAUTHORIZED_CAPABILITY",
  "RAIL_UNAVAILABLE",
] as const;
export const ReasonSchema = z.enum(REASONS);
export type Reason = z.infer<typeof ReasonSchema>;

export const FieldDiffSchema = z.object({
  field: z.enum(["recipient", "amount", "operation", "continuingAllowance", "expiry", "nonce", "domain"]),
  approved: z.string(),
  attempted: z.string(),
});
export type FieldDiff = z.infer<typeof FieldDiffSchema>;

export const DecisionSchema = z.object({
  accepted: z.boolean(),
  reason: ReasonSchema,
  diffs: z.array(FieldDiffSchema),
  decidedAt: z.number().int(),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const LedgerReceiptSchema = z.object({
  kind: z.literal("ledger"),
  transferId: z.string(),
  debitAccount: z.string(),
  creditAccount: z.string(),
  amount: AmountSchema,
  postedAt: z.number().int(),
});
export const ChainReceiptSchema = z.object({
  kind: z.literal("chain"),
  chainId: z.number().int(),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  blockNumber: z.string(),
  status: z.enum(["success", "reverted"]),
  revertReason: z.string().nullable(),
});
export const ReceiptSchema = z.discriminatedUnion("kind", [LedgerReceiptSchema, ChainReceiptSchema]);
export type Receipt = z.infer<typeof ReceiptSchema>;

/** Balances/allowance as READ from the ledger or EVM after the attempt. */
export const ObservedSchema = z.object({
  payerBalance: AmountSchema,
  recipientBalance: AmountSchema,
  /** crypto: token allowance payer -> recipient. bank: null */
  allowance: AmountSchema.nullable(),
  /** number of successful debits recorded against this agreement */
  executionCount: z.number().int(),
  observedAt: z.number().int(),
});
export type Observed = z.infer<typeof ObservedSchema>;

export const ExecutionEvidenceSchema = z.object({
  agreement: PaymentAgreementSchema,
  attempt: PaymentAttemptSchema,
  decision: DecisionSchema,
  receipt: ReceiptSchema.nullable(),
  observed: ObservedSchema,
});
export type ExecutionEvidence = z.infer<typeof ExecutionEvidenceSchema>;

export const EVENT_TYPES = [
  "agreement.created", "pairing.issued", "agreement.approved", "agreement.declined",
  "agreement.expired", "attempt.received", "attempt.rejected", "execution.started",
  "execution.settled", "execution.failed",
] as const;
export const EventSchema = z.object({
  seq: z.number().int(),          // strictly increasing per server
  agreementId: z.string().uuid(),
  type: z.enum(EVENT_TYPES),
  at: z.number().int(),           // unix ms
  reason: ReasonSchema.nullable(),
});
export type AgreementEvent = z.infer<typeof EventSchema>;

export const ApprovalSchema = z.object({
  signer: z.string(),             // 0x address of the demo customer signer
  signature: z.string(),          // EIP-712 signature over the agreement (see typedData.ts)
  approvedAt: z.number().int(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

/** Authoritative view returned by GET /api/agreements/[id]. */
export const AgreementViewSchema = z.object({
  agreement: PaymentAgreementSchema,
  state: StateSchema,
  approval: ApprovalSchema.nullable(),
  events: z.array(EventSchema),
  /** every attempt, accepted or not, in order */
  evidence: z.array(ExecutionEvidenceSchema),
  executionCount: z.number().int(),
});
export type AgreementView = z.infer<typeof AgreementViewSchema>;

export const TokenScenarioSchema = z.object({
  label: z.enum(["protected", "vulnerable"]),
  customer: z.string(),
  shop: z.string(),
  customerBalance: AmountSchema,
  shopBalance: AmountSchema,
  attackerBalance: AmountSchema,
  /** token.allowance(customer, shop) read from the EVM */
  allowance: AmountSchema,
  purchased: z.boolean(),
  lastPurchaseTx: z.string().nullable(),
  drainAttempt: z.object({
    txHash: z.string().nullable(),
    succeeded: z.boolean(),
    revertReason: z.string().nullable(),
    amountRequested: AmountSchema,
  }).nullable(),
});
export type TokenScenario = z.infer<typeof TokenScenarioSchema>;

export const OverviewSchema = z.object({
  serverTime: z.number().int(),
  labels: z.object({ bank: z.literal("Bank simulation"), chain: z.literal("Local-chain demo") }),
  bank: z.object({
    available: z.boolean(),
    accounts: z.array(z.object({ id: z.string(), displayName: z.string(), balance: AmountSchema, asset: AssetSchema })),
  }),
  chain: z.object({
    available: z.boolean(),
    chainId: z.number().int().nullable(),
    blockNumber: z.string().nullable(),
    token: AssetSchema.nullable(),
    protected: TokenScenarioSchema.nullable(),
    vulnerable: TokenScenarioSchema.nullable(),
  }),
  agreements: z.array(AgreementViewSchema),
});
export type Overview = z.infer<typeof OverviewSchema>;

export const ApiErrorSchema = z.object({ error: z.object({ code: ReasonSchema.or(z.literal("BAD_REQUEST")), message: z.string() }) });
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const BANK_ASSET: Asset = { code: "AED", decimals: 2, address: null };
export const BANK_ACCOUNTS = {
  customer: "ACC-CUSTOMER-001",
  merchant: "ACC-MERCHANT-001",
  attacker: "ACC-UNKNOWN-777",
} as const;
export const TOKEN_DECIMALS = 18;
export const TOKEN_CODE = "CSUSD";

/** Format integer base units for display without floating point. */
export function formatUnitsStr(amount: string, decimals: number): string {
  const neg = amount.startsWith("-");
  const s = (neg ? amount.slice(1) : amount).padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = decimals ? s.slice(s.length - decimals).replace(/0+$/, "") : "";
  return (neg ? "-" : "") + whole + (frac ? "." + frac : "");
}

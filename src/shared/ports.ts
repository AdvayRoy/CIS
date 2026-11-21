/**
 * Server-side ports. API routes (lead-owned) call ONLY these.
 * Worker C implements AuthPort + BankPort; worker D implements ChainPort.
 * FROZEN; lead-owned.
 */
import type {
  AgreementDraft, AgreementView, Decision, ExecutionEvidence, PaymentAttempt,
  AgreementState, Overview, TokenScenario, Asset,
} from "./contract";

export type Role = "customer" | "merchant" | "operator";
export type Caps = Record<Role, boolean>;

export interface Outcome { decision: Decision; evidence: ExecutionEvidence; state: AgreementState }

export interface AuthPort {
  /** Derive capabilities from signed HttpOnly session cookies on the request. Never from query/body. */
  capsFromRequest(req: Request): Caps;
  /** Demo sign-in: exchange a role key (env) for a signed session cookie. null = wrong key. */
  issueSession(role: Role, key: string): { cookie: string } | null;
  /** merchant capability. Server fills id/nonce/expiry/domain/asset/payer. */
  createAgreement(draft: AgreementDraft, domain: { chainId: number; verifyingContract: string; token: Asset; payer: string } | null): AgreementView;
  /** customer capability. Short-lived single-agreement pairing token for /approve/[id]. */
  issuePairing(id: string): { token: string; expiresAt: number };
  /** Requires a valid pairing token for THIS agreement. Signs the EIP-712 agreement with the isolated demo signer. */
  approve(id: string, pairingToken: string): AgreementView;
  decline(id: string, pairingToken: string): AgreementView;
  /** true iff pairing token is valid for id (lets /approve render facts). */
  checkPairing(id: string, pairingToken: string): boolean;
  get(id: string): AgreementView | null;      // also lazily flips awaiting_approval/approved -> expired
  list(): AgreementView[];
  /** Persist a crypto outcome (bank outcomes are persisted atomically inside BankPort.execute). */
  recordOutcome(id: string, outcome: Outcome): AgreementView;
  /** address of the demo customer signer (owner of the on-chain account) */
  signerAddress(): string;
  reset(): void;
}

export interface BankPort {
  /** Validate signature+terms, consume authorization and move money in ONE SQLite transaction. Idempotent on replay. */
  execute(view: AgreementView, attempt: PaymentAttempt): Outcome;
  accounts(): Overview["bank"]["accounts"];
  reset(): void;
}

export interface ChainPort {
  /** never throws; available=false when Anvil/deployment is missing */
  status(): Promise<{ available: boolean; chainId: number | null; blockNumber: string | null }>;
  /** addresses needed to build a crypto agreement; null when unavailable */
  binding(): Promise<{ chainId: number; verifyingContract: string; token: Asset; payer: string; shop: string } | null>;
  scenarios(): Promise<{ protected: TokenScenario | null; vulnerable: TokenScenario | null }>;
  /** Submit the constrained purchase through the on-chain adapter. Returns real receipt + EVM-read balances/allowance. */
  executeProtected(view: AgreementView, attempt: PaymentAttempt): Promise<Outcome>;
  /** Intentionally vulnerable comparison: unlimited approve + purchase from an unprotected account. */
  runVulnerablePurchase(): Promise<TokenScenario>;
  /** Actually send the shop's later transferFrom drain for the given scenario. */
  attemptDrain(which: "protected" | "vulnerable"): Promise<TokenScenario>;
  /** Redeploy / revert to the deterministic snapshot: 1,000 tokens each, zero allowances. */
  reset(): Promise<void>;
}

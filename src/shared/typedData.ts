/**
 * EIP-712 binding of the approved facts. Signed with viem by the trusted demo
 * customer signer; verified by the bank simulation (viem) and by the
 * on-chain adapter (Solidity, crypto rail). FROZEN; lead-owned.
 */
import { keccak256, toBytes, type Hex } from "viem";
import type { PaymentAgreement } from "./contract";

export const BANK_DOMAIN = { name: "CounterSign Bank Simulation", version: "1" } as const;
export const BANK_TYPES = {
  BankAgreement: [
    { name: "agreementId", type: "string" },
    { name: "payer", type: "string" },
    { name: "recipient", type: "string" },
    { name: "asset", type: "string" },
    { name: "amount", type: "uint256" },
    { name: "operation", type: "string" },
    { name: "expiry", type: "uint64" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export function bankTypedData(a: PaymentAgreement) {
  return {
    domain: BANK_DOMAIN,
    types: BANK_TYPES,
    primaryType: "BankAgreement" as const,
    message: {
      agreementId: a.id, payer: a.payer, recipient: a.recipient, asset: a.asset.code,
      amount: BigInt(a.amount), operation: a.operation, expiry: BigInt(a.expiry), nonce: BigInt(a.nonce),
    },
  };
}

/** Solidity side must use: EIP712("CounterSign", "1") and this exact struct. */
export const CRYPTO_DOMAIN_NAME = "CounterSign";
export const CRYPTO_DOMAIN_VERSION = "1";
export const CRYPTO_TYPES = {
  PurchaseAgreement: [
    { name: "agreementId", type: "bytes32" },
    { name: "token", type: "address" },
    { name: "shop", type: "address" },
    { name: "itemId", type: "uint256" },
    { name: "maxAmount", type: "uint256" },
    { name: "expiry", type: "uint64" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const agreementIdToBytes32 = (id: string): Hex => keccak256(toBytes(id));

export function cryptoTypedData(a: PaymentAgreement) {
  if (!a.domain || !a.asset.address) throw new Error("crypto agreement requires domain and token address");
  return {
    domain: {
      name: CRYPTO_DOMAIN_NAME, version: CRYPTO_DOMAIN_VERSION,
      chainId: a.domain.chainId, verifyingContract: a.domain.verifyingContract as Hex,
    },
    types: CRYPTO_TYPES,
    primaryType: "PurchaseAgreement" as const,
    message: {
      agreementId: agreementIdToBytes32(a.id), token: a.asset.address as Hex, shop: a.recipient as Hex,
      itemId: BigInt(a.itemId ?? "0"), maxAmount: BigInt(a.amount), expiry: BigInt(a.expiry), nonce: BigInt(a.nonce),
    },
  };
}

export const typedDataFor = (a: PaymentAgreement) => (a.rail === "bank" ? bankTypedData(a) : cryptoTypedData(a));

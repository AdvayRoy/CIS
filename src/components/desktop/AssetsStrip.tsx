"use client";
import Link from "next/link";
import { ArrowUpRight, Landmark, Coins, ShieldCheck } from "lucide-react";
import type { Overview } from "@/shared/contract";
import { BANK_ACCOUNTS } from "@/shared/contract";
import { CountUp } from "@/components/fx/CountUp";
import { LABEL, fmtAmount } from "./format";
import { Ident } from "./ui";

// Customer's balances, read from the authoritative state. No derived or estimated figures.
export function AssetsStrip({ overview, bankLabel, chainLabel, payLabel, protectedRail }: { overview: Overview; bankLabel: string; chainLabel: string; payLabel: string; protectedRail?: "bank" | "crypto" | null }) {
  const acc = overview.bank.accounts.find((a) => a.id === BANK_ACCOUNTS.customer);
  const tok = overview.chain.available ? overview.chain.protected : null;
  const token = overview.chain.token;
  return (
    <section aria-label="assets" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <div className={`min-w-0 rounded-[16px] border bg-surface p-5 transition-colors duration-300 ${protectedRail === "bank" ? "border-mint/50" : "border-line"}`}>
        <p className={`${LABEL} flex items-center gap-2`}><Landmark aria-hidden className="size-3.5" />AED<span aria-hidden>·</span>{bankLabel}{protectedRail === "bank" && <ShieldCheck aria-hidden className="ms-auto size-4 text-mint" />}</p>
        <p className={`ticker mt-3 truncate text-[32px] leading-none font-semibold ${protectedRail === "bank" ? "text-mint" : ""}`}>
          {acc ? <CountUp value={acc.balance} format={(v) => fmtAmount(v, acc.asset.decimals)} /> : "—"}
          <span className="ms-2 text-sm font-normal text-muted">AED</span>
        </p>
        {acc && <Ident value={acc.id} className="mt-2.5 block truncate text-[11px] text-muted" />}
      </div>
      <div className={`min-w-0 rounded-[16px] border bg-surface p-5 transition-colors duration-300 ${protectedRail === "crypto" ? "border-mint/50" : "border-line"}`}>
        <p className={`${LABEL} flex items-center gap-2`}><Coins aria-hidden className="size-3.5" />{token?.code ?? "CSUSD"}<span aria-hidden>·</span>{chainLabel}{protectedRail === "crypto" && <ShieldCheck aria-hidden className="ms-auto size-4 text-mint" />}</p>
        <p className={`ticker mt-3 truncate text-[32px] leading-none font-semibold ${protectedRail === "crypto" ? "text-mint" : ""}`}>
          {tok && token ? <CountUp value={tok.customerBalance} format={(v) => fmtAmount(v, token.decimals)} /> : "—"}
          <span className="ms-2 text-sm font-normal text-muted">{token?.code ?? "CSUSD"}</span>
        </p>
        {tok && <Ident value={tok.customer} display={`${tok.customer.slice(0, 10)}…${tok.customer.slice(-8)}`} className="mt-2.5 block truncate text-[11px] text-muted" />}
      </div>
      <Link href="/shop" className="btn-primary flex flex-col items-start justify-between rounded-[16px] p-5 text-sm">
        <ArrowUpRight aria-hidden className="size-5 rtl:-scale-x-100" />
        <span className="mt-4 whitespace-nowrap">{payLabel}</span>
      </Link>
    </section>
  );
}

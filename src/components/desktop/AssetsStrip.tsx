"use client";
import Link from "next/link";
import { ArrowUpRight, Landmark, Coins } from "lucide-react";
import type { Overview } from "@/shared/contract";
import { BANK_ACCOUNTS } from "@/shared/contract";
import { CountUp } from "@/components/fx/CountUp";
import { fmtAmount } from "./format";
import { Ident } from "./ui";

// Customer's balances, read from the authoritative state. No derived or estimated figures.
export function AssetsStrip({ overview, bankLabel, chainLabel, payLabel }: { overview: Overview; bankLabel: string; chainLabel: string; payLabel: string }) {
  const acc = overview.bank.accounts.find((a) => a.id === BANK_ACCOUNTS.customer);
  const tok = overview.chain.available ? overview.chain.protected : null;
  const token = overview.chain.token;
  return (
    <section aria-label="assets" className="grid grid-cols-[1fr_1fr_auto] gap-4">
      <div className="min-w-0 rounded-[16px] border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-xs text-muted"><Landmark aria-hidden className="size-3.5" />AED<span aria-hidden>·</span>{bankLabel}</p>
        <p className="ticker mt-2 truncate text-3xl font-semibold">
          {acc ? <CountUp value={acc.balance} format={(v) => fmtAmount(v, acc.asset.decimals)} /> : "—"}
          <span className="ms-2 text-sm font-normal text-muted">AED</span>
        </p>
        {acc && <Ident value={acc.id} className="mt-1 block truncate text-[11px] text-muted" />}
      </div>
      <div className="min-w-0 rounded-[16px] border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-xs text-muted"><Coins aria-hidden className="size-3.5" />{token?.code ?? "CSUSD"}<span aria-hidden>·</span>{chainLabel}</p>
        <p className="ticker mt-2 truncate text-3xl font-semibold">
          {tok && token ? <CountUp value={tok.customerBalance} format={(v) => fmtAmount(v, token.decimals)} /> : "—"}
          <span className="ms-2 text-sm font-normal text-muted">{token?.code ?? "CSUSD"}</span>
        </p>
        {tok && <Ident value={tok.customer} display={`${tok.customer.slice(0, 10)}…${tok.customer.slice(-8)}`} className="mt-1 block truncate text-[11px] text-muted" />}
      </div>
      <Link href="/shop" className="btn-primary flex flex-col items-start justify-between rounded-[16px] p-5 text-sm">
        <ArrowUpRight aria-hidden className="size-5 rtl:-scale-x-100" />
        <span className="mt-4 whitespace-nowrap">{payLabel}</span>
      </Link>
    </section>
  );
}

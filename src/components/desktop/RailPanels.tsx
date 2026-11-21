"use client";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import type { Asset, Overview, TokenScenario } from "@/shared/contract";
import { cn } from "@/lib/cn";
import { fmtAmount, fmtAsset, short, type Tone } from "./format";
import { Ident, Notice, Panel, Pill } from "./ui";

/** Fixed scenario start from docs/CONTRACT.md: each account starts with 1,000 tokens. */
const scenarioStart = (asset: Asset) => `1000${"0".repeat(asset.decimals)}`;
const MAX_UINT = (BigInt(1) << BigInt(256)) - BigInt(1);

function Stat({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-2 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("tabular min-w-0 truncate", tone === "mint" && "text-mint", tone === "coral" && "text-coral")}>{value}</dd>
    </div>
  );
}

function Scenario({ s, token }: { s: TokenScenario; token: Asset }) {
  const t = useTranslations("desktop");
  const vulnerable = s.label === "vulnerable";
  const unlimited = BigInt(s.allowance) >= MAX_UINT / BigInt(2);
  const allowance = unlimited ? t("chain.unlimited") : fmtAsset(s.allowance, token);
  const d = s.drainAttempt;
  return (
    <div className={cn("min-w-0 rounded-[20px] border bg-white/[0.04] p-5", vulnerable ? "border-dashed border-coral/40" : "border-line")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t(`chain.${s.label}.title`)}</h3>
        <Pill tone={s.purchased ? (vulnerable ? "amber" : "mint") : "muted"}>{s.purchased ? t("chain.purchased") : t("chain.notPurchased")}</Pill>
      </div>
      <p className={cn("mt-1 text-xs", vulnerable ? "text-coral" : "text-muted")}>{t(`chain.${s.label}.note`)}</p>
      <div className="mt-4 flex items-end gap-3">
        <div>
          <p className="text-[11px] text-muted">{t("chain.start")}</p>
          <p className="tabular text-lg text-muted">{fmtAmount(scenarioStart(token), token.decimals)}</p>
        </div>
        <span aria-hidden className="pb-1 text-muted rtl:rotate-180">→</span>
        <div className="min-w-0">
          <p className="text-[11px] text-muted">{t("chain.now")}</p>
          <motion.p key={s.customerBalance} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
            className="tabular truncate text-3xl font-medium tracking-tight">{fmtAmount(s.customerBalance, token.decimals)}
            <span className="ms-1.5 text-sm font-normal text-muted">{token.code}</span></motion.p>
        </div>
      </div>
      <dl className="mt-3">
        <Stat label={t("chain.allowance")} value={allowance} tone={s.purchased ? (s.allowance === "0" ? "mint" : "coral") : undefined} />
        <Stat label={t("chain.shopBalance")} value={fmtAsset(s.shopBalance, token)} />
        <Stat label={t("chain.attackerBalance")} value={fmtAsset(s.attackerBalance, token)} tone={s.attackerBalance !== "0" ? "coral" : undefined} />
      </dl>
      <div className={cn("mt-2 rounded-lg border px-3 py-2.5 text-[13px]", !d ? "border-line text-muted" : d.succeeded ? "border-coral/50 bg-coral/10" : "border-mint/40 bg-mint/5")}>
        <p className="text-[11px] text-muted">{t("chain.drain")}</p>
        {!d ? <p>{t("chain.drainNone")}</p> : (<>
          <p className={cn("font-medium", d.succeeded ? "text-coral" : "text-mint")}>
            {d.succeeded ? t("chain.drainSucceeded", { amount: fmtAsset(d.amountRequested, token) }) : t("chain.drainFailed", { amount: fmtAsset(d.amountRequested, token) })}
          </p>
          {d.revertReason && <Ident value={d.revertReason} className="mt-1 block text-[11px] text-muted" />}
          {d.txHash && <Ident value={d.txHash} display={short(d.txHash, 10, 8)} className="mt-1 block text-[11px] text-muted" />}
        </>)}
      </div>
      <p className="mt-3 truncate text-[11px] text-muted">{t("chain.account")} <Ident value={s.customer} display={short(s.customer)} className="text-[11px]" /></p>
    </div>
  );
}

export function ChainPanel({ chain, label }: { chain: Overview["chain"]; label: string }) {
  const t = useTranslations("desktop");
  return (
    <Panel id="chain" title={t("chain.title")} aside={
      <span className="flex items-center gap-3 text-xs text-muted">
        {chain.available && chain.blockNumber !== null && <span className="tabular">{t("chain.block", { block: chain.blockNumber })}</span>}
        <span className="rounded-full border border-line px-2 py-0.5">{label}</span>
      </span>}>
      {!chain.available ? <Notice tone="amber">{t("chain.unavailable")}</Notice>
        : !chain.token || (!chain.protected && !chain.vulnerable) ? <Notice>{t("chain.noScenario")}</Notice> : (
          <div className="grid grid-cols-2 gap-4">
            {chain.protected ? <Scenario s={chain.protected} token={chain.token} /> : <Notice>{t("chain.noScenario")}</Notice>}
            {chain.vulnerable ? <Scenario s={chain.vulnerable} token={chain.token} /> : <Notice>{t("chain.noScenario")}</Notice>}
          </div>
        )}
    </Panel>
  );
}

export function BankPanel({ bank, label }: { bank: Overview["bank"]; label: string }) {
  const t = useTranslations("desktop");
  return (
    <Panel id="bank" title={t("bank.title")} aside={<span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{label}</span>}>
      {!bank.available ? <Notice tone="amber">{t("bank.unavailable")}</Notice>
        : bank.accounts.length === 0 ? <Notice>{t("bank.empty")}</Notice> : (
          <ul className="grid grid-cols-3 gap-4">
            {bank.accounts.map((acc) => (
              <li key={acc.id} className="min-w-0 rounded-[20px] border border-line bg-white/[0.04] p-5">
                <p className="truncate text-[13px] text-muted">{acc.displayName}</p>
                <motion.p key={acc.balance} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  className="tabular mt-1 truncate text-2xl font-medium tracking-tight">{fmtAmount(acc.balance, acc.asset.decimals)}
                  <span className="ms-1.5 text-sm font-normal text-muted">{acc.asset.code}</span></motion.p>
                <Ident value={acc.id} className="mt-2 block truncate text-[11px] text-muted" />
              </li>
            ))}
          </ul>
        )}
    </Panel>
  );
}

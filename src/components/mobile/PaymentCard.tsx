"use client";
// OWNER: worker B. The one payment card: exactly the facts the approval binds.
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { formatUnitsStr, type AgreementView } from "@/shared/contract";
import { ShieldCheck, Timer } from "lucide-react";
import { cn } from "@/lib/cn";

export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Fact({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="min-w-0 border-t border-line py-2.5" data-testid={testId}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 min-w-0 text-start text-sm text-fg">{children}</dd>
    </div>
  );
}

/** Label at the start, short value at the end: one line per fact, like an order-detail row. */
export function FactRow({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4 border-t border-line py-2.5" data-testid={testId}>
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 text-end text-sm text-fg">{children}</dd>
    </div>
  );
}

/** A term the approval enforces. The sentence is the fact; the label stays for screen readers so the block fits above the action dock in longer languages. */
function Guarantee({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex min-w-0 gap-2.5 py-0.5" data-testid={testId}>
      <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-mint" />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="text-[13px] leading-snug text-fg">{children}</dd>
      </div>
    </div>
  );
}

export function PaymentCard({ view, remainingMs, envLabel }: { view: AgreementView; remainingMs: number | null; envLabel: string | null }) {
  const t = useTranslations("mobile");
  const c = useTranslations("common");
  const format = useFormatter();
  const a = view.agreement;
  const counting = view.state === "awaiting_approval" || view.state === "approved" || view.state === "executing";
  const expired = remainingMs !== null && remainingMs <= 0;
  const urgent = counting && remainingMs !== null && remainingMs < 30000;
  const expiryAt = format.dateTime(new Date(a.expiry * 1000), { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <section className="tilt rounded-[20px] border border-line bg-surface p-5" data-testid="payment-card">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-muted">{t("card.payTo")}</p>
        {envLabel && (
          <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted" data-testid="env-label">{envLabel}</span>
        )}
      </div>
      <h2 className="break-words text-xl font-semibold leading-snug" data-testid="merchant">{a.recipientDisplayName}</h2>

      <div className="mt-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{a.rail === "bank" ? t("card.amountExact") : t("card.amountMax")}</p>
          {counting && remainingMs !== null && (
            <p className={cn("tabular inline-flex items-center gap-1 text-xs", urgent || expired ? "text-amber" : "text-muted")} data-testid="countdown">
              <Timer aria-hidden className="size-3.5" />
              {expired ? t("card.expiryReached") : t("card.expiresIn", { time: formatCountdown(remainingMs) })}
            </p>
          )}
        </div>
        <p className="tabular mt-1 flex flex-wrap items-baseline gap-x-2 break-all text-[40px] font-semibold leading-none tracking-tight" data-testid="amount">
          <bdi>{formatUnitsStr(a.amount, a.asset.decimals)}</bdi>
          <span className="text-lg font-medium text-muted">{a.asset.code}</span>
        </p>
      </div>

      <dl className="mt-3">
        <Fact label={t("card.recipient")} testId="recipient">
          <span className="ident text-[13px]">{a.recipient}</span>
          <span className="mt-1 block text-xs text-muted">{t("card.displayNameNote")}</span>
        </Fact>
        <div className="mb-2 rounded-[14px] border border-mint/25 bg-mint/[0.06] px-3 py-2">
          <Guarantee label={t("card.oneUse")} testId="one-use">{t("card.oneUseValue")}</Guarantee>
          <Guarantee label={t("card.scope")} testId="scope">{t("card.scopeValue")}</Guarantee>
        </div>
        <FactRow label={t("card.payer")}><span className="ident text-[13px]">{a.payer}</span></FactRow>
        {a.domain && (
          <FactRow label={t("card.network")}>
            {t("card.networkValue", { chainId: String(a.domain.chainId) })}
            <span className="ident mt-0.5 block text-xs text-muted">{a.domain.verifyingContract}</span>
          </FactRow>
        )}
        {a.itemId !== null && <FactRow label={t("card.item")}><span className="ident text-[13px]">{a.itemId}</span></FactRow>}
        <FactRow label={t("card.rail")} testId="rail">{c(`rail.${a.rail}`)}</FactRow>
        <FactRow label={t("card.expiry")} testId="expiry">
          <span className="tabular">{t("card.expiryAt", { time: expiryAt })}</span>
        </FactRow>
      </dl>
    </section>
  );
}

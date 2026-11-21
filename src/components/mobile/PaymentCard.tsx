"use client";
// OWNER: worker B. The one payment card: exactly the facts the approval binds.
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { formatUnitsStr, type AgreementView } from "@/shared/contract";
import { ShieldCheck, Timer } from "lucide-react";
import { cn } from "@/lib/cn";

/** Small uppercase label. Letter-spacing is LTR-only so Arabic keeps its joined letterforms. */
export const LABEL = "text-[11px] font-medium uppercase leading-4 text-muted ltr:tracking-[0.08em]";

export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Fact({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="min-w-0 border-t border-line py-3" data-testid={testId}>
      <dt className={LABEL}>{label}</dt>
      <dd className="mt-1 min-w-0 text-start text-sm text-fg">{children}</dd>
    </div>
  );
}

/** Label at the start, short value at the end: one line per fact, like an order-detail row. */
export function FactRow({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4 border-t border-line py-3" data-testid={testId}>
      <dt className="shrink-0 text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 text-end text-sm text-fg">{children}</dd>
    </div>
  );
}

/** A limit the approval enforces: what CounterSign will hold the payment to. */
function Guarantee({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex min-w-0 gap-3 py-2.5" data-testid={testId}>
      <span aria-hidden className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-mint/10">
        <ShieldCheck className="size-4 text-mint" />
      </span>
      <div className="min-w-0">
        <dt className={LABEL}>{label}</dt>
        <dd className="mt-0.5 text-sm leading-snug text-fg">{children}</dd>
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
    <section className="overflow-hidden rounded-2xl border border-line bg-surface" data-testid="payment-card">
      <div className="px-5 pt-5">
        <div className="flex min-h-6 items-center justify-between gap-3">
          <p className={cn(LABEL, "min-w-0")}>{t("card.payTo")}</p>
          {envLabel && (
            <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted" data-testid="env-label">{envLabel}</span>
          )}
        </div>
        <h2 className="mt-1 break-words text-[22px] font-semibold leading-tight tracking-tight" data-testid="merchant">{a.recipientDisplayName}</h2>

        <p className={cn(LABEL, "mt-6")}>{a.rail === "bank" ? t("card.amountExact") : t("card.amountMax")}</p>
        <p
          className="tabular mt-1.5 flex flex-wrap items-baseline gap-x-2 break-all text-[clamp(40px,13vw,54px)] font-semibold leading-none tracking-[-0.03em]"
          data-testid="amount"
        >
          <bdi>{formatUnitsStr(a.amount, a.asset.decimals)}</bdi>
          <span className="text-lg font-medium tracking-normal text-muted">{a.asset.code}</span>
        </p>
        {counting && remainingMs !== null && (
          <p
            className={cn(
              "tabular mt-4 inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors duration-300",
              urgent || expired ? "border-amber/40 text-amber" : "border-line text-muted",
            )}
            data-testid="countdown"
          >
            <Timer aria-hidden className="size-3.5 shrink-0" />
            {expired ? t("card.expiryReached") : t("card.expiresIn", { time: formatCountdown(remainingMs) })}
          </p>
        )}
      </div>

      <dl className="mt-5 px-5">
        <Fact label={t("card.recipient")} testId="recipient">
          <span className="ident text-sm leading-relaxed">{a.recipient}</span>
          <span className="mt-1.5 block text-xs leading-relaxed text-muted">{t("card.displayNameNote")}</span>
        </Fact>
        <div className="mb-1 divide-y divide-line border-t border-line">
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

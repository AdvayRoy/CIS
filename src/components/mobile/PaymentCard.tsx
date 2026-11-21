"use client";
// OWNER: worker B. The one payment card: exactly the facts the approval binds.
import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { formatUnitsStr, type AgreementView } from "@/shared/contract";
import { Timer } from "lucide-react";
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
    <section className="tilt rounded-[28px] border border-line bg-surface p-5" data-testid="payment-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">{t("card.payTo")}</p>
          <h2 className="break-words text-xl font-semibold leading-snug" data-testid="merchant">{a.recipientDisplayName}</h2>
        </div>
        {envLabel && (
          <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted" data-testid="env-label">{envLabel}</span>
        )}
      </div>

      <div className="mt-4">
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

      <dl className="mt-4">
        <Fact label={t("card.recipient")} testId="recipient">
          <span className="ident text-[13px]">{a.recipient}</span>
          <span className="mt-1 block text-xs text-muted">{t("card.displayNameNote")}</span>
        </Fact>
        <Fact label={t("card.payer")}><span className="ident text-[13px]">{a.payer}</span></Fact>

        {a.domain && (
          <Fact label={t("card.network")}>
            {t("card.networkValue", { chainId: String(a.domain.chainId) })}
            <span className="ident mt-0.5 block text-xs text-muted">{a.domain.verifyingContract}</span>
          </Fact>
        )}
        {a.itemId !== null && <Fact label={t("card.item")}><span className="ident text-[13px]">{a.itemId}</span></Fact>}
        <div className="grid grid-cols-2 gap-x-4">
          <Fact label={t("card.rail")} testId="rail">{c(`rail.${a.rail}`)}</Fact>
          <Fact label={t("card.expiry")} testId="expiry">
            <span className="tabular">{t("card.expiryAt", { time: expiryAt })}</span>
          </Fact>
        </div>
        <Fact label={t("card.oneUse")} testId="one-use">{t("card.oneUseValue")}</Fact>
        <Fact label={t("card.scope")} testId="scope">{t("card.scopeValue")}</Fact>
      </dl>
    </section>
  );
}

"use client";
// OWNER: worker B. Final receipt with expandable evidence, all read from the authoritative view.
import { useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { formatUnitsStr, type AgreementView, type ExecutionEvidence } from "@/shared/contract";
import { cn } from "@/lib/cn";
import { toMs } from "./hooks";
import { LABEL } from "./PaymentCard";

const EASE = [0.165, 0.84, 0.44, 1] as const;

function Row({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line py-3" data-testid={testId}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="min-w-0 text-start text-sm">{children}</dd>
    </div>
  );
}

export function Receipt({ view, reasonText }: { view: AgreementView; reasonText: (code: string) => string }) {
  const t = useTranslations("mobile");
  const format = useFormatter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const a = view.agreement;
  const settled = view.state === "settled";
  const accepted = [...view.evidence].reverse().find((e) => e.decision.accepted);
  const shown: ExecutionEvidence | undefined = (settled ? accepted : undefined) ?? view.evidence[view.evidence.length - 1];
  const money = (v: string) => `${formatUnitsStr(v, a.asset.decimals)} ${a.asset.code}`;
  const time = (n: number) => format.dateTime(new Date(toMs(n)), { dateStyle: "medium", timeStyle: "medium" });
  const r = shown?.receipt ?? null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5" data-testid="receipt">
      <h2 className={LABEL}>{settled ? t("receipt.title") : t("receipt.evidenceTitle")}</h2>
      {settled && accepted && (
        <motion.div
          initial={{ opacity: 0, scale: reduce ? 1 : 0.98 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduce ? 0 : 0.36, ease: EASE }}
          className="mt-2" data-testid="receipt-paid"
        >
          <p className="tabular break-words text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-mint">
            <bdi>{t("receipt.paid", { amount: formatUnitsStr(accepted.attempt.amount, a.asset.decimals), asset: a.asset.code })}</bdi>
          </p>
          <p className="mt-1.5 break-words text-sm text-muted">{t("receipt.to", { name: a.recipientDisplayName })}</p>
        </motion.div>
      )}
      <dl className="mt-4">
        <Row label={t("receipt.executionCount")} testId="execution-count"><span className="tabular text-xl font-semibold">{view.executionCount}</span></Row>
        {shown && <Row label={t("receipt.payerBalance")} testId="payer-balance"><span className="tabular break-all text-xl font-semibold"><bdi>{money(shown.observed.payerBalance)}</bdi></span></Row>}
      </dl>

      <button
        type="button"
        aria-expanded={open}
        aria-controls="cs-evidence"
        data-testid="evidence-toggle"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 flex min-h-12 w-full items-center justify-between gap-2 rounded-full border border-line bg-white/5 px-5 text-sm font-medium"
      >
        {open ? t("receipt.evidenceHide") : t("receipt.evidenceShow")}
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(.165,.84,.44,1)]", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="cs-evidence" key="evidence" data-testid="evidence"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0 : 0.32, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              {!shown && <p className="text-sm text-muted">{t("receipt.noEvidence")}</p>}
              {shown && (
                <>
                  <h3 className={LABEL}>{r?.kind === "chain" ? t("receipt.chainReceipt") : t("receipt.ledgerReceipt")}</h3>
                  {!r && <p className="mt-1 text-sm text-muted">{t("receipt.noReceipt")}</p>}
                  {r?.kind === "ledger" && (
                    <dl className="mt-2">
                      <Row label={t("receipt.transferId")}><span className="ident text-[13px]">{r.transferId}</span></Row>
                      <Row label={t("receipt.debit")}><span className="ident text-[13px]">{r.debitAccount}</span></Row>
                      <Row label={t("receipt.credit")}><span className="ident text-[13px]">{r.creditAccount}</span></Row>
                      <Row label={t("card.amountExact")}><span className="tabular"><bdi>{money(r.amount)}</bdi></span></Row>
                      <Row label={t("receipt.postedAt")}><span className="tabular">{time(r.postedAt)}</span></Row>
                    </dl>
                  )}
                  {r?.kind === "chain" && (
                    <dl className="mt-2">
                      <Row label={t("receipt.txHash")}><span className="ident text-[13px]">{r.txHash}</span></Row>
                      <Row label={t("receipt.txStatus")}>
                        <span className={r.status === "success" ? "text-mint" : "text-coral"}>{r.status === "success" ? t("receipt.txSuccess") : t("receipt.txReverted")}</span>
                      </Row>
                      {r.revertReason && <Row label={t("receipt.revertReason")}><span className="ident text-[13px]">{r.revertReason}</span></Row>}
                      <Row label={t("receipt.block")}><span className="ident text-[13px]">{r.blockNumber}</span></Row>
                      <Row label={t("receipt.chain")}><span className="ident text-[13px]">{r.chainId}</span></Row>
                    </dl>
                  )}

                  <h3 className={cn(LABEL, "mt-6")}>{t("receipt.observed")}</h3>
                  <dl className="mt-2">
                    <Row label={t("receipt.payerBalance")} testId="observed-payer"><span className="tabular"><bdi>{money(shown.observed.payerBalance)}</bdi></span></Row>
                    <Row label={t("receipt.recipientBalance")}><span className="tabular"><bdi>{money(shown.observed.recipientBalance)}</bdi></span></Row>
                    <Row label={t("receipt.allowance")} testId="observed-allowance">
                      {shown.observed.allowance === null
                        ? <span className="text-muted">{t("receipt.allowanceNone")}</span>
                        : <span className="tabular"><bdi>{money(shown.observed.allowance)}</bdi></span>}
                    </Row>
                    <Row label={t("receipt.executionCount")} testId="observed-count"><span className="tabular">{shown.observed.executionCount}</span></Row>
                    <Row label={t("receipt.observedAt")}><span className="tabular">{time(shown.observed.observedAt)}</span></Row>
                  </dl>
                </>
              )}

              {view.evidence.length > 0 && (
                <>
                  <h3 className={cn(LABEL, "mt-6")}>{t("receipt.attempts")}</h3>
                  <ol className="mt-2">
                    {view.evidence.map((e, i) => (
                      <li key={i} className="border-t border-line py-3 text-sm" data-testid="attempt">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted">{t("receipt.attemptN", { n: String(i + 1) })}</span>
                          <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", e.decision.accepted ? "bg-mint/10 text-mint" : "bg-coral/10 text-coral")}>
                            {e.decision.accepted ? t("receipt.accepted") : t("receipt.rejected")}
                          </span>
                        </div>
                        <p className="mt-1.5">{reasonText(e.decision.reason)}</p>
                        <p className="ident mt-1 text-xs text-muted">{e.attempt.recipient}</p>
                        <p className="tabular text-xs text-muted"><bdi>{money(e.attempt.amount)}</bdi></p>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              <h3 className={cn(LABEL, "mt-6")}>{t("receipt.approval")}</h3>
              <dl className="mt-2">
                <Row label={t("receipt.agreementId")}><span className="ident text-[13px]">{a.id}</span></Row>
                {view.approval && (
                  <>
                    <Row label={t("receipt.signer")}><span className="ident text-[13px]">{view.approval.signer}</span></Row>
                    <Row label={t("receipt.signature")}><span className="ident text-xs text-muted">{view.approval.signature}</span></Row>
                    <Row label={t("receipt.approvedAt")}><span className="tabular">{time(view.approval.approvedAt)}</span></Row>
                  </>
                )}
              </dl>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

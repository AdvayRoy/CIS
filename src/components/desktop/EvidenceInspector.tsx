"use client";
import type { ReactNode } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { AnimatePresence, motion } from "motion/react";
import type { AgreementView, ExecutionEvidence } from "@/shared/contract";
import { cn } from "@/lib/cn";
import { EASE, LABEL, diffValue, fmtAsset, toMs, type Stage } from "./format";
import { Ident, Notice, Row } from "./ui";

const STAGES: Stage[] = ["approved", "attempted", "executed"];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-line px-5 py-4 first:border-t-0">
      <h3 className={cn(LABEL, "mb-1.5")}>{title}</h3>
      {children}
    </div>
  );
}

export function EvidenceInspector({ view, evidence, stage, onStage }:
  { view: AgreementView | null; evidence: ExecutionEvidence | null; stage: Stage; onStage: (s: Stage) => void }) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const fmt = useFormatter();
  const time = (n: number) => fmt.dateTime(new Date(toMs(n)), { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const a = view?.agreement;
  const diffFields = new Set((evidence?.decision.diffs ?? []).map((d) => d.field));

  return (
    <div className="flex h-full min-h-0 w-full flex-col lg:w-[340px]">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
        <h2 className={LABEL}>{t("inspector.title")}</h2>
      </div>
      {!view || !a ? <div className="p-5"><Notice>{t("inspector.empty")}</Notice></div> : (<>
        <div role="tablist" aria-label={t("inspector.title")} className="flex shrink-0 gap-1 border-b border-line p-2">
          {STAGES.map((s) => (
            <button key={s} role="tab" type="button" aria-selected={stage === s} onClick={() => onStage(s)}
              className={cn("relative h-9 flex-1 rounded-lg text-[13px] transition-colors duration-200", stage === s ? "text-fg" : "text-muted hover:text-fg")}>
              {stage === s && <motion.span layoutId="inspector-tab" aria-hidden transition={{ duration: 0.3, ease: EASE }} className="absolute inset-0 rounded-lg border border-line bg-white/[0.07]" />}
              <span className="relative">{t(`path.${s}`)}</span>
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${a.id}:${stage}`} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease: EASE }}>
              {stage === "approved" && (<>
                <Group title={t("inspector.terms")}>
                  <dl>
                    <Row label={t("inspector.agreementId")}><Ident value={a.id} /></Row>
                    <Row label={tc("field.payer")}><Ident value={a.payer} /></Row>
                    <Row label={tc("field.recipient")}><Ident value={a.recipient} /></Row>
                    <Row label={tc("field.merchant")}>{a.recipientDisplayName}<span className="block text-[11px] text-muted">{t("inspector.displayOnly")}</span></Row>
                    <Row label={tc("field.rail")}>{tc(`rail.${a.rail}`)}</Row>
                    <Row label={tc("field.amount")}><span className="tabular">{fmtAsset(a.amount, a.asset)}</span><Ident value={a.amount} className="block text-[11px] text-muted" /></Row>
                    <Row label={tc("field.operation")}><Ident value={a.operation} /></Row>
                    {a.itemId !== null && <Row label={t("inspector.itemId")}><Ident value={a.itemId} /></Row>}
                    <Row label={tc("field.expiry")}><span className="tabular">{time(a.expiry)}</span></Row>
                    <Row label={tc("field.nonce")}><Ident value={a.nonce} /></Row>
                    {a.asset.address && <Row label={t("inspector.token")}><Ident value={a.asset.address} /></Row>}
                    {a.domain && <Row label={tc("field.domain")}><span className="tabular">{t("inspector.chainId", { id: a.domain.chainId })}</span><Ident value={a.domain.verifyingContract} className="block" /></Row>}
                  </dl>
                </Group>
                <Group title={t("inspector.signature")}>
                  {view.approval ? (
                    <dl>
                      <Row label={t("inspector.signer")}><Ident value={view.approval.signer} /></Row>
                      <Row label={t("inspector.signatureValue")}><Ident value={view.approval.signature} className="text-[11px]" /></Row>
                      <Row label={t("inspector.approvedAt")}><span className="tabular">{time(view.approval.approvedAt)}</span></Row>
                      <p className="pt-2 text-[11px] leading-relaxed text-muted">{t("inspector.signerNote")}</p>
                    </dl>
                  ) : <Notice tone={view.state === "awaiting_approval" ? "amber" : "muted"}>{t("inspector.noSignature", { state: tc(`state.${view.state}`) })}</Notice>}
                </Group>
              </>)}
              {stage === "attempted" && (!evidence ? <div className="p-5"><Notice>{t("path.noAttemptHint")}</Notice></div> : (<>
                <Group title={t("inspector.attempt")}>
                  <dl>
                    <Row label={tc("field.recipient")} changed={diffFields.has("recipient")}><Ident value={evidence.attempt.recipient} /></Row>
                    <Row label={tc("field.amount")} changed={diffFields.has("amount")}><span className="tabular">{fmtAsset(evidence.attempt.amount, a.asset)}</span></Row>
                    <Row label={tc("field.operation")} changed={diffFields.has("operation")}><Ident value={evidence.attempt.operation} /></Row>
                    <Row label={tc("field.continuingAllowance")} changed={diffFields.has("continuingAllowance")}>
                      <span className="tabular">{evidence.attempt.continuingAllowance === "0" ? t("path.none") : fmtAsset(evidence.attempt.continuingAllowance, a.asset)}</span></Row>
                  </dl>
                </Group>
                <Group title={t("inspector.decision")}>
                  <p className={cn("text-sm font-medium", evidence.decision.accepted ? "text-mint" : "text-coral")}>
                    {evidence.decision.accepted ? t("inspector.accepted") : t("inspector.rejected")} — {tc(`reason.${evidence.decision.reason}`)}
                  </p>
                  <p className="mt-1 text-xs text-muted"><Ident value={evidence.decision.reason} className="text-[11px]" /> · <span className="tabular">{time(evidence.decision.decidedAt)}</span></p>
                </Group>
                <Group title={t("inspector.diffs", { count: evidence.decision.diffs.length })}>
                  {evidence.decision.diffs.length === 0 ? <p className="text-[13px] text-muted">{t("inspector.noDiffs")}</p> : (
                    <ul className="space-y-2">
                      {evidence.decision.diffs.map((d) => (
                        <li key={d.field} className="rounded-xl border border-coral/40 bg-coral/5 p-3 text-[13px]">
                          <p className="font-medium text-coral">{tc(`field.${d.field}`)}</p>
                          <p className="mt-1.5 text-[11px] text-muted">{t("path.approved")}</p>
                          <Ident value={diffValue(d, "approved", a.asset)} className="block text-mint" />
                          <p className="mt-1.5 text-[11px] text-muted">{t("path.attempted")}</p>
                          <Ident value={diffValue(d, "attempted", a.asset)} className="block text-coral" />
                        </li>
                      ))}
                    </ul>
                  )}
                </Group>
              </>))}
              {stage === "executed" && (!evidence ? <div className="p-5"><Notice>{t("path.notExecutedHint")}</Notice></div> : (<>
                <Group title={t("path.receipt")}>
                  {!evidence.receipt ? <Notice tone={evidence.decision.accepted ? "amber" : "coral"}>{t("inspector.noReceipt")}</Notice>
                    : evidence.receipt.kind === "ledger" ? (
                      <dl>
                        <Row label={t("inspector.transferId")}><Ident value={evidence.receipt.transferId} /></Row>
                        <Row label={t("inspector.debit")}><Ident value={evidence.receipt.debitAccount} /></Row>
                        <Row label={t("inspector.credit")}><Ident value={evidence.receipt.creditAccount} /></Row>
                        <Row label={tc("field.amount")}><span className="tabular">{fmtAsset(evidence.receipt.amount, a.asset)}</span></Row>
                        <Row label={t("inspector.postedAt")}><span className="tabular">{time(evidence.receipt.postedAt)}</span></Row>
                      </dl>
                    ) : (
                      <dl>
                        <Row label={t("inspector.txHash")}><Ident value={evidence.receipt.txHash} className="text-[11px]" /></Row>
                        <Row label={t("inspector.block")}><span className="tabular">{evidence.receipt.blockNumber}</span></Row>
                        <Row label={tc("field.domain")}><span className="tabular">{t("inspector.chainId", { id: evidence.receipt.chainId })}</span></Row>
                        <Row label={t("inspector.txStatus")} changed={evidence.receipt.status === "reverted"}>
                          <span className={evidence.receipt.status === "success" ? "text-mint" : "text-coral"}>{t(`inspector.tx.${evidence.receipt.status}`)}</span></Row>
                        {evidence.receipt.revertReason && <Row label={t("inspector.revertReason")}><Ident value={evidence.receipt.revertReason} /></Row>}
                      </dl>
                    )}
                </Group>
                <Group title={t("inspector.observed", { source: tc(`env.${a.rail === "bank" ? "bank" : "chain"}`) })}>
                  <dl>
                    <Row label={t("path.payerBalance")}><span className="tabular">{fmtAsset(evidence.observed.payerBalance, a.asset)}</span></Row>
                    <Row label={t("inspector.recipientBalance")}><span className="tabular">{fmtAsset(evidence.observed.recipientBalance, a.asset)}</span></Row>
                    {evidence.observed.allowance !== null && <Row label={tc("field.allowance")}><span className="tabular">{fmtAsset(evidence.observed.allowance, a.asset)}</span></Row>}
                    <Row label={tc("field.executionCount")}><span className="tabular">{evidence.observed.executionCount}</span></Row>
                    <Row label={t("inspector.observedAt")}><span className="tabular">{time(evidence.observed.observedAt)}</span></Row>
                  </dl>
                </Group>
              </>))}
              <Group title={t("inspector.events")}>
                {view.events.length === 0 ? <p className="text-[13px] text-muted">{t("inspector.noEvents")}</p> : (
                  <ol className="space-y-1.5">
                    {view.events.map((e) => (
                      <li key={e.seq} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 text-xs">
                        <span className="tabular text-muted">{time(e.at)}</span>
                        <span className="min-w-0"><Ident value={e.type} className="text-[11px]" />{e.reason && e.reason !== "OK" && <span className="block text-coral">{tc(`reason.${e.reason}`)}</span>}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Group>
            </motion.div>
          </AnimatePresence>
        </div>
      </>)}
    </div>
  );
}

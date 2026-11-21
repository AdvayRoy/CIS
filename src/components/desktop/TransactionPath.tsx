"use client";
import type { ReactNode } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { motion } from "motion/react";
import { Ban, CircleCheck, CircleDashed, Clock, TriangleAlert } from "lucide-react";
import type { AgreementView, ExecutionEvidence, FieldDiff } from "@/shared/contract";
import { cn } from "@/lib/cn";
import { diffValue, fmtAsset, short, toMs, type Stage, type Tone, toneBg, toneBorder, toneText } from "./format";
import { Ident } from "./ui";

const ICON: Record<Tone, typeof Ban> = { mint: CircleCheck, amber: Clock, coral: TriangleAlert, muted: CircleDashed };

function Fact({ label, children, diff, approvedText }: { label: string; children: ReactNode; diff?: FieldDiff; approvedText?: string }) {
  const t = useTranslations("desktop");
  return (
    <div className={cn("rounded-lg px-2 py-1.5", diff && "bg-coral/10 ring-1 ring-coral/40")}>
      <dt className={cn("flex items-center gap-1 text-[11px]", diff ? "text-coral" : "text-muted")}>
        {label}{diff && <span className="font-medium">· {t("path.changed")}</span>}
      </dt>
      <dd className="mt-0.5 min-w-0 truncate text-[13px]">{children}</dd>
      {diff && approvedText && (
        <dd className="mt-0.5 truncate text-[11px] text-muted"><span>{t("path.approvedWas")} </span><span className="ident line-through">{approvedText}</span></dd>
      )}
    </div>
  );
}

function StageCard({ stage, selected, onSelect, tone, status, children, index }:
  { stage: Stage; selected: boolean; onSelect: (s: Stage) => void; tone: Tone; status: string; children: ReactNode; index: number }) {
  const t = useTranslations("desktop");
  const Icon = ICON[tone];
  return (
    <motion.button layout="position" type="button" onClick={() => onSelect(stage)} aria-pressed={selected}
      transition={{ duration: 0.24 }}
      className={cn("flex min-w-0 flex-1 flex-col rounded-[24px] border bg-surface p-5 text-start transition-colors duration-200 hover:-translate-y-0.5",
        selected ? cn(toneBorder[tone], "bg-surface-2", tone === "mint" ? "glow-mint" : tone === "coral" ? "glow-coral" : tone === "amber" ? "glow-amber" : "") : "border-line hover:bg-surface-2/60")}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wider text-muted uppercase">{index}. {t(`path.${stage}`)}</span>
        <Icon aria-hidden className={cn("size-4 shrink-0", toneText[tone])} />
      </span>
      <motion.span key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
        className={cn("mt-1.5 min-h-10 text-sm leading-5 font-medium", toneText[tone])}>{status}</motion.span>
      <dl className="mt-2 space-y-1">{children}</dl>
    </motion.button>
  );
}

function Connector({ tone, reached }: { tone: Tone; reached: boolean }) {
  return (
    <div aria-hidden className="relative mt-7 h-px w-6 shrink-0 self-start bg-line xl:w-8">
      <motion.div className={cn("absolute inset-0 origin-left rtl:origin-right", toneBg[tone])}
        initial={false} animate={{ scaleX: reached ? 1 : 0 }} transition={{ duration: 0.3, ease: "easeOut" }} />
      <motion.div className={cn("absolute -end-0.5 -top-[3px] size-[7px] rounded-full", toneBg[tone])}
        initial={false} animate={{ opacity: reached ? 1 : 0.4 }} transition={{ duration: 0.3 }} />
    </div>
  );
}

export function TransactionPath({ view, evidence, stage, onStage }:
  { view: AgreementView; evidence: ExecutionEvidence | null; stage: Stage; onStage: (s: Stage) => void }) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const fmt = useFormatter();
  const a = view.agreement;
  const diffs = new Map((evidence?.decision.diffs ?? []).map((d) => [d.field, d]));
  const approvedTone: Tone = view.approval ? "mint" : view.state === "awaiting_approval" ? "amber" : view.state === "declined" ? "coral" : "muted";
  const approvedStatus = view.approval ? t("path.signed") : view.state === "awaiting_approval" ? t("path.awaiting") : tc(`state.${view.state}`);
  const attemptTone: Tone = !evidence ? "muted" : diffs.size > 0 ? "coral" : evidence.decision.accepted ? "mint" : "amber";
  const attemptStatus = !evidence ? t("path.noAttempt") : diffs.size > 0 ? t("path.differs", { count: diffs.size }) : t("path.matches");
  const executing = view.state === "executing" && !evidence;
  const execTone: Tone = executing ? "amber" : !evidence ? "muted" : evidence.decision.accepted && evidence.receipt ? "mint" : "coral";
  const execStatus = executing ? tc("state.executing") : !evidence ? t("path.notExecuted") : tc(`reason.${evidence.decision.reason}`);
  const at = evidence?.attempt; const ob = evidence?.observed; const rc = evidence?.receipt;
  const diffText = (f: FieldDiff["field"]) => { const d = diffs.get(f); return d ? diffValue(d, "approved", a.asset) : undefined; };

  return (
    <div className="flex items-stretch">
      <StageCard index={1} stage="approved" selected={stage === "approved"} onSelect={onStage} tone={approvedTone} status={approvedStatus}>
        <Fact label={tc("field.recipient")}><Ident value={a.recipient} display={short(a.recipient)} /></Fact>
        <Fact label={tc("field.amount")}><span className="tabular">{fmtAsset(a.amount, a.asset)}</span></Fact>
        <Fact label={tc("field.operation")}><Ident value={a.operation} /></Fact>
        <Fact label={tc("field.expiry")}><span className="tabular">{fmt.dateTime(new Date(toMs(a.expiry)), { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span></Fact>
      </StageCard>
      <Connector tone={attemptTone} reached={!!evidence} />
      <StageCard index={2} stage="attempted" selected={stage === "attempted"} onSelect={onStage} tone={attemptTone} status={attemptStatus}>
        {at ? (<>
          <Fact label={tc("field.recipient")} diff={diffs.get("recipient")} approvedText={diffText("recipient")}><Ident value={at.recipient} display={short(at.recipient)} /></Fact>
          <Fact label={tc("field.amount")} diff={diffs.get("amount")} approvedText={diffText("amount")}><span className="tabular">{fmtAsset(at.amount, a.asset)}</span></Fact>
          <Fact label={tc("field.operation")} diff={diffs.get("operation")} approvedText={diffText("operation")}><Ident value={at.operation} /></Fact>
          <Fact label={tc("field.continuingAllowance")} diff={diffs.get("continuingAllowance")} approvedText={diffText("continuingAllowance")}>
            <span className="tabular">{at.continuingAllowance === "0" ? t("path.none") : fmtAsset(at.continuingAllowance, a.asset)}</span></Fact>
        </>) : <p className="px-2 text-[13px] text-muted">{t("path.noAttemptHint")}</p>}
      </StageCard>
      <Connector tone={execTone} reached={!!evidence} />
      <StageCard index={3} stage="executed" selected={stage === "executed"} onSelect={onStage} tone={execTone} status={execStatus}>
        {ob ? (<>
          <Fact label={t("path.payerBalance")}><span className="tabular">{fmtAsset(ob.payerBalance, a.asset)}</span></Fact>
          {ob.allowance !== null && <Fact label={tc("field.allowance")}><span className="tabular">{fmtAsset(ob.allowance, a.asset)}</span></Fact>}
          <Fact label={tc("field.executionCount")}><span className="tabular">{ob.executionCount}</span></Fact>
          <Fact label={t("path.receipt")}>
            {rc ? <Ident value={rc.kind === "ledger" ? rc.transferId : rc.txHash} display={short(rc.kind === "ledger" ? rc.transferId : rc.txHash)} />
              : <span className="text-muted">{t("path.noReceipt")}</span>}
          </Fact>
        </>) : <p className="px-2 text-[13px] text-muted">{t("path.notExecutedHint")}</p>}
      </StageCard>
    </div>
  );
}

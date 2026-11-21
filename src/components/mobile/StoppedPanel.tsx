"use client";
// OWNER: worker B. Why the latest attempt was stopped: translated reason + field-level diffs from the evidence.
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { formatUnitsStr, type ExecutionEvidence, type FieldDiff } from "@/shared/contract";
import { LABEL } from "./PaymentCard";

export function diffValue(d: FieldDiff, v: string, ev: ExecutionEvidence) {
  if ((d.field === "amount" || d.field === "continuingAllowance") && /^[0-9]+$/.test(v))
    return `${formatUnitsStr(v, ev.agreement.asset.decimals)} ${ev.agreement.asset.code}`;
  return v;
}

export function StoppedPanel({ evidence, reasonText }: { evidence: ExecutionEvidence; reasonText: (code: string) => string }) {
  const t = useTranslations("mobile");
  const c = useTranslations("common");
  const { decision } = evidence;
  return (
    <section className="rounded-2xl border border-coral/40 bg-surface p-5" data-testid="stopped-panel">
      <h2 className={LABEL}>{t("stopped.title")}</h2>
      <p className="mt-1.5 break-words text-lg font-semibold leading-snug text-coral" data-testid="stopped-reason">{reasonText(decision.reason)}</p>
      {decision.diffs.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("stopped.noDiffs")}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {decision.diffs.map((d, i) => (
            <li key={`${d.field}-${i}`} className="overflow-hidden rounded-xl border border-line" data-testid="diff" data-field={d.field}>
              <p className="border-b border-line px-3.5 py-2.5 text-sm font-medium">{c(`field.${d.field}`)}</p>
              <div className="flex gap-3 px-3.5 py-3">
                <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-mint text-bg">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <div className="min-w-0">
                  <p className={LABEL}>{t("stopped.approved")}</p>
                  <p className="mt-0.5"><span className="ident text-[13px] text-mint">{diffValue(d, d.approved, evidence)}</span></p>
                </div>
              </div>
              <div className="flex gap-3 border-t border-line bg-coral/[0.06] px-3.5 py-3">
                <span aria-hidden className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-coral text-bg">
                  <X className="size-3" strokeWidth={3} />
                </span>
                <div className="min-w-0">
                  <p className={LABEL}>{t("stopped.attempted")}</p>
                  <p className="mt-0.5"><span className="ident text-[13px] text-coral">{diffValue(d, d.attempted, evidence)}</span></p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";
// OWNER: worker B. Why the latest attempt was stopped: translated reason + field-level diffs from the evidence.
import { useTranslations } from "next-intl";
import { formatUnitsStr, type ExecutionEvidence, type FieldDiff } from "@/shared/contract";

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
    <section className="rounded-2xl border border-coral/40 bg-surface p-4" data-testid="stopped-panel">
      <h2 className="text-xs text-muted">{t("stopped.title")}</h2>
      <p className="mt-1 text-base font-medium text-coral" data-testid="stopped-reason">{reasonText(decision.reason)}</p>
      {decision.diffs.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("stopped.noDiffs")}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {decision.diffs.map((d, i) => (
            <li key={`${d.field}-${i}`} className="rounded-xl border border-line p-3" data-testid="diff" data-field={d.field}>
              <p className="text-sm font-medium">{c(`field.${d.field}`)}</p>
              <p className="mt-2 text-xs text-muted">{t("stopped.approved")}</p>
              <p><span className="ident text-[13px] text-mint">{diffValue(d, d.approved, evidence)}</span></p>
              <p className="mt-2 text-xs text-muted">{t("stopped.attempted")}</p>
              <p><span className="ident text-[13px] text-coral">{diffValue(d, d.attempted, evidence)}</span></p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

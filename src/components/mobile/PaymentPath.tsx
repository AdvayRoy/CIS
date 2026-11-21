"use client";
// OWNER: worker B. Approved -> Attempted -> Executed, lit only by authoritative facts in the view.
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import type { AgreementView } from "@/shared/contract";
import { cn } from "@/lib/cn";

type StepTone = "idle" | "done" | "bad";

export function PaymentPath({ view }: { view: AgreementView }) {
  const t = useTranslations("mobile");
  const reduce = useReducedMotion();
  const { state } = view;
  const approved = view.approval !== null;
  const attempted = view.evidence.length > 0 || state === "executing" || state === "settled";
  const last: StepTone = state === "settled" ? "done" : state === "rejected" || state === "failed" ? "bad" : "idle";
  const steps: { key: string; label: string; tone: StepTone }[] = [
    { key: "approved", label: t("path.approved"), tone: approved ? "done" : "idle" },
    { key: "attempted", label: t("path.attempted"), tone: attempted ? "done" : "idle" },
    {
      key: "executed",
      label: state === "rejected" ? t("path.stopped") : state === "failed" ? t("path.failed") : t("path.executed"),
      tone: last,
    },
  ];
  return (
    <ol aria-label={t("path.label")} className="mt-3 flex items-start" data-testid="payment-path">
      {steps.map((s, i) => (
        <li key={s.key} className="flex min-w-0 flex-1 flex-col gap-1.5" data-step={s.key} data-tone={s.tone}>
          <div className="flex items-center">
            <span
              aria-hidden
              className={cn(
                "size-2.5 shrink-0 rounded-full border transition-colors duration-200",
                s.tone === "done" && "border-mint bg-mint",
                s.tone === "bad" && "border-coral bg-coral",
                s.tone === "idle" && "border-line bg-transparent",
              )}
            />
            {i < steps.length - 1 && (
              <span aria-hidden className="relative mx-1.5 h-px flex-1 overflow-hidden bg-line">
                <motion.span
                  className={cn("absolute inset-0 origin-left rtl:origin-right", steps[i + 1].tone === "bad" ? "bg-coral" : "bg-mint")}
                  initial={false}
                  animate={{ scaleX: steps[i + 1].tone === "idle" ? 0 : 1 }}
                  transition={{ duration: reduce ? 0 : 0.3 }}
                />
              </span>
            )}
          </div>
          <span className={cn("pe-2 text-xs", s.tone === "done" ? "text-fg" : s.tone === "bad" ? "text-coral" : "text-muted")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

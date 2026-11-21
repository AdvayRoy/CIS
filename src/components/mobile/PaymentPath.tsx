"use client";
// OWNER: worker B. Approved -> Attempted -> Executed, lit only by authoritative facts in the view.
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "motion/react";
import { Check, X } from "lucide-react";
import type { AgreementView } from "@/shared/contract";
import { cn } from "@/lib/cn";

type StepTone = "idle" | "done" | "bad";
const EASE = [0.165, 0.84, 0.44, 1] as const;

export function PaymentPath({ view }: { view: AgreementView }) {
  const t = useTranslations("mobile");
  const reduce = useReducedMotion();
  const { state } = view;
  const approved = view.approval !== null;
  const attempted = view.evidence.length > 0 || state === "executing" || state === "settled";
  const last: StepTone = state === "settled" ? "done" : state === "rejected" || state === "failed" ? "bad" : "idle";
  const steps: { key: string; label: string; tone: StepTone }[] = [
    { key: "approved", label: approved ? t("path.approved") : t("path.approval"), tone: approved ? "done" : "idle" },
    { key: "attempted", label: attempted ? t("path.attempted") : t("path.attempt"), tone: attempted ? "done" : "idle" },
    {
      key: "executed",
      label: state === "rejected" ? t("path.stopped") : state === "failed" ? t("path.failed") : state === "settled" ? t("path.executed") : t("path.execution"),
      tone: last,
    },
  ];
  return (
    <ol aria-label={t("path.label")} className="mt-5 flex items-start border-t border-line pt-4" data-testid="payment-path">
      {steps.map((s, i) => (
        <li key={s.key} className={cn("flex min-w-0 flex-col gap-2", i < steps.length - 1 && "flex-1")} data-step={s.key} data-tone={s.tone}>
          <div className="flex items-center">
            <span
              aria-hidden
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                s.tone === "done" && "border-mint bg-mint text-bg",
                s.tone === "bad" && "border-coral bg-coral text-bg",
                s.tone === "idle" && "border-white/20 bg-transparent",
              )}
            >
              {s.tone === "done" && <Check className="size-3" strokeWidth={3} />}
              {s.tone === "bad" && <X className="size-3" strokeWidth={3} />}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className="relative mx-2 h-px flex-1 overflow-hidden bg-white/15">
                <motion.span
                  className={cn("absolute inset-0 origin-left rtl:origin-right", steps[i + 1].tone === "bad" ? "bg-coral" : "bg-mint")}
                  initial={false}
                  animate={{ scaleX: steps[i + 1].tone === "idle" ? 0 : 1 }}
                  transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
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

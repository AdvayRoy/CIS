"use client";
// Illustrative CounterSign interface pieces for the marketing page. Static sample values, no backend state.
import { useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Fingerprint, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";

export const EASE = [0.165, 0.84, 0.44, 1] as const;
export const SERIF = "font-[family-name:var(--font-display-serif)]";

const RM = "(prefers-reduced-motion: reduce)";
function subscribeRM(cb: () => void) {
  const m = window.matchMedia(RM);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
/** Hydration-safe reduced-motion flag: false on the server and first paint, then the user's setting. */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeRM, () => window.matchMedia(RM).matches, () => false);
}

export type Attempt = "match" | "changed";
export const SAMPLE = {
  merchant: "Northwind Market",
  payer: "ACC-CUSTOMER-001",
  recipient: "ACC-MERCHANT-001",
  otherRecipient: "ACC-UNKNOWN-777",
  amount: "100.00",
  changedAmount: "500.00",
  currency: "AED",
  balanceBefore: "1,000.00",
  balanceAfter: "900.00",
};

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-[0.14em] text-muted", className)}>{children}</p>;
}

export function Pill({ tone, children }: { tone: "mint" | "coral" | "amber" | "plain"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold",
        tone === "mint" && "bg-mint text-black",
        tone === "coral" && "bg-coral text-black",
        tone === "amber" && "bg-amber text-black",
        tone === "plain" && "border border-line text-muted",
      )}
    >
      {children}
    </span>
  );
}

function Row({ k, v, ident, state }: { k: string; v: string; ident?: boolean; state?: "ok" | "bad" }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line py-2.5 text-[13px]">
      <span className="text-muted">{k}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("min-w-0 text-end", ident ? "ident text-[12px]" : "tabular", state === "bad" && "text-coral")}>{v}</span>
        {state === "ok" && <Check aria-hidden className="size-3.5 shrink-0 text-mint" />}
        {state === "bad" && <X aria-hidden className="size-3.5 shrink-0 text-coral" />}
      </span>
    </div>
  );
}

/** The agreement the customer approved. */
export function TermsCard({ checked, className }: { checked?: boolean; className?: string }) {
  const s = checked ? "ok" : undefined;
  return (
    <div className={cn("rounded-2xl border border-line bg-[#191918] p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label>Approved terms</Label>
        <Pill tone="plain">One use</Pill>
      </div>
      <p className="mt-4 text-[13px] text-muted">{SAMPLE.merchant}</p>
      <p className="tabular mt-1 text-[40px] font-semibold leading-none tracking-tight">
        {SAMPLE.amount} <span className="text-[16px] font-medium text-muted">{SAMPLE.currency}</span>
      </p>
      <div className="mt-5">
        <Row k="Recipient" v={SAMPLE.recipient} ident state={s} />
        <Row k="Amount" v={`${SAMPLE.amount} ${SAMPLE.currency}`} state={s} />
        <Row k="Continuing permission" v="None" state={s} />
        <Row k="Use" v="Once" state={s} />
      </div>
    </div>
  );
}

/** What the application tried to execute. */
export function AttemptCard({ attempt, className }: { attempt: Attempt; className?: string }) {
  const bad = attempt === "changed";
  return (
    <div className={cn("rounded-2xl border border-line bg-[#191918] p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label>App attempt</Label>
        <Pill tone={bad ? "coral" : "mint"}>{bad ? "Does not match" : "Matches"}</Pill>
      </div>
      <div className="mt-4">
        <Row k="Recipient" v={SAMPLE.recipient} ident state="ok" />
        <Row k="Amount" v={`${bad ? SAMPLE.changedAmount : SAMPLE.amount} ${SAMPLE.currency}`} state={bad ? "bad" : "ok"} />
        <Row k="Continuing permission" v="None" state="ok" />
        <Row k="Use" v="Once" state="ok" />
      </div>
    </div>
  );
}

/** Phone approval with the press-and-hold control (illustration, not interactive). */
export function PhoneApproval({ approved, className }: { approved?: boolean; className?: string }) {
  return (
    <div className={cn("w-[236px] rounded-[36px] border border-white/15 bg-black p-2.5", className)}>
      <div className="rounded-[28px] border border-line bg-[#131312] px-4 pb-4 pt-3">
        <div aria-hidden className="mx-auto h-1.5 w-14 rounded-full bg-white/15" />
        <Label className="mt-5">Approve payment</Label>
        <p className="mt-2 text-[13px] text-muted">{SAMPLE.merchant}</p>
        <p className="tabular mt-1 text-[32px] font-semibold leading-none tracking-tight">
          {SAMPLE.amount} <span className="text-[13px] font-medium text-muted">{SAMPLE.currency}</span>
        </p>
        <div className="mt-4 space-y-2 text-[12px]">
          <div className="flex justify-between gap-2 border-t border-line pt-2">
            <span className="text-muted">To</span>
            <span className="ident text-[11px]">{SAMPLE.recipient}</span>
          </div>
          <div className="flex justify-between gap-2 border-t border-line pt-2">
            <span className="text-muted">Permission</span>
            <span>Once, nothing after</span>
          </div>
        </div>
        <div
          className={cn(
            "mt-5 flex h-11 items-center justify-center gap-2 rounded-full text-[13px] font-semibold",
            approved ? "bg-mint text-black" : "border border-line text-fg",
          )}
        >
          {approved ? <Check aria-hidden className="size-4" /> : <Fingerprint aria-hidden className="size-4" />}
          {approved ? "Approved" : "Press and hold"}
        </div>
      </div>
    </div>
  );
}

function Node({ title, sub, value, tone }: { title: string; sub: string; value?: string; tone?: "mint" | "coral" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-[#191918] p-4 sm:flex-1">
      <Label>{title}</Label>
      <p className="ident mt-2 text-[12px] text-muted">{sub}</p>
      {value && (
        <p className={cn("tabular mt-3 text-[22px] font-semibold leading-none tracking-tight", tone === "mint" && "text-mint", tone === "coral" && "text-coral")}>
          {value}
        </p>
      )}
    </div>
  );
}

function Wire({ on, tone }: { on: boolean; tone: "mint" | "coral" }) {
  return (
    <div aria-hidden className="relative mx-auto h-5 w-px shrink-0 bg-white/15 sm:mx-1 sm:h-px sm:w-10 sm:self-center">
      <motion.span
        className={cn("absolute inset-0", tone === "mint" ? "bg-mint" : "bg-coral")}
        initial={false}
        animate={{ opacity: on ? 1 : 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      />
    </div>
  );
}

/** Payer -> CounterSign -> Recipient. A matching payment settles; a changed payment is stopped at CounterSign. */
export function FlowRail({ attempt, resolved = true, className }: { attempt: Attempt; resolved?: boolean; className?: string }) {
  const ok = attempt === "match";
  const done = resolved;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-col items-stretch sm:flex-row">
        <Node title="Payer" sub={SAMPLE.payer} value={`${done && ok ? SAMPLE.balanceAfter : SAMPLE.balanceBefore} ${SAMPLE.currency}`} />
        <Wire on={done} tone={ok ? "mint" : "coral"} />
        <div className={cn("flex shrink-0 flex-row items-center justify-center gap-x-2 rounded-2xl border p-3 text-center sm:w-[132px] sm:flex-col", done ? (ok ? "border-mint/60" : "border-coral/60") : "border-line")}>
          <ShieldCheck aria-hidden className={cn("size-5", done ? (ok ? "text-mint" : "text-coral") : "text-muted")} />
          <p className="text-[12px] font-semibold sm:mt-2">CounterSign</p>
          <p className="text-[11px] text-muted sm:mt-0.5">{done ? (ok ? "Terms match" : "Terms differ") : "Checking terms"}</p>
        </div>
        <Wire on={done && ok} tone="mint" />
        <Node
          title="Recipient"
          sub={SAMPLE.recipient}
          value={done ? (ok ? `+${SAMPLE.amount} ${SAMPLE.currency}` : `0.00 ${SAMPLE.currency}`) : undefined}
          tone={done && ok ? "mint" : undefined}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${attempt}-${done}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-[#191918] px-4 py-3 text-[13px]"
        >
          <span className="text-muted">
            {!done
              ? "Nothing moves until the attempt is checked against the approved terms."
              : ok
                ? `Payer balance moves by ${SAMPLE.amount} ${SAMPLE.currency}. The permission is spent.`
                : "Reason: AMOUNT_MISMATCH. Payer balance unchanged."}
          </span>
          <Pill tone={!done ? "amber" : ok ? "mint" : "coral"}>{!done ? "Waiting" : ok ? "Settled" : "Stopped"}</Pill>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

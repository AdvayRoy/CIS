"use client";
// Product entry page (w/product). Page copy is English only; brand, tagline, reasons and status labels come from the `common` namespace.
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowRight, Check, FlaskConical, ListChecks, ShieldCheck, ShoppingBag, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { BANK_ACCOUNTS } from "@/shared/contract";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";

type Field = "recipient" | "amount" | "permission" | "use";
type Scenario = { id: string; label: string; reason: string; changed: Field | null; value?: string; outcome: string };

const APPROVED: Record<Field, { label: string; value: string; ident?: boolean }> = {
  recipient: { label: "Recipient", value: BANK_ACCOUNTS.merchant, ident: true },
  amount: { label: "Amount", value: "100.00 AED" },
  permission: { label: "Continuing permission", value: "None" },
  use: { label: "Use", value: "Once" },
};
const FIELDS: Field[] = ["recipient", "amount", "permission", "use"];
const SCENARIOS: Scenario[] = [
  { id: "exact", label: "Exactly as approved", reason: "OK", changed: null, outcome: "Balance moves by 100.00 AED." },
  { id: "recipient", label: "Different recipient", reason: "RECIPIENT_MISMATCH", changed: "recipient", value: BANK_ACCOUNTS.attacker, outcome: "Balance unchanged." },
  { id: "amount", label: "Amount ×5", reason: "AMOUNT_MISMATCH", changed: "amount", value: "500.00 AED", outcome: "Balance unchanged." },
  { id: "permission", label: "Standing permission", reason: "CONTINUING_PERMISSION_NOT_ALLOWED", changed: "permission", value: "Unlimited", outcome: "Balance unchanged." },
  { id: "replay", label: "Sent a second time", reason: "REPLAYED", changed: "use", value: "Second time", outcome: "No second debit." },
];

const STEPS = [
  { n: 1, icon: ShoppingBag, title: "A merchant asks for one payment", body: "Checkout creates a request with a recipient identifier, an exact amount and an expiry.", href: "/shop", cta: "Checkout" },
  { n: 2, icon: Smartphone, title: "You approve the facts on your phone", body: "Scan the code, read the recipient, the amount, the one-use limit and the expiry, then press and hold.", href: null, cta: "Opened from the QR code" },
  { n: 3, icon: Check, title: "The rail executes exactly that", body: "The request is compared with what you approved. A match is paid once and leaves no permission behind.", href: "/command", cta: "Payments" },
  { n: 4, icon: FlaskConical, title: "Anything else is stopped", body: "Change the recipient or the amount, ask for a standing permission or send it twice: no money moves.", href: "/lab", cta: "Lab (operator)" },
] as const;

const AUDIENCES = [
  { who: "Payer", what: "One approval screen with the exact recipient, amount and one-use limit, and a receipt that shows what executed." },
  { who: "Merchant", what: "A payment that executed as approved, with a record of the terms both sides saw." },
  { who: "Bank, wallet or exchange", what: "An evidence record per payment: what was agreed, what was requested, what executed or why it stopped." },
];

function RuleDemo() {
  const tc = useTranslations("common");
  const [id, setId] = useState("exact");
  const s = SCENARIOS.find((x) => x.id === id) ?? SCENARIOS[0];
  const ok = s.changed === null;
  return (
    <section aria-labelledby="rule-title" className="rounded-[24px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rule-title" className="text-sm text-muted">Try the rule</h2>
        <p className="text-xs text-muted">Illustration. The live rails are in Checkout and Lab.</p>
      </div>
      <div role="radiogroup" aria-label="Request sent to the rail" className="mt-4 flex flex-wrap gap-2">
        {SCENARIOS.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={x.id === id} onClick={() => setId(x.id)}
            className={cn("min-h-10 rounded-full border px-4 text-[13px] transition-colors duration-200",
              x.id === id ? (x.changed ? "border-coral/60 bg-coral/10 text-coral" : "border-mint/60 bg-mint/10 text-mint") : "border-line text-muted hover:bg-surface-2 hover:text-fg")}>
            {x.label}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {(["approved", "requested"] as const).map((side) => (
          <div key={side} className="rounded-[16px] border border-line bg-white/5 p-4">
            <p className="text-xs text-muted">{side === "approved" ? "You approved" : "Request sent to the rail"}</p>
            <dl className="mt-2 space-y-1.5 text-[13px]">
              {FIELDS.map((f) => {
                const differs = side === "requested" && s.changed === f;
                const a = APPROVED[f];
                return (
                  <div key={f} className={cn("flex items-baseline justify-between gap-3 rounded-lg px-2 py-1 transition-colors duration-200", differs && "bg-coral/10")}>
                    <dt className={cn("shrink-0", differs ? "text-coral" : "text-muted")}>{a.label}</dt>
                    <dd className={cn("tabular min-w-0 text-end", a.ident && "ident text-[12px]", differs ? "text-coral" : "text-fg")}>{differs ? s.value : a.value}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
      <div role="status" aria-live="polite" className="mt-3 min-h-14">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
            className={cn("flex items-center gap-3 rounded-[16px] border px-4 py-3 text-sm", ok ? "border-mint/40 bg-mint/10 text-mint" : "border-coral/40 bg-coral/10 text-coral")}>
            {ok ? <Check aria-hidden className="size-4 shrink-0" /> : <X aria-hidden className="size-4 shrink-0" />}
            <span><span className="font-medium">{ok ? tc("state.settled") : s.id === "replay" ? "Not executed again" : tc("state.rejected")}.</span> {tc(`reason.${s.reason}`)}. {s.outcome}</span>
          </motion.p>
        </AnimatePresence>
      </div>
    </section>
  );
}

export function Entry() {
  const tc = useTranslations("common");
  const navLink = "rounded-full px-3 py-2 text-[13px] text-muted transition-colors duration-200 hover:bg-surface hover:text-fg";
  return (
    <MotionConfig reducedMotion="user">
      <header className="glass-bar sticky top-0 z-20 border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="me-2 flex items-center gap-2.5">
            <span className="btn-primary flex size-9 items-center justify-center rounded-[14px]"><ShieldCheck aria-hidden className="size-5" /></span>
            <span className="text-[15px] font-semibold tracking-tight">{tc("brand")}</span>
          </Link>
          <nav aria-label="Product" className="hidden items-center sm:flex">
            <Link href="/shop" className={navLink}>Checkout</Link>
            <Link href="/command" className={navLink}>Payments</Link>
            <Link href="/evidence" className={navLink}>Evidence</Link>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSelector />
            <Link href="/lab" className={cn(navLink, "hidden items-center gap-1.5 border border-line sm:inline-flex")}><FlaskConical aria-hidden className="size-4" />Lab (operator)</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div>
            <h1 className="mt-3 text-5xl leading-[1.04] sm:text-[64px]"><span className="hero-amount">{tc("tagline")}</span></h1>
            <p className="mt-4 text-lg text-fg">This recipient. This amount. Once.</p>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
              You approve the facts of one payment on your phone. The rail executes exactly those facts and refuses any request that differs, with evidence either way.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-primary inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm">Start a payment<ArrowRight aria-hidden className="size-4 rtl:rotate-180" /></Link>
              <Link href="/command" className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-6 text-sm text-fg transition-colors duration-200 hover:bg-surface-2"><ListChecks aria-hidden className="size-4" />View payments</Link>
            </div>
            
          </div>
          <RuleDemo />
        </section>

        <section aria-labelledby="journey-title">
          <h2 id="journey-title" className="text-sm text-muted">How one payment goes</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => {
              const inner = (<>
                <span className="flex items-center justify-between">
                  <span className="tabular flex size-8 items-center justify-center rounded-full border border-line bg-white/10 text-xs text-fg">{s.n}</span>
                  <s.icon aria-hidden className="size-5 text-muted transition-colors duration-200 group-hover:text-fg" />
                </span>
                <span className="mt-4 block text-[15px] font-medium text-fg">{s.title}</span>
                <span className="mt-1.5 block text-[13px] leading-relaxed text-muted">{s.body}</span>
                <span className={cn("mt-4 flex items-center gap-1.5 text-[13px]", s.href ? "text-fg" : "text-muted")}>{s.cta}{s.href && <ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180" />}</span>
              </>);
              const cls = "group flex h-full flex-col rounded-[24px] border border-line bg-surface p-5 transition-transform duration-200";
              return <li key={s.n}>{s.href ? <Link href={s.href} className={cn(cls, "hover:-translate-y-0.5")}>{inner}</Link> : <div className={cls}>{inner}</div>}</li>;
            })}
          </ol>
        </section>

        <section aria-labelledby="who-title">
          <h2 id="who-title" className="text-sm text-muted">Who gets what</h2>
          <dl className="mt-4 grid gap-3 lg:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div key={a.who} className="rounded-[24px] border border-line bg-surface p-5">
                <dt className="text-[15px] font-medium text-fg">{a.who}</dt>
                <dd className="mt-1.5 text-[13px] leading-relaxed text-muted">{a.what}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="border-t border-line pt-5 text-xs leading-relaxed text-muted">
          <p>Prototype limits: one simulated bank ledger and one token purchase on a private local chain. Approvals are signed by a disclosed server-side demo signer. The recipient name is shown as supplied and is not a verified identity.</p>
          <p className="mt-1.5">CounterSign does not detect scams, verify merchants, access real banks or recover settled funds. A payment you approve is executed exactly as approved.</p>
        </footer>
      </main>
    </MotionConfig>
  );
}

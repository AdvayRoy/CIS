"use client";
// Product entry page (w/product). Page copy is English only; brand, tagline, reasons and status labels come from the `common` namespace.
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowRight, Check, ClipboardCheck, FlaskConical, ListChecks, ShieldAlert, ShoppingBag, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { BANK_ACCOUNTS } from "@/shared/contract";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";
import { ProductBar } from "@/components/product/Journey";
import { AttemptField, Panel, TermsRule } from "@/components/product/entryPanels";
import { StepsScroll } from "@/components/product/entrySteps";

const label = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted";

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
  { n: 1, icon: ShoppingBag, title: "A merchant asks for one payment", body: "Checkout creates a request with a recipient identifier, an exact amount and an expiry.", href: "/shop", cta: "Open checkout" },
  { n: 2, icon: Smartphone, title: "You approve the facts on your phone", body: "Scan the code, read the recipient, the amount, the one-use limit and the expiry, then press and hold.", href: "/command", cta: "Pair a phone" },
  { n: 3, icon: Check, title: "The rail executes exactly that", body: "The request is compared with what you approved. A match is paid once and leaves no permission behind.", href: "/command", cta: "Watch payments" },
  { n: 4, icon: ShieldAlert, title: "Anything else is stopped", body: "Change the recipient or the amount, ask for a standing permission or send it twice: no money moves.", href: "/lab", cta: "Lab (operator)" },
  { n: 5, icon: ClipboardCheck, title: "Evidence either way", body: "Each attempt records what was approved, what was requested, the decision and the balances read afterwards.", href: "/evidence", cta: "Open evidence" },
] as const;

function RuleDemo() {
  const tc = useTranslations("common");
  const [id, setId] = useState("exact");
  const s = SCENARIOS.find((x) => x.id === id) ?? SCENARIOS[0];
  const ok = s.changed === null;
  return (
    <section aria-labelledby="rule-title" className="mx-auto w-full min-w-0 max-w-4xl rounded-[28px] border border-line bg-[#191918] p-5 sm:p-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rule-title" className={label}>Try the rule</h2>
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
          <div key={side} className="min-w-0 rounded-[12px] border border-line p-4">
            <p className={label}>{side === "approved" ? "You approved" : "Request sent to the rail"}</p>
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
          <motion.p key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: [0.165, 0.84, 0.44, 1] }}
            className={cn("flex items-center gap-3 rounded-[12px] border px-4 py-3 text-sm", ok ? "border-mint/50 text-mint" : "border-coral/50 text-coral")}>
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
  const tagline = tc("tagline");
  const cut = tagline.search(/[.!?\u061F\u3002]\s/);
  const head = cut < 0 ? tagline : tagline.slice(0, cut + 1);
  const tail = cut < 0 ? "" : tagline.slice(cut + 2);
  return (
    <MotionConfig reducedMotion="user">
      <ProductBar>
        <LanguageSelector />
        <Link href="/lab" className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-fg sm:inline-flex"><FlaskConical aria-hidden className="size-4" />Lab (operator)</Link>
      </ProductBar>

      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-16 px-4 pb-10 pt-12 sm:gap-24 sm:px-6 sm:pt-20 lg:px-10">
        <section className="flex flex-col items-center text-center">
          <p className={label}>Product demo</p>
          <h1 className="mt-5 font-sans text-[44px] font-medium leading-[1.04] tracking-[-0.035em] sm:text-[72px]">
            <span className="hero-amount block">{head}</span>
            {tail && <span className="block text-muted">{tail}</span>}
          </h1>
          <p className="mt-6 text-lg text-fg">This recipient. This amount. Once.</p>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            You approve the facts of one payment on your phone. The rail executes exactly those facts and refuses any request that differs, with evidence either way.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/shop" className="inline-flex h-12 items-center gap-2 rounded-full bg-mint px-6 text-sm font-semibold text-black hover:bg-fg">Launch demo<ArrowRight aria-hidden className="size-4 rtl:rotate-180" /></Link>
            <Link href="/command" className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-6 text-sm text-fg transition-colors duration-200 hover:bg-surface-2"><ListChecks aria-hidden className="size-4" />View payments</Link>
          </div>
          <p className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px] text-muted">
            <Link href="/landing" className="underline-offset-4 transition-colors duration-200 hover:text-fg hover:underline">About CounterSign</Link>
            <Link href="/evidence" className="underline-offset-4 transition-colors duration-200 hover:text-fg hover:underline">Evidence Lab</Link>
          </p>
          <div className="mt-12 grid w-full gap-4 text-start sm:mt-16 sm:gap-6 lg:grid-cols-2">
            <Panel title="Approved terms"><TermsRule /></Panel>
            <Panel title="Attempted payments"><AttemptField /></Panel>
          </div>
        </section>

        <RuleDemo />

        <section aria-labelledby="journey-title">
          <h2 id="journey-title" className={label}>How one payment goes</h2>
          <StepsScroll steps={STEPS} />
        </section>

        <footer className="border-t border-line pt-5 text-xs leading-relaxed text-muted">
          <p>Prototype limits: one simulated bank ledger and one token purchase on a private local chain. Approvals are signed by a disclosed server-side demo signer. The recipient name is shown as supplied and is not a verified identity.</p>
          <p className="mt-1.5">CounterSign does not detect scams, verify merchants, access real banks or recover settled funds. A payment you approve is executed exactly as approved.</p>
        </footer>
      </main>
    </MotionConfig>
  );
}

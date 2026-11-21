"use client";
// CounterSign marketing page (/landing). Copy is English only; every interface piece is an illustration with sample values.
import { useRef, useState } from "react";
import Link from "next/link";
import { MotionConfig, motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, ArrowUpRight, FileCheck2, Fingerprint, Landmark, Repeat1, ShieldCheck, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { AttemptCard, EASE, FlowRail, Label, PhoneApproval, Pill, SAMPLE, SERIF, TermsCard, usePrefersReducedMotion, type Attempt } from "./pieces";
import { ScrollStory } from "./ScrollStory";

const WRAP = "mx-auto w-full max-w-[1240px] px-5 sm:px-8";
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.4, ease: EASE },
} as const;

function Cta({ className, children = "Launch the demo" }: { className?: string; children?: React.ReactNode }) {
  return (
    <Link
      href="/shop"
      className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-full bg-mint px-5 text-[14px] font-semibold text-black hover:bg-[#FAF9F5]", className)}
    >
      {children}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[#131312]/90 backdrop-blur-md">
      <div className={cn(WRAP, "flex h-14 items-center justify-between gap-4")}>
        <Link href="/landing" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <ShieldCheck aria-hidden className="size-[18px] text-mint" />
          CounterSign
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 text-[13px] text-muted md:flex">
          <a href="#product" className="hover:text-fg">Product</a>
          <a href="#how" className="hover:text-fg">How it works</a>
          <Link href="/command" className="hover:text-fg">Command centre</Link>
          <Link href="/evidence" className="hover:text-fg">Evidence</Link>
        </nav>
        <Cta className="h-9 px-4 text-[13px]" />
      </div>
    </header>
  );
}

function Hero() {
  const [attempt, setAttempt] = useState<Attempt>("match");
  const stage = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: stage, offset: ["start end", "start 0.25"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.955, 1]);
  return (
    <section className="pt-12 sm:pt-16">
      <div className={WRAP}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
          <Label>Payment agreement enforcement</Label>
          <h1 className="mt-5 text-[46px] leading-[1] sm:text-[76px] lg:text-[96px]">
            <span className="block">One payment.</span> <span className="block text-muted">Exactly as agreed.</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-muted sm:text-[19px]">
            The customer approves one payment. CounterSign enforces the agreed recipient, amount and spending permissions, and stops anything else.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Cta />
            <Link href="/command" className="inline-flex items-center gap-1.5 text-[14px] text-fg hover:text-mint">
              Open the command centre <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </div>
        </motion.div>

        <motion.div
          id="product"
          ref={stage}
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE, delay: 0.12 }}
          style={reduce ? undefined : { scale, transformOrigin: "50% 0%" }}
          className="mt-12 scroll-mt-20 rounded-t-[24px] border border-b-0 border-line bg-[#0D0D0C] p-4 sm:mt-14 sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="group" aria-label="Choose what the app attempts" className="inline-flex rounded-full border border-line p-[3px]">
              {(["match", "changed"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={attempt === a}
                  onClick={() => setAttempt(a)}
                  className={cn("h-9 rounded-full px-4 text-[13px]", attempt === a ? "bg-[#FAF9F5] font-semibold text-black" : "text-muted hover:text-fg")}
                >
                  {a === "match" ? "Matching payment" : "Changed payment"}
                </button>
              ))}
            </div>
            <Label>Illustration · sample values</Label>
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <TermsCard checked />
              <p className="mt-3 text-[12px] text-muted">1 · What the customer intended</p>
            </div>
            <div className="min-w-0">
              <AttemptCard attempt={attempt} />
              <p className="mt-3 text-[12px] text-muted">2 · What the app attempted</p>
            </div>
            <div className="hidden justify-self-center lg:block">
              <PhoneApproval approved />
            </div>
          </div>
          <div className="mt-6">
            <FlowRail attempt={attempt} />
            <p className="mt-3 text-[12px] text-muted">3 · What CounterSign enforced &nbsp; 4 · What happened to the money</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Card({ className, icon: Icon, title, body, children }: { className?: string; icon: typeof Target; title: string; body: string; children?: React.ReactNode }) {
  return (
    <motion.article {...reveal} className={cn("flex flex-col rounded-2xl border border-line bg-[#191918] p-6 sm:p-7", className)}>
      <Icon aria-hidden className="size-5 text-muted" />
      <h3 className="mt-5 text-[22px] font-semibold leading-tight tracking-tight">{title}</h3>
      <p className="mt-2 max-w-[44ch] text-[14px] leading-relaxed text-muted">{body}</p>
      {children && <div className="mt-auto pt-6">{children}</div>}
    </motion.article>
  );
}

function Bento() {
  return (
    <section className="border-t border-line py-20 sm:py-28">
      <div className={WRAP}>
        <motion.div {...reveal}>
          <Label>What is enforced</Label>
          <h2 className={cn(SERIF, "mt-4 max-w-[18ch] text-[40px] leading-[1.02] tracking-tight sm:text-[64px]")}>
            The approval is the limit. <span className="text-muted">Nothing wider.</span>
          </h2>
        </motion.div>
        <div className="mt-12 grid gap-4 md:grid-cols-6">
          <Card className="md:col-span-3" icon={Target} title="Exact recipient" body="The payment can only reach the account named in the agreement. A different destination is stopped.">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="ident rounded-full border border-line px-3 py-1.5">{SAMPLE.recipient}</span>
              <Pill tone="mint">Agreed</Pill>
              <span className="ident rounded-full border border-line px-3 py-1.5 text-muted line-through">{SAMPLE.otherRecipient}</span>
              <Pill tone="coral">Stopped</Pill>
            </div>
          </Card>
          <Card className="md:col-span-3" icon={ShieldCheck} title="Exact amount" body="Not a cap, not a range. The figure the customer saw is the only figure that can move.">
            <p className="tabular text-[56px] font-semibold leading-none tracking-tight sm:text-[72px]">
              {SAMPLE.amount} <span className="text-[18px] font-medium text-muted">{SAMPLE.currency}</span>
            </p>
          </Card>
          <Card className="md:col-span-2" icon={Repeat1} title="Once" body="The permission is spent when the payment settles. Sending it a second time moves nothing." />
          <Card className="md:col-span-2" icon={Fingerprint} title="Approved on the phone" body="The customer reads the terms on their own device and presses and holds to approve." />
          <Card className="md:col-span-2" icon={Landmark} title="Bank and crypto rails" body="The demo runs a simulated bank ledger and a local-chain test token under the same rule." />
          <motion.article {...reveal} className="grid gap-8 rounded-2xl border border-line bg-[#191918] p-6 sm:p-7 md:col-span-6 md:grid-cols-2 md:items-center">
            <div className="min-w-0">
              <FileCheck2 aria-hidden className="size-5 text-muted" />
              <h3 className="mt-5 text-[22px] font-semibold leading-tight tracking-tight">Evidence for every attempt</h3>
              <p className="mt-2 max-w-[44ch] text-[14px] leading-relaxed text-muted">
                Each attempt leaves a record of what was approved, what was attempted, what was enforced and what moved.
              </p>
              <Link href="/evidence" className="mt-6 inline-flex items-center gap-1.5 text-[14px] text-fg hover:text-mint">
                Open the Evidence Lab <ArrowUpRight aria-hidden className="size-4" />
              </Link>
            </div>
            <dl className="min-w-0 rounded-2xl border border-line bg-[#131312] px-5 text-[13px]">
              {[
                ["Approved", `${SAMPLE.amount} ${SAMPLE.currency}`, SAMPLE.recipient],
                ["Attempted", `${SAMPLE.changedAmount} ${SAMPLE.currency}`, SAMPLE.recipient],
                ["Enforced", "Stopped", "AMOUNT_MISMATCH"],
                ["Moved", `0.00 ${SAMPLE.currency}`, "Payer balance unchanged"],
              ].map(([k, v, sub], i) => (
                <div key={k} className={cn("flex items-baseline justify-between gap-4 py-3", i > 0 && "border-t border-line")}>
                  <dt className="text-muted">{k}</dt>
                  <dd className="min-w-0 text-end">
                    <span className={cn("tabular font-semibold", k === "Enforced" && "text-coral")}>{v}</span>
                    <span className={cn("block text-[12px] text-muted", (k === "Enforced" || i < 2) && "ident")}>{sub}</span>
                  </dd>
                </div>
              ))}
              <p className="border-t border-line py-3 text-[11px] uppercase tracking-[0.14em] text-muted">Illustration · sample values</p>
            </dl>
          </motion.article>
        </div>
      </div>
    </section>
  );
}

const QUESTIONS = [
  { n: "01", q: "What did the customer intend?", a: "One payment, to one recipient, for one amount, with no permission left over." },
  { n: "02", q: "What did the app attempt?", a: "The exact instruction the application submitted, shown next to the approved terms." },
  { n: "03", q: "What did CounterSign enforce?", a: "A match settles. Any difference in recipient, amount, permission or use is stopped." },
  { n: "04", q: "What happened to the money?", a: "Balances come from the ledger or the chain, not from the app that asked." },
];

function Editorial() {
  return (
    <section className="bg-[#FAF9F5] py-20 text-[#131312] sm:py-28">
      <div className={WRAP}>
        <motion.h2 {...reveal} className={cn(SERIF, "max-w-[16ch] text-[40px] leading-[1.02] tracking-tight sm:text-[72px]")}>
          Four questions every payment should answer.
        </motion.h2>
        <div className="mt-14 grid gap-x-8 gap-y-10 border-t border-black/15 pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {QUESTIONS.map((x, i) => (
            <motion.div key={x.n} {...reveal} transition={{ duration: 0.4, ease: EASE, delay: i * 0.06 }}>
              <p className="tabular text-[13px] font-medium text-black/50">{x.n}</p>
              <h3 className="mt-3 text-[20px] font-semibold leading-snug tracking-tight">{x.q}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-black/65">{x.a}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-black">
      <div className={cn(WRAP, "py-20 sm:py-28")}>
        <motion.div {...reveal}>
          <h2 className={cn(SERIF, "text-[44px] leading-[1] tracking-tight sm:text-[76px] lg:text-[88px]")}>
            <span className="block">One payment.</span> <span className="block text-muted">Exactly as agreed.</span>
          </h2>
          <p className="mt-6 max-w-[520px] text-[16px] leading-relaxed text-muted">
            Run a payment end to end in the working demo: place an order, approve it on the phone, then try to change it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Cta />
            <Link href="/command" className="text-[14px] text-fg hover:text-mint">Command centre</Link>
            <Link href="/evidence" className="text-[14px] text-fg hover:text-mint">Evidence Lab</Link>
          </div>
        </motion.div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[12px] text-muted">
          <span className="flex items-center gap-2 font-semibold text-fg">
            <ShieldCheck aria-hidden className="size-4 text-mint" /> CounterSign
          </span>
          <span>Demo environment. All funds are simulated or local test tokens. No real transfers.</span>
        </div>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <div lang="en" dir="ltr" className="flex min-h-0 flex-1 flex-col bg-bg text-fg">
        <Nav />
        <main>
          <Hero />
          <Bento />
          <ScrollStory />
          <Editorial />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}

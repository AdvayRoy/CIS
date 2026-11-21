"use client";
// CounterSign marketing page (/landing). Copy is English only; every interface piece is an illustration with sample values.
import Link from "next/link";
import { MotionConfig, motion } from "motion/react";
import { ArrowRight, ArrowUpRight, FileCheck2, Fingerprint, Landmark, Repeat1, ShieldCheck, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE, Pill, SAMPLE } from "./pieces";
import { PANEL, ProductPanel, RailsGlobe, RuleBuilder, SampleNote } from "./HeroPanels";
import { ScrollStory } from "./ScrollStory";

const WRAP = "mx-auto w-full max-w-[1240px] px-5 sm:px-8";
const H1 = "font-sans text-[38px] font-medium leading-[1.02] tracking-[-0.035em] sm:text-[76px] lg:text-[92px]";
const H2 = "font-sans text-[32px] font-medium leading-[1.04] tracking-[-0.03em] sm:text-[52px] lg:text-[64px]";
const EYEBROW = "text-[12px] font-medium uppercase tracking-[0.14em] text-[#66645E]";
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
    <header className="sticky top-0 z-40 border-b border-black/10 bg-[#FAF9F5] text-[#131312]">
      <div className={cn(WRAP, "flex h-14 items-center justify-between gap-4")}>
        <Link href="/landing" className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
          <ShieldCheck aria-hidden className="size-[18px]" />
          CounterSign
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-8 text-[14px] text-[#131312] md:flex">
          <a href="#product" className="hover:text-[#66645E]">Product</a>
          <a href="#how" className="hover:text-[#66645E]">How it works</a>
          <Link href="/command" className="hover:text-[#66645E]">Command centre</Link>
          <Link href="/evidence" className="hover:text-[#66645E]">Evidence</Link>
        </nav>
        <Cta className="h-9 bg-[#131312] px-4 text-[13px] text-[#FAF9F5] hover:bg-black hover:text-mint" />
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="bg-[#FAF9F5] pb-20 pt-14 text-[#131312] sm:pb-28 sm:pt-24">
      <div className={WRAP}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mx-auto flex max-w-[900px] flex-col items-center text-center"
        >
          <h1 className={H1}>
            <span className="block">One payment.</span> <span className="block text-[#77756D]">Exactly as agreed.</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-[#66645E] sm:text-[19px]">
            The customer approves one payment. CounterSign enforces the agreed recipient, amount and use, and stops anything else.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Cta className="h-12 px-6 text-[15px] hover:bg-[#131312] hover:text-mint" />
            <Link href="/command" className="inline-flex h-12 items-center gap-1.5 rounded-full bg-[#131312] px-6 text-[15px] font-semibold text-[#FAF9F5] hover:bg-black">
              Command centre <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </div>
        </motion.div>

        <motion.div
          id="product"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.12 }}
          className="mt-14 grid scroll-mt-20 gap-x-6 gap-y-10 sm:mt-20 lg:grid-cols-2"
        >
          <ProductPanel title="Approved terms become the rule" body="Recipient, exact amount, one use. An attempt that differs is stopped with a reason code, and the attempt is recorded as evidence.">
            <RuleBuilder />
          </ProductPanel>
          <ProductPanel title="Bank and crypto, one check" body="The demo runs a simulated bank ledger and a local test token. Both rails pass through the same comparison before anything moves.">
            <RailsGlobe />
          </ProductPanel>
        </motion.div>
      </div>
    </section>
  );
}

function Card({ className, icon: Icon, title, body, children }: { className?: string; icon: typeof Target; title: string; body: string; children?: React.ReactNode }) {
  return (
    <motion.article {...reveal} className={cn(PANEL, "flex flex-col p-6 sm:p-8", className)}>
      <span aria-hidden className="grid size-10 place-items-center rounded-[12px] bg-white text-[#131312]">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-6 text-[22px] font-semibold leading-tight tracking-tight">{title}</h3>
      <p className="mt-2 max-w-[44ch] text-[15px] leading-relaxed text-[#66645E]">{body}</p>
      {children && <div className="mt-auto pt-8">{children}</div>}
    </motion.article>
  );
}

function Bento() {
  return (
    <section className="bg-[#FAF9F5] pb-20 text-[#131312] sm:pb-28">
      <div className={WRAP}>
        <motion.div {...reveal} className="mx-auto max-w-[820px] text-center">
          <p className={EYEBROW}>What is enforced</p>
          <h2 className={cn(H2, "mt-4")}>
            <span className="block">The approval is the limit.</span> <span className="block text-[#77756D]">Nothing wider.</span>
          </h2>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:mt-16 sm:gap-6 md:grid-cols-6">
          <Card className="md:col-span-3" icon={Target} title="Exact recipient" body="The payment can only reach the account named in the agreement. A different destination is stopped.">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="ident rounded-[10px] bg-white px-3 py-2">{SAMPLE.recipient}</span>
              <Pill tone="mint">Agreed</Pill>
              <span className="ident rounded-[10px] bg-white px-3 py-2 text-[#66645E] line-through">{SAMPLE.otherRecipient}</span>
              <Pill tone="coral">Stopped</Pill>
            </div>
            <SampleNote className="mt-5" />
          </Card>
          <Card className="md:col-span-3" icon={ShieldCheck} title="Exact amount" body="Not a cap, not a range. The figure the customer saw is the only figure that can move.">
            <p className="tabular text-[56px] font-medium leading-none tracking-[-0.03em] sm:text-[80px]">
              {SAMPLE.amount} <span className="text-[18px] font-medium tracking-normal text-[#66645E]">{SAMPLE.currency}</span>
            </p>
            <SampleNote className="mt-5" />
          </Card>
          <Card className="md:col-span-2" icon={Repeat1} title="Once" body="The permission is spent when the payment settles. Sending it a second time moves nothing." />
          <Card className="md:col-span-2" icon={Fingerprint} title="Approved on the phone" body="The customer reads the terms on their own device and presses and holds to approve." />
          <Card className="md:col-span-2" icon={Landmark} title="Bank and crypto rails" body="The demo runs a simulated bank ledger and a local-chain test token under the same rule." />
          <motion.article {...reveal} className={cn(PANEL, "grid gap-8 p-6 sm:p-8 md:col-span-6 md:grid-cols-2 md:items-center lg:p-12")}>
            <div className="min-w-0">
              <span aria-hidden className="grid size-10 place-items-center rounded-[12px] bg-white">
                <FileCheck2 className="size-5" />
              </span>
              <h3 className="mt-6 text-[28px] font-medium leading-tight tracking-[-0.02em] sm:text-[36px]">Evidence for every attempt</h3>
              <p className="mt-3 max-w-[44ch] text-[15px] leading-relaxed text-[#66645E]">
                Each attempt leaves a record of what was approved, what was attempted, what was enforced and what moved.
              </p>
              <Link href="/evidence" className="mt-7 inline-flex h-11 items-center gap-1.5 rounded-full bg-[#131312] px-5 text-[14px] font-semibold text-[#FAF9F5] hover:bg-black">
                See the evidence <ArrowUpRight aria-hidden className="size-4" />
              </Link>
            </div>
            <dl className="min-w-0 rounded-[20px] bg-white px-5 text-[14px] shadow-[0_24px_48px_-28px_rgba(19,19,18,0.35)] sm:px-6">
              {[
                ["Approved", `${SAMPLE.amount} ${SAMPLE.currency}`, SAMPLE.recipient],
                ["Attempted", `${SAMPLE.changedAmount} ${SAMPLE.currency}`, SAMPLE.recipient],
                ["Enforced", "Stopped", "AMOUNT_MISMATCH"],
                ["Moved", `0.00 ${SAMPLE.currency}`, "Payer balance unchanged"],
              ].map(([k, v, sub], i) => (
                <div key={k} className={cn("flex items-baseline justify-between gap-4 py-3.5", i > 0 && "border-t border-black/10")}>
                  <dt className="text-[#66645E]">{k}</dt>
                  <dd className="min-w-0 text-end">
                    <span className={cn("tabular font-semibold", k === "Enforced" && "text-[#B8203A]")}>{v}</span>
                    <span className={cn("block text-[12px] text-[#66645E]", (k === "Enforced" || i < 2) && "ident")}>{sub}</span>
                  </dd>
                </div>
              ))}
              <SampleNote className="border-t border-black/10 py-3.5" />
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
        <motion.h2 {...reveal} className={cn(H2, "mx-auto max-w-[1000px] text-center")}>
          <span className="block">Four questions.</span> <span className="block text-[#77756D]">Answered for every payment.</span>
        </motion.h2>
        <div className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {QUESTIONS.map((x, i) => (
            <motion.div key={x.n} {...reveal} transition={{ duration: 0.4, ease: EASE, delay: i * 0.06 }} className={cn(PANEL, "p-6 sm:p-7")}>
              <p className="tabular grid size-10 place-items-center rounded-[12px] bg-white text-[13px] font-semibold">{x.n}</p>
              <h3 className="mt-6 text-[20px] font-semibold leading-snug tracking-tight">{x.q}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#66645E]">{x.a}</p>
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
          <h2 className={H1}>
            <span className="block">One payment.</span> <span className="block text-muted">Exactly as agreed.</span>
          </h2>
          <p className="mt-6 max-w-[520px] text-[16px] leading-relaxed text-muted">
            Run a payment end to end in the working demo: place an order, approve it on the phone, then try to change it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Cta />
            <Link href="/command" className="text-[14px] text-fg hover:text-mint">Command centre</Link>
            <Link href="/evidence" className="text-[14px] text-fg hover:text-mint">Evidence</Link>
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

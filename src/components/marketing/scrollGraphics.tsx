"use client";
// Scroll-driven product fragments for the "Four pieces. One answer." section. Every value is a sample; `p` is 0..1 progress through one step.
import { motion, useTransform, type MotionValue } from "motion/react";
import { Check, FileCheck2, Fingerprint, Send, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";

type P = { p: MotionValue<number> };

const S = { merchant: "Northwind Market", recipient: "ACC-MERCHANT-001", amount: "100.00", changed: "500.00", currency: "AED" };
const SUB = "text-[#6F6C64]";
const HAIR = "border-black/[0.07]";
const CARD = "rounded-[20px] bg-white shadow-[0_1px_2px_rgba(19,19,18,0.05),0_18px_40px_-22px_rgba(19,19,18,0.28)]";
const DOTS = {
  backgroundImage: "radial-gradient(rgba(19,19,18,0.16) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
  maskImage: "radial-gradient(ellipse at center, black 25%, transparent 78%)",
  WebkitMaskImage: "radial-gradient(ellipse at center, black 25%, transparent 78%)",
} as const;

/** Large soft panel that holds one fragment. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[28px] bg-[#F1EFEA] text-[#131312]", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={DOTS} />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

export function Cap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-[0.14em]", SUB, className)}>{children}</p>;
}

function Chip({ tone, children }: { tone: "lime" | "coral" | "plain"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold text-[#131312]",
        tone === "lime" && "bg-[#BCFF2F]",
        tone === "coral" && "bg-[#FF5466]",
        tone === "plain" && "bg-[#131312]/[0.06]",
      )}
    >
      {children}
    </span>
  );
}

function Rise({ p, at, span = 0.18, className, children }: P & { at: number; span?: number; className?: string; children: React.ReactNode }) {
  const opacity = useTransform(p, [at, at + span], [0, 1]);
  const y = useTransform(p, [at, at + span], [14, 0]);
  return (
    <motion.div style={{ opacity, y }} className={className}>
      {children}
    </motion.div>
  );
}

function Mark({ p, at, bad }: P & { at: number; bad?: boolean }) {
  const v = useTransform(p, [at, at + 0.1], [0, 1]);
  const scale = useTransform(v, [0, 1], [0.4, 1]);
  return (
    <motion.span style={{ opacity: v, scale }} className={cn("inline-flex size-5 items-center justify-center rounded-full", bad ? "bg-[#FF5466]" : "bg-[#BCFF2F]")}>
      {bad ? <X aria-label="differs" className="size-3" strokeWidth={3} /> : <Check aria-label="matches" className="size-3" strokeWidth={3} />}
    </motion.span>
  );
}

function Line({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t py-2.5 text-[13px]", HAIR)}>
      <span className={SUB}>{k}</span>
      <span className={cn("min-w-0 text-end font-medium", mono ? "ident text-[12px]" : "tabular")}>{v}</span>
    </div>
  );
}

function Tile({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-[14px]", dark ? "bg-[#131312] text-[#BCFF2F]" : "bg-white text-[#131312] shadow-[0_1px_2px_rgba(19,19,18,0.08)]")}>
      {children}
    </span>
  );
}

/** 01 Intended: the approved terms assemble while the hold-to-approve bar fills. */
export function TermsFragment({ p }: P) {
  const fill = useTransform(p, [0.04, 0.8], [0, 1]);
  const done = useTransform(p, [0.8, 0.9], [0, 1]);
  const hold = useTransform(done, [0, 1], [1, 0]);
  const pop = useTransform(done, [0, 1], [0.85, 1]);
  return (
    <div className={cn(CARD, "p-5 sm:p-6")}>
      <div className="flex h-6 items-center justify-between gap-3">
        <Cap>Approved terms</Cap>
        <motion.span style={{ opacity: done, scale: pop }}>
          <Chip tone="lime">
            <Check aria-hidden className="size-3" strokeWidth={3} /> Approved
          </Chip>
        </motion.span>
      </div>
      <p className={cn("mt-4 text-[13px]", SUB)}>{S.merchant}</p>
      <p className="tabular mt-1 text-[44px] font-semibold leading-none tracking-tight">
        {S.amount} <span className={cn("text-[16px] font-medium", SUB)}>{S.currency}</span>
      </p>
      <div className="mt-5">
        <Rise p={p} at={0.08}>
          <Line k="Recipient" v={S.recipient} mono />
        </Rise>
        <Rise p={p} at={0.28}>
          <Line k="Exact amount" v={`${S.amount} ${S.currency}`} />
        </Rise>
        <Rise p={p} at={0.48}>
          <Line k="Use" v="One use" />
        </Rise>
      </div>
      <div className="relative mt-4 h-11 overflow-hidden rounded-full bg-[#131312]/[0.06] text-[13px] font-semibold">
        <motion.span aria-hidden style={{ scaleX: fill }} className="absolute inset-0 origin-left bg-[#BCFF2F]" />
        <motion.span style={{ opacity: hold }} className="absolute inset-0 flex items-center justify-center gap-2">
          <Fingerprint aria-hidden className="size-4" /> Press and hold to approve
        </motion.span>
        <motion.span aria-hidden style={{ opacity: done }} className="absolute inset-0 flex items-center justify-center gap-2">
          <Check aria-hidden className="size-4" strokeWidth={2.5} /> Approved on the phone
        </motion.span>
      </div>
    </div>
  );
}

function AttemptChip({ amount }: { amount: string }) {
  return (
    <span className="relative inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full bg-white px-3.5 text-[12px] shadow-[0_1px_2px_rgba(19,19,18,0.06),0_10px_24px_-14px_rgba(19,19,18,0.3)]">
      <span aria-hidden className="absolute -left-[26px] top-1/2 size-[9px] -translate-y-1/2 rounded-full bg-[#131312] ring-4 ring-[#F1EFEA]" />
      <span className={SUB}>Attempted payment</span>
      <span className="tabular font-semibold">
        {amount} {S.currency}
      </span>
    </span>
  );
}

const WIRE = "M1 0V146Q1 162 17 162H34";

/** 02 Attempted: what the app submits travels down the wire to CounterSign. */
export function AttemptFragment({ p }: P) {
  const draw = useTransform(p, [0.04, 0.85], [0, 1]);
  const y1 = useTransform(p, [0.05, 0.6], [0, 88]);
  const o1 = useTransform(p, [0.02, 0.12], [0, 1]);
  const y2 = useTransform(p, [0.36, 0.85], [0, 44]);
  const o2 = useTransform(p, [0.33, 0.43], [0, 1]);
  const held = useTransform(p, [0.85, 0.95], [0, 1]);
  return (
    <div className="relative h-[262px]">
      <div className="flex items-center gap-3">
        <Tile>
          <Send aria-hidden className="size-[18px]" />
        </Tile>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold tracking-tight">The app submits a payment</p>
          <p className={cn("text-[12px]", SUB)}>{S.merchant} checkout</p>
        </div>
      </div>
      <svg aria-hidden className="absolute left-[21px] top-[50px]" width="36" height="164" viewBox="0 0 36 164" fill="none">
        <path d={WIRE} stroke="rgba(19,19,18,0.22)" strokeWidth="1.5" strokeDasharray="1 6" strokeLinecap="round" />
        <motion.path d={WIRE} stroke="#131312" strokeWidth="1.5" strokeLinecap="round" style={{ pathLength: draw }} />
      </svg>
      <motion.div style={{ y: y1, opacity: o1 }} className="absolute left-[44px] top-[58px]">
        <AttemptChip amount={S.amount} />
      </motion.div>
      <motion.div style={{ y: y2, opacity: o2 }} className="absolute left-[44px] top-[58px]">
        <AttemptChip amount={S.changed} />
      </motion.div>
      <div className="absolute bottom-0 left-[58px] right-0 flex items-center gap-3">
        <Tile dark>
          <ShieldCheck aria-hidden className="size-[18px]" />
        </Tile>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight">CounterSign</p>
          <p className={cn("text-[12px]", SUB)}>Placed next to the approved terms</p>
        </div>
        <motion.span style={{ opacity: held }} className="max-sm:hidden">
          <Chip tone="plain">Nothing moved yet</Chip>
        </motion.span>
      </div>
    </div>
  );
}

const FIELDS = [
  { k: "Recipient", v: S.recipient, mono: true, bad: false },
  { k: "Exact amount", v: `${S.amount} ${S.currency}`, mono: false, bad: true },
  { k: "Use", v: "One use", mono: false, bad: false },
];
const COLS = "grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-x-2 sm:grid-cols-[minmax(0,1fr)_84px_84px]";

/** 03 Enforced: each attempt is compared field by field and resolves to matched or stopped. */
export function CompareFragment({ p }: P) {
  return (
    <div className={cn(CARD, "p-5 sm:p-6")}>
      <div className={COLS}>
        <Cap>Approved terms</Cap>
        {[S.amount, S.changed].map((a) => (
          <div key={a} className="text-center">
            <Cap className="text-[10px]">Attempt</Cap>
            <p className="tabular text-[13px] font-semibold">{a}</p>
          </div>
        ))}
      </div>
      <div className="mt-3">
        {FIELDS.map((f, i) => (
          <div key={f.k} className={cn(COLS, "border-t py-3", HAIR)}>
            <div className="min-w-0">
              <p className={cn("text-[12px]", SUB)}>{f.k}</p>
              <p className={cn("mt-0.5 font-medium", f.mono ? "ident text-[12px]" : "tabular text-[13px]")}>{f.v}</p>
            </div>
            <span className="flex justify-center">
              <Mark p={p} at={0.06 + i * 0.2} />
            </span>
            <span className="flex justify-center">
              <Mark p={p} at={0.14 + i * 0.2} bad={f.bad} />
            </span>
          </div>
        ))}
        <div className={cn(COLS, "border-t pt-4", HAIR)}>
          <p className="text-[13px] font-semibold">Decision</p>
          <Rise p={p} at={0.68} span={0.1} className="flex justify-center">
            <Chip tone="lime">Matched</Chip>
          </Rise>
          <Rise p={p} at={0.76} span={0.1} className="flex justify-center">
            <Chip tone="coral">Stopped</Chip>
          </Rise>
        </div>
      </div>
      <Rise p={p} at={0.86} span={0.1} className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#FF5466]/[0.12] px-3 py-2.5 text-[12px]">
        <span className="ident font-semibold">AMOUNT_MISMATCH</span>
        <span className={SUB}>
          {S.changed} {S.currency} is not the amount that was approved.
        </span>
      </Rise>
    </div>
  );
}

const money = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 04 Outcome: balances tick for the matched payment, stay put for the stopped one, and evidence rows land. */
export function OutcomeFragment({ p }: P) {
  const payer = useTransform(p, [0.08, 0.45], [1000, 900]);
  const payerText = useTransform(payer, money);
  const got = useTransform(p, [0.08, 0.45], [0, 100]);
  const gotText = useTransform(got, (v) => `+${money(v)}`);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(CARD, "p-4")}>
          <Chip tone="lime">Matched</Chip>
          <Cap className="mt-4 text-[10px]">Payer balance</Cap>
          <p className="tabular mt-1 text-[22px] font-semibold leading-none tracking-tight sm:text-[26px]">
            <motion.span>{payerText}</motion.span>
          </p>
          <p className={cn("tabular mt-3 border-t pt-2.5 text-[12px]", HAIR, SUB)}>
            Recipient <motion.span className="font-semibold text-[#131312]">{gotText}</motion.span>
          </p>
        </div>
        <div className={cn(CARD, "p-4")}>
          <Chip tone="coral">Stopped</Chip>
          <Cap className="mt-4 text-[10px]">Payer balance</Cap>
          <p className="tabular mt-1 text-[22px] font-semibold leading-none tracking-tight sm:text-[26px]">1,000.00</p>
          <p className={cn("tabular mt-3 border-t pt-2.5 text-[12px]", HAIR, SUB)}>
            Recipient <span className="font-semibold text-[#131312]">+0.00</span>
          </p>
        </div>
      </div>
      <div className={cn(CARD, "px-4 pb-1.5 pt-4")}>
        <div className="flex items-center gap-2 pb-2.5">
          <FileCheck2 aria-hidden className="size-4" />
          <Cap>Evidence</Cap>
        </div>
        <Rise p={p} at={0.42} span={0.12} className={cn("flex items-center justify-between gap-3 border-t py-2.5 text-[12px]", HAIR)}>
          <span>Approval recorded</span>
          <span className={SUB}>recipient · amount · one use</span>
        </Rise>
        <Rise p={p} at={0.58} span={0.12} className={cn("flex items-center justify-between gap-3 border-t py-2.5 text-[12px]", HAIR)}>
          <span className="tabular">
            Attempt {S.amount} {S.currency}
          </span>
          <span className="font-semibold">Settled once</span>
        </Rise>
        <Rise p={p} at={0.74} span={0.12} className={cn("flex items-center justify-between gap-3 border-t py-2.5 text-[12px]", HAIR)}>
          <span className="tabular">
            Attempt {S.changed} {S.currency}
          </span>
          <span className="ident font-semibold text-[#D92D45]">AMOUNT_MISMATCH</span>
        </Rise>
      </div>
    </div>
  );
}

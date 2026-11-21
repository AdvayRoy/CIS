"use client";
// Illustrative product fragments for the entry page. Sample values only, no backend state.
import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CornerDownRight, GitBranch, Inbox, Scale, UserCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { BANK_ACCOUNTS } from "@/shared/contract";

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const m = window.matchMedia(QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
// false on the server and on the first client render, so markup never differs during hydration.
export function useReducedMotionFlag() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

const EASE = [0.165, 0.84, 0.44, 1] as const;
const chip = "rounded-[14px] bg-white px-3 py-2 text-[13px] text-[#131312] shadow-[0_1px_2px_rgb(19_19_18/0.06),0_10px_24px_-14px_rgb(19_19_18/0.28)] sm:px-4 sm:py-3 sm:text-[15px]";
const node = "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-[10px] sm:size-9";
const word = "text-[13px] text-[#131312] sm:text-[15px]";
const tiny = "font-mono text-[10px] uppercase tracking-[0.12em]";

export function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-10% 0px" }} transition={{ duration: 0.7, ease: EASE }}
      className={cn("relative m-0 flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-[28px] bg-[#F1EFEA] text-[#131312] sm:min-h-[548px]", className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgb(19_19_18/0.16)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      <figcaption className="relative flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-8 sm:pt-7">
        <span className={cn(tiny, "text-[#131312]")}>{title}</span>
        <span className={cn(tiny, "text-[#6B6962]")}>Illustration · sample values</span>
      </figcaption>
      <div dir="ltr" className="relative flex flex-1 items-center justify-center px-5 pb-8 pt-6 sm:px-8 sm:pb-10">{children}</div>
    </motion.figure>
  );
}

type Attempt = { amount: string; recipient: string; code: string; ok: boolean };
const ATTEMPTS: Attempt[] = [
  { amount: "100.00 AED", recipient: BANK_ACCOUNTS.merchant, code: "MATCHED", ok: true },
  { amount: "500.00 AED", recipient: BANK_ACCOUNTS.merchant, code: "AMOUNT_MISMATCH", ok: false },
  { amount: "100.00 AED", recipient: BANK_ACCOUNTS.attacker, code: "RECIPIENT_MISMATCH", ok: false },
  { amount: "100.00 AED", recipient: BANK_ACCOUNTS.merchant, code: "REPLAYED", ok: false },
];

function useCycle(n: number, ms: number, paused: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setI((v) => (v + 1) % n), ms);
    return () => window.clearInterval(t);
  }, [n, ms, paused]);
  return i;
}

const row = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } };

// Fragment 1: the approved terms read as a rule, with attempted payments decided against it.
export function TermsRule() {
  const reduced = useReducedMotionFlag();
  const i = useCycle(ATTEMPTS.length, 2600, reduced);
  const a = ATTEMPTS[i];
  return (
    <motion.ol
      initial="hidden" whileInView="show" viewport={{ once: true, margin: "-15% 0px" }} transition={{ staggerChildren: 0.12, delayChildren: 0.15 }}
      className="relative m-0 flex w-full max-w-[520px] list-none flex-col gap-5 p-0 sm:gap-7"
    >
      <span aria-hidden className="absolute bottom-5 start-4 top-5 w-px bg-[#131312]/15 sm:start-[18px]" />
      <motion.li variants={row} className="flex items-center gap-3">
        <span className={cn(node, "bg-[#131312] text-[#BCFF2F]")}><Inbox aria-hidden className="size-4" /></span>
        <span className="relative">
          <span className={cn(chip, "block")}>When a payment is approved</span>
          <motion.span aria-hidden className="pointer-events-none absolute -bottom-5 start-[calc(100%-18px)] flex items-start"
            animate={reduced ? undefined : { x: [0, 6, 0], y: [0, 4, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
            <svg viewBox="0 0 24 24" className="size-6 drop-shadow-[0_2px_3px_rgb(19_19_18/0.3)]"><path d="M4 2l15.5 9.2-7 1.6-3.4 6.6z" fill="#131312" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" /></svg>
            <span className="mt-4 rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-[#131312] shadow-[0_6px_16px_-8px_rgb(19_19_18/0.4)]">You</span>
          </motion.span>
        </span>
      </motion.li>
      <motion.li variants={row} className="flex items-center gap-3">
        <span className={cn(node, "bg-[#DCD9D1] text-[#131312]")}><GitBranch aria-hidden className="size-4" /></span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
          <span className={word}>If the</span>
          <span className={cn(chip, "text-[#6B6962]")}>Amount</span>
          <span className={word}>is exactly</span>
          <span className={cn(chip, "tabular font-medium")}>100.00 AED</span>
        </span>
      </motion.li>
      <motion.li variants={row} className="flex items-center gap-3 ps-6 sm:ps-10">
        <CornerDownRight aria-hidden className="absolute -ms-6 size-4 text-[#131312]/35 sm:-ms-7" />
        <span className={cn(node, "bg-[#DCD9D1] text-[#131312]")}><UserCheck aria-hidden className="size-4" /></span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
          <span className={word}>Require</span>
          <span className={cn(chip, "flex items-center gap-2 !py-1.5 !ps-1.5")}><span className="flex size-7 items-center justify-center rounded-[9px] bg-[#C9D6C0] text-[11px] font-semibold">RC</span>Same recipient</span>
          <span className={cn(chip, "flex items-center gap-2 !py-1.5 !ps-1.5")}><span className="flex size-7 items-center justify-center rounded-[9px] bg-[#DCE1F2] text-[11px] font-semibold">1×</span>One use</span>
        </span>
      </motion.li>
      <motion.li variants={row} className="flex items-center gap-3 ps-6 sm:ps-10">
        <span className={cn(node, "bg-[#DCD9D1] text-[#131312]")}><Scale aria-hidden className="size-4" /></span>
        <span className="flex min-h-[76px] min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 sm:min-h-[52px]">
          <span className={word}>Attempt</span>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE }}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <span className={cn(chip, "tabular")}>{a.amount}</span>
              <span className={cn(chip, "flex items-center gap-2 font-medium", a.ok ? "!bg-[#BCFF2F]" : "!bg-[#131312] !text-[#FAF9F5]")}>
                {a.ok ? <Check aria-hidden className="size-4" /> : <X aria-hidden className="size-4 text-[#FF5466]" />}
                <span className="font-mono text-[11px] tracking-[0.04em] sm:text-[12px]">{a.code}</span>
              </span>
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.li>
    </motion.ol>
  );
}

const R2 = (n: number) => Math.round(n * 100) / 100;
function inShield(x: number, y: number) {
  if (y < -0.56 || y > 0.64) return false;
  const w = y < 0.02 ? 0.46 : 0.46 * Math.sqrt(Math.max(0, 1 - ((y - 0.02) / 0.62) ** 2));
  return Math.abs(x) <= w;
}
function seg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
const inCheck = (x: number, y: number) => Math.min(seg(x, y, -0.22, -0.04, -0.07, 0.14), seg(x, y, -0.07, 0.14, 0.24, -0.26)) < 0.085;
const DOTS = (() => {
  const out: { cx: number; cy: number; r: number; solid: boolean }[] = [];
  const N = 46;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = ((i + (j % 2 ? 0.5 : 0)) / (N - 1)) * 2 - 1;
    const y = (j / (N - 1)) * 2 - 1;
    const d = Math.hypot(x, y);
    if (d > 0.985) continue;
    const solid = inShield(x, y);
    if (solid && inCheck(x, y)) continue;
    const depth = Math.sqrt(1 - d * d);
    out.push({ cx: R2(200 + x * 190), cy: R2(200 + y * 190), r: R2(solid ? 2.5 : 0.7 + depth * 1.1), solid });
  }
  return out;
})();

const TAGS = [
  { n: "01", pos: "start-[2%] top-[3%] sm:start-[4%] sm:top-[14%]", dot: "end-[-14px]", ...ATTEMPTS[0] },
  { n: "02", pos: "end-[2%] top-[40%] sm:end-[3%]", dot: "start-[-14px]", ...ATTEMPTS[1] },
  { n: "03", pos: "start-[3%] bottom-[2%] sm:start-[8%] sm:bottom-[10%]", dot: "end-[-14px]", ...ATTEMPTS[2] },
];

// Fragment 2: attempted payments around the approval, each with its decision.
export function AttemptField() {
  const reduced = useReducedMotionFlag();
  return (
    <div className="relative aspect-square w-full max-w-[520px]">
      <svg viewBox="0 0 400 400" aria-hidden className="absolute inset-[6%] size-[88%]">
        <defs>
          <radialGradient id="entry-sphere" cx="42%" cy="36%" r="70%">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="196" fill="url(#entry-sphere)" />
        {DOTS.map((d, k) => <circle key={k} cx={d.cx} cy={d.cy} r={d.r} fill="#131312" opacity={d.solid ? 1 : 0.34} />)}
        {!reduced && [0, 1, 2].map((k) => (
          <motion.circle key={k} cx="200" cy="200" r="120" fill="none" stroke="#131312" strokeWidth="1"
            initial={{ opacity: 0 }} animate={{ r: [120, 196], opacity: [0.28, 0] }} transition={{ duration: 3.6, delay: k * 1.2, repeat: Infinity, ease: "easeOut" }} />
        ))}
      </svg>
      {TAGS.map((t, k) => (
        <motion.div key={t.n}
          initial={{ opacity: 0, scale: 0.92, y: 10 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: true, margin: "-15% 0px" }} transition={{ duration: 0.55, delay: 0.35 + k * 0.18, ease: EASE }}
          className={cn("absolute", t.pos)}>
          <motion.div animate={reduced ? undefined : { y: [0, -5, 0] }} transition={{ duration: 5 + k, repeat: Infinity, ease: "easeInOut" }}
            className="relative flex items-center gap-2.5 rounded-[10px] bg-white py-1.5 pe-3 ps-1.5 shadow-[0_1px_2px_rgb(19_19_18/0.08),0_14px_28px_-16px_rgb(19_19_18/0.4)]">
            <span aria-hidden className={cn("absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-[#131312]", t.dot)} />
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-[7px]", t.ok ? "bg-[#BCFF2F] text-[#131312]" : "bg-[#131312] text-[#FF5466]")}>
              {t.ok ? <Check aria-hidden className="size-4" /> : <X aria-hidden className="size-4" />}
            </span>
            <span className="flex flex-col">
              <span className="font-mono text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-[#131312]">Attempt {t.n}</span>
              <span className="font-mono text-[9px] uppercase leading-tight tracking-[0.06em] text-[#6B6962]">{t.code}</span>
            </span>
            <span className="tabular ms-1 font-mono text-[10px] text-[#131312] sm:ms-3">{t.amount}</span>
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

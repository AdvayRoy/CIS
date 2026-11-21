"use client";
// Two large product fragments for the marketing page: the enforcement rule and the two payment rails. Illustrations with sample values.
import { useEffect, useState } from "react";
import { Ban, FileCheck2, GitBranch, Inbox, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { SAMPLE, usePrefersReducedMotion } from "./pieces";

export const INK = "#131312";
export const PANEL = "relative overflow-hidden rounded-[28px] bg-[#F0EEE7]";
const DOTS = { backgroundImage: "radial-gradient(rgba(19,19,18,0.11) 1px, transparent 1.2px)", backgroundSize: "22px 22px" } as const;
const CHIP = "inline-flex h-[var(--h)] shrink-0 items-center gap-2 rounded-[14px] bg-white px-3 text-[#131312] transition-shadow duration-500 sm:px-4";
const LIFT = "shadow-[0_14px_30px_-14px_rgba(19,19,18,0.45),0_0_0_1px_rgba(19,19,18,0.06)]";

export function SampleNote({ className }: { className?: string }) {
  return <p className={cn("text-[11px] font-medium uppercase tracking-[0.14em] text-[#66645E]", className)}>Illustration · sample values</p>;
}

function Glyph({ children, tone }: { children: React.ReactNode; tone?: "ink" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-[10px] sm:size-9",
        tone === "ink" ? "bg-[#131312] text-mint" : "bg-[#DCD9CF] text-[#55534D]",
      )}
    >
      {children}
    </span>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "coral" | "mint" }) {
  return (
    <span aria-hidden className={cn("grid size-7 shrink-0 place-items-center rounded-[8px] text-[11px] font-semibold text-black sm:size-8", tone === "coral" ? "bg-coral" : "bg-mint")}>
      {children}
    </span>
  );
}

// Cursor rest position per step: [left %, row index].
const CURSOR: ReadonlyArray<readonly [number, number]> = [
  [58, 0],
  [80, 1],
  [70, 2],
  [62, 3],
];

/** "When a payment is attempted -> if the amount differs -> stop with a reason code -> record evidence." */
export function RuleBuilder() {
  const reduce = usePrefersReducedMotion();
  const [step, setStep] = useState(3);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % CURSOR.length), 1900);
    return () => window.clearInterval(id);
  }, [reduce]);
  const at = reduce ? 3 : step;
  const [x, row] = CURSOR[at];
  const lift = (i: number) => (at === i ? LIFT : "shadow-[0_0_0_1px_rgba(19,19,18,0.04)]");
  const line = "absolute w-px bg-[#131312]/25";

  return (
    <div className="relative w-full max-w-[480px] whitespace-nowrap text-[13px] font-medium [--g:20px] [--h:44px] sm:text-[15px] sm:[--g:28px] sm:[--h:56px]">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <Glyph tone="ink"><Inbox className="size-4" /></Glyph>
        <span className={cn(CHIP, lift(0))}>When a payment is attempted</span>
      </div>

      <div className="relative mt-[var(--g)] flex items-center gap-2 sm:gap-2.5">
        <span aria-hidden className={cn(line, "left-4 sm:left-[18px]")} style={{ top: "calc(var(--g) * -1 - (var(--h) - 32px) / 2)", height: "calc(var(--g) + (var(--h) - 32px))" }} />
        <Glyph><GitBranch className="size-4" /></Glyph>
        <span>If<span className="hidden sm:inline"> the</span></span>
        <span className={cn(CHIP, "text-[#66645E]", lift(1))}>Amount</span>
        <span>is not<span className="hidden sm:inline"> equal to</span></span>
        <span className={cn(CHIP, "tabular", lift(1))}>
          {SAMPLE.amount} {SAMPLE.currency}
          <X aria-hidden className="size-3.5 text-[#66645E]" />
        </span>
      </div>

      <div className="relative mt-[var(--g)] flex items-center gap-2.5 ps-11 sm:gap-3 sm:ps-[52px]">
        <span
          aria-hidden
          className="absolute left-4 w-6 rounded-bl-[12px] border-b border-l border-[#131312]/25 sm:left-[18px] sm:w-7"
          style={{ top: "calc(var(--g) * -1 - (var(--h) - 32px) / 2)", height: "calc(var(--g) + var(--h) - 16px)" }}
        />
        <Glyph><Ban className="size-4" /></Glyph>
        <span>Stop</span>
        <span className={cn(CHIP, "ps-2 sm:ps-3", lift(2))}>
          <Badge tone="coral"><X className="size-4" /></Badge>
          <span className="ident text-[12px] sm:text-[14px]">AMOUNT_MISMATCH</span>
        </span>
      </div>

      <div className="relative mt-[var(--g)] flex items-center gap-2.5 ps-11 sm:gap-3 sm:ps-[52px]">
        <span aria-hidden className={cn(line, "left-[60px] sm:left-[70px]")} style={{ top: "calc(var(--g) * -1 - (var(--h) - 32px) / 2)", height: "calc(var(--g) + (var(--h) - 32px))" }} />
        <Glyph><FileCheck2 className="size-4" /></Glyph>
        <span>Record</span>
        <span className={cn(CHIP, "ps-2 sm:ps-3", lift(3))}>
          <Badge tone="mint">EV</Badge>
          Evidence
        </span>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute z-10 transition-[left,top] duration-700 ease-[cubic-bezier(0.165,0.84,0.44,1)] motion-reduce:transition-none"
        style={{ left: `${x}%`, top: `calc((var(--h) + var(--g)) * ${row} + var(--h) - 12px)` }}
      >
        <svg width="34" height="36" viewBox="0 0 34 36" className="drop-shadow-[0_4px_8px_rgba(19,19,18,0.25)]">
          <path d="M3 2 L3 30 L11 23 L17 35 L23 32 L17 21 L28 20 Z" fill={INK} stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <span className="absolute left-7 top-8 rounded-[10px] bg-white px-2.5 py-1 text-[12px] shadow-[0_8px_20px_-10px_rgba(19,19,18,0.4)] sm:text-[14px]">CounterSign</span>
      </div>
    </div>
  );
}

const R = 196;
const CX = 260;
const CY = 220;
const SPHERE: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: Array<readonly [number, number, number]> = [];
  for (let gy = -18; gy <= 18; gy++) {
    for (let gx = -18; gx <= 18; gx++) {
      const px = gx * 11 + (gy % 2 === 0 ? 0 : 5.5);
      const py = gy * 11;
      const d = Math.sqrt(px * px + py * py) / R;
      if (d >= 1) continue;
      const z = Math.sqrt(1 - d * d);
      // Push the grid outwards a little so it reads as a sphere, and shrink dots towards the rim.
      const k = 1 + 0.16 * (1 - z);
      out.push([Math.round((CX + px / k) * 10) / 10, Math.round((CY + py / k) * 10) / 10, Math.round((0.5 + 1.25 * z) * 100) / 100]);
    }
  }
  return out;
})();

const BANK = "M 60 112 C 150 112 180 220 260 220";
const CRYPTO = "M 60 328 C 150 328 180 220 260 220";
const OUT = "M 260 220 L 470 220";

function RailChip({ className, dot, name, sub, value }: { className?: string; dot: "ink" | "mint" | "coral"; name: string; sub: string; value: string }) {
  return (
    <div className={cn("absolute flex items-center gap-2 rounded-[8px] bg-white px-2 py-1.5 shadow-[0_10px_24px_-14px_rgba(19,19,18,0.5),0_0_0_1px_rgba(19,19,18,0.05)] sm:gap-3 sm:px-3 sm:py-2", className)}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot === "ink" && "bg-[#131312]", dot === "mint" && "bg-mint ring-1 ring-[#131312]/50", dot === "coral" && "bg-coral")} />
      <span className="min-w-0 font-mono uppercase leading-tight">
        <span className="block text-[9px] font-semibold tracking-[0.06em] text-[#131312] sm:text-[11px]">{name}</span>
        <span className="block text-[8px] tracking-[0.06em] text-[#66645E] sm:text-[9px]">{sub}</span>
      </span>
      <span className="tabular font-mono text-[9px] font-semibold text-[#131312] sm:text-[11px]">{value}</span>
    </div>
  );
}

/** Bank and crypto rails pass through the same check. A matching attempt reaches the recipient; a changed one stops. */
export function RailsGlobe() {
  return (
    <div className="relative aspect-[520/440] w-full max-w-[540px]">
      <svg viewBox="0 0 520 440" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id="cs-sphere" cx="42%" cy="36%" r="70%">
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.7" stopColor="#F6F4EE" />
            <stop offset="1" stopColor="#E4E1D8" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={R + 6} fill="url(#cs-sphere)" />
        {SPHERE.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#B9B5A9" />
        ))}
        {[BANK, CRYPTO, OUT].map((d) => (
          <path key={d} d={d} fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" strokeDasharray="0.1 8.4" />
        ))}
        <g className="motion-reduce:hidden">
          <circle r="6.5" fill="#BCFF2F" stroke={INK} strokeWidth="1.6">
            <animateMotion dur="3.6s" repeatCount="indefinite" path={`${BANK} L 470 220`} keyPoints="0;0.5;0.5;1" keyTimes="0;0.4;0.5;1" calcMode="linear" />
          </circle>
          <circle r="6.5" fill="#FF5466" stroke={INK} strokeWidth="1.6" opacity="0">
            <animateMotion dur="3.6s" begin="1.8s" repeatCount="indefinite" path={CRYPTO} keyPoints="0;0.93;0.93" keyTimes="0;0.45;1" calcMode="linear" />
            <animate attributeName="opacity" dur="3.6s" begin="1.8s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.6;0.75;1" />
          </circle>
        </g>
        <circle cx={CX} cy={CY} r="34" fill={INK} />
        <circle cx={CX} cy={CY} r="42" fill="none" stroke={INK} strokeOpacity="0.18" />
      </svg>
      <ShieldCheck aria-hidden className="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-mint sm:size-8" />
      <RailChip className="left-0 top-[25.5%] -translate-y-1/2" dot="mint" name="Bank rail" sub="Attempt · matched" value={`${SAMPLE.amount} ${SAMPLE.currency}`} />
      <RailChip className="left-0 top-[74.5%] -translate-y-1/2" dot="coral" name="Crypto rail" sub="Attempt · stopped" value={SAMPLE.changedAmount} />
      <RailChip className="right-0 top-1/2 -translate-y-1/2" dot="ink" name="Recipient" sub={SAMPLE.recipient} value={`+${SAMPLE.amount}`} />
      <RailChip className="left-[52%] top-[66%]" dot="coral" name="Stopped" sub="AMOUNT_MISMATCH" value="0.00" />
    </div>
  );
}

export function ProductPanel({ title, body, children, className }: { title: string; body: string; children: React.ReactNode; className?: string }) {
  return (
    <figure className={cn("min-w-0", className)}>
      <div className={cn(PANEL, "flex h-[400px] flex-col sm:h-[540px]")} style={DOTS}>
        <div className="flex min-h-0 flex-1 items-center justify-center px-5 pt-6 sm:px-10">{children}</div>
        <SampleNote className="px-5 pb-5 sm:px-8 sm:pb-6" />
      </div>
      <figcaption className="mt-5 px-1">
        <h3 className="text-[20px] font-semibold leading-tight tracking-tight text-[#131312]">{title}</h3>
        <p className="mt-1.5 max-w-[46ch] text-[15px] leading-relaxed text-[#66645E]">{body}</p>
      </figcaption>
    </figure>
  );
}

"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { type Tone, toneBg, toneBorder, toneText } from "./format";

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-white/5 px-2.5 py-1 text-xs font-medium whitespace-nowrap backdrop-blur-md",
      toneBorder[tone], toneText[tone], className)}>
      <span aria-hidden className={cn("live-dot size-1.5 rounded-full", toneBg[tone])} />
      {children}
    </span>
  );
}

export function Ident({ value, display, className }: { value: string; display?: string; className?: string }) {
  return <span title={value} className={cn("ident text-[12px]", className)}>{display ?? value}</span>;
}

export function Row({ label, children, changed }: { label: ReactNode; children: ReactNode; changed?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[112px_minmax(0,1fr)] gap-3 py-2 text-[13px]", changed && "-mx-2 rounded-lg bg-coral/10 px-2")}>
      <dt className={cn("text-muted", changed && "text-coral")}>{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </div>
  );
}

export function Panel({ id, title, aside, children, className }:
  { id?: string; title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn("rounded-[24px] border border-line bg-surface p-6", className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-medium tracking-wide text-muted uppercase">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Notice({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <p className={cn("rounded-xl border border-dashed px-4 py-3 text-[13px]", toneBorder[tone], toneText[tone])}>{children}</p>;
}

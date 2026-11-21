"use client";
// Shared product bar for the demo journey: Website -> Checkout -> Phone approval -> Execution -> Evidence.
// Navigation only. It never reports a payment state; pages pass `current` from server data.
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";

export type JourneyStep = "website" | "checkout" | "approval" | "execution" | "evidence";
export const JOURNEY: { id: JourneyStep; label: string; href: string }[] = [
  { id: "website", label: "Website", href: "/landing" },
  { id: "checkout", label: "Checkout", href: "/shop" },
  { id: "approval", label: "Phone approval", href: "/command" },
  { id: "execution", label: "Execution", href: "/command" },
  { id: "evidence", label: "Evidence", href: "/evidence" },
];

export function ProductBar({ current, context, children }: { current?: JourneyStep; context?: string; children?: React.ReactNode }) {
  const tc = useTranslations("common");
  const at = JOURNEY.findIndex((s) => s.id === current);
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="btn-primary flex size-8 items-center justify-center rounded-[10px]"><ShieldCheck aria-hidden className="size-[18px]" /></span>
          <span className="text-[15px] font-semibold tracking-tight">{tc("brand")}</span>
          {context && <span className="hidden text-[13px] text-muted sm:inline">/ {context}</span>}
        </Link>
        <nav aria-label="Demo journey" className="order-last w-full min-w-0 md:order-none md:ms-auto md:w-auto">
          <ol className="flex flex-wrap items-center gap-y-1 text-[12px]">
            {JOURNEY.map((s, i) => (
              <li key={s.id} className="flex items-center">
                {i > 0 && <ChevronRight aria-hidden className="mx-0.5 size-3 text-muted/60 rtl:rotate-180" />}
                <Link href={s.href} aria-current={i === at ? "step" : undefined}
                  className={cn("rounded-full px-2.5 py-1 transition-colors duration-200",
                    i === at ? "bg-fg font-medium text-bg" : i < at ? "text-fg hover:bg-surface-2" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                  {s.label}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
        {children && <div className="ms-auto flex items-center gap-2 md:ms-0">{children}</div>}
      </div>
    </header>
  );
}

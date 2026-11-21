"use client";
import { useTranslations } from "next-intl";
import type { AgreementView } from "@/shared/contract";
import { cn } from "@/lib/cn";
import { motion } from "motion/react";
import { EASE, LABEL, fmtAsset, short, stateTone, toneBg, toneText } from "./format";
import { Ident } from "./ui";

export function AgreementList({ agreements, selectedId, onSelect }:
  { agreements: AgreementView[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  return (
    <nav aria-label={t("list.title")} className="flex min-h-0 flex-col">
      <div className="flex items-baseline justify-between px-4 pt-5 pb-3">
        <h2 className={LABEL}>{t("list.title")}</h2>
        <span className="tabular rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{agreements.length}</span>
      </div>
      {agreements.length === 0 ? (
        <p className="px-4 text-[13px] leading-relaxed text-muted">{t("list.empty")}</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {agreements.map((v) => {
            const a = v.agreement; const active = a.id === selectedId; const tone = stateTone(v.state);
            return (
              <li key={a.id}>
                <button type="button" onClick={() => onSelect(a.id)} aria-current={active ? "true" : undefined}
                  className={cn("relative w-full rounded-xl px-3 py-2.5 text-start transition-colors duration-200", !active && "hover:bg-white/[0.03]")}>
                  {active && <motion.span layoutId="agreement-active" aria-hidden transition={{ duration: 0.3, ease: EASE }}
                    className="absolute inset-0 rounded-xl border border-line bg-white/[0.06]" />}
                  <span className="relative block">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{a.recipientDisplayName || short(a.recipient)}</span>
                    <span className="tabular shrink-0 text-[13px] font-medium">{fmtAsset(a.amount, a.asset)}</span>
                  </span>
                  <span className={cn("mt-1 flex min-w-0 items-center gap-1.5 text-xs", toneText[tone])}>
                    <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", toneBg[tone])} />
                    <span className="truncate">{tc(`state.${v.state}`)}</span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted/80">
                    <span className="truncate">{tc(`rail.${a.rail}`)}</span>
                    <Ident value={a.id} display={short(a.id, 4, 4)} className="shrink-0 text-[11px]" />
                  </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}

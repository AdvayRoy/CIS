"use client";
// OWNER: worker F (w/i18n). Globe button + searchable language panel (native names, no flags).
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Globe, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LOCALES, type LocaleCode } from "@/i18n/config";
import { useLocale } from "@/i18n/provider";
import { cn } from "@/lib/cn";

const fold = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f\u02bb\u2019']/g, "").toLowerCase();

export function LanguageSelector({ className }: { className?: string }) {
  const t = useTranslations("common.language");
  const { locale, setLocale, pending } = useLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return LOCALES.slice();
    return LOCALES.filter((l) => fold(l.name).includes(q) || fold(l.english).includes(q) || l.code.startsWith(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(Math.max(0, LOCALES.findIndex((l) => l.code === locale)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const choose = (code: LocaleCode) => { setLocale(code); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!results.length) return;
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "BUTTON") return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => (i + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => (i - 1 + results.length) % results.length); }
    else if (e.key === "Home") { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === "End") { e.preventDefault(); setActiveIndex(results.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); const pick = results[Math.min(activeIndex, results.length - 1)]; if (pick) choose(pick.code); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label={`${t("label")}: ${current.name}`}
          data-testid="language-selector"
          className={cn(
            "inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[12px] border border-line bg-surface px-3",
            "text-sm text-muted transition-colors duration-200 hover:border-muted/50 hover:text-fg",
            pending && "opacity-70",
            className,
          )}
        >
          <Globe aria-hidden className="size-[18px]" strokeWidth={1.75} />
          <span lang={current.code} dir={current.dir} className="hidden max-w-[9rem] truncate text-fg sm:inline">{current.name}</span>
          <span aria-hidden className="font-mono text-xs uppercase tracking-wide sm:hidden">{current.code}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content
          data-testid="language-panel"
          onKeyDown={onKeyDown}
          onOpenAutoFocus={(e) => {
            // Focus the search box where there is a hardware keyboard; on touch screens keep the on-screen keyboard closed.
            e.preventDefault();
            const fine = typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;
            (fine ? inputRef.current : contentRef.current)?.focus();
          }}
          ref={contentRef}
          tabIndex={-1}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-[20px] border border-line bg-surface text-fg shadow-2xl outline-none",
            "pb-[env(safe-area-inset-bottom)]",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(640px,80dvh)] sm:w-[420px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[20px] sm:pb-0",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-5 pt-5">
            <Dialog.Title className="text-base font-medium">{t("choose")}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label={t("close")} className="inline-flex size-11 items-center justify-center rounded-[12px] text-muted transition-colors hover:bg-surface-2 hover:text-fg">
                <X aria-hidden className="size-5" strokeWidth={1.75} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="px-5 pt-1 text-xs leading-relaxed text-muted">{t("fallbackNote")}</Dialog.Description>
          <div className="relative px-5 pt-4">
            <Search aria-hidden className="pointer-events-none absolute start-9 top-1/2 mt-2 size-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
            <input
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={results.length ? `${listId}-${results[Math.min(activeIndex, results.length - 1)].code}` : undefined}
              aria-label={t("search")}
              placeholder={t("search")}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
              ref={inputRef}
              className="h-12 w-full rounded-[12px] border border-line bg-bg ps-11 pe-4 text-base text-fg placeholder:text-muted/70 focus:border-mint/60 focus:outline-none"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={t("label")} className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
            {results.map((l, i) => {
              const selected = l.code === locale;
              return (
                <li
                  key={l.code}
                  id={`${listId}-${l.code}`}
                  role="option"
                  aria-selected={selected}
                  data-index={i}
                  data-locale={l.code}
                  onClick={() => choose(l.code)}
                  onMouseMove={() => setActiveIndex(i)}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 transition-colors duration-150",
                    i === activeIndex && "bg-line/50",
                  )}
                >
                  <span className="min-w-0 flex-1 text-start">
                    <span className={cn("block truncate text-[15px] leading-6", selected ? "text-mint" : "text-fg")}><bdi lang={l.code}>{l.name}</bdi></span>
                    <span className="block truncate text-xs leading-4 text-muted"><bdi lang="en">{l.english}</bdi></span>
                  </span>
                  <span aria-hidden className="font-mono text-[11px] uppercase tracking-wide text-muted/80">{l.code}</span>
                  <Check aria-hidden className={cn("size-4 shrink-0 text-mint", !selected && "invisible")} strokeWidth={2} />
                </li>
              );
            })}
            {!results.length && <li role="presentation" className="px-3 py-6 text-center text-sm text-muted">{t("noResults")}</li>}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

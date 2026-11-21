"use client";
// OWNER: worker F (w/i18n). Client-side locale switching: no reload, no URL change, payment state untouched.
import { NextIntlClientProvider } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, NAMESPACES, isLocale, localeMeta, type LocaleCode } from "./config";
import { mergeOverEnglish, type MessageTree } from "./merge";
import { scriptFontClassName } from "./fonts";
import common from "../../messages/en/common.json";
import desktop from "../../messages/en/desktop.json";
import mobile from "../../messages/en/mobile.json";
import lab from "../../messages/en/lab.json";

const EN: Record<string, MessageTree> = { common, desktop, mobile, lab };
const cache = new Map<LocaleCode, Record<string, MessageTree>>([["en", EN]]);

/** Loads one locale lazily. Any namespace or key that is missing stays English. */
async function loadMessages(locale: LocaleCode): Promise<Record<string, MessageTree>> {
  const hit = cache.get(locale);
  if (hit) return hit;
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      try {
        const mod = await import(`../../messages/${locale}/${ns}.json`);
        return [ns, mergeOverEnglish(EN[ns], mod.default ?? mod)] as const;
      } catch {
        return [ns, EN[ns]] as const;
      }
    }),
  );
  const merged = Object.fromEntries(entries);
  cache.set(locale, merged);
  return merged;
}

type LocaleContext = {
  locale: LocaleCode;
  dir: "ltr" | "rtl";
  /** BCP 47 tag for Intl formatting. */
  intlLocale: string;
  /** Locale currently being loaded, if any. */
  pending: LocaleCode | null;
  setLocale: (l: LocaleCode) => void;
};
const Ctx = createContext<LocaleContext>({
  locale: DEFAULT_LOCALE, dir: "ltr", intlLocale: localeMeta(DEFAULT_LOCALE).intl, pending: null, setLocale: () => {},
});
export const useLocale = () => useContext(Ctx);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<{ locale: LocaleCode; messages: Record<string, MessageTree> }>({ locale: DEFAULT_LOCALE, messages: EN });
  const [pending, setPending] = useState<LocaleCode | null>(null);
  const request = useRef(0);

  const apply = useCallback((l: LocaleCode) => {
    const id = ++request.current;
    setPending(l);
    loadMessages(l)
      .then((messages) => { if (request.current === id) setActive({ locale: l, messages }); })
      .catch(() => {})
      .finally(() => { if (request.current === id) setPending(null); });
  }, []);

  const setLocale = useCallback((l: LocaleCode) => {
    try { localStorage.setItem(LOCALE_STORAGE_KEY, l); } catch {}
    apply(l);
  }, [apply]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored) && stored !== DEFAULT_LOCALE) apply(stored);
    } catch {}
    const onStorage = (e: StorageEvent) => { if (e.key === LOCALE_STORAGE_KEY && isLocale(e.newValue)) apply(e.newValue); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [apply]);

  const meta = localeMeta(active.locale);
  useEffect(() => {
    const root = document.documentElement;
    root.lang = meta.code;
    root.dir = meta.dir;
    for (const c of scriptFontClassName.split(" ")) if (c) root.classList.add(c);
  }, [meta]);

  const value = useMemo<LocaleContext>(
    () => ({ locale: meta.code, dir: meta.dir, intlLocale: meta.intl, pending, setLocale }),
    [meta, pending, setLocale],
  );
  return (
    <Ctx.Provider value={value}>
      <NextIntlClientProvider locale={active.locale} messages={active.messages} timeZone="Asia/Dubai"
        onError={() => {}} getMessageFallback={({ namespace, key }) => (namespace ? `${namespace}.${key}` : key)}>
        {children}
      </NextIntlClientProvider>
    </Ctx.Provider>
  );
}

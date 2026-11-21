"use client";
// OWNER: worker F (w/i18n) after base commit. Client-side locale switching (no reload, no URL change).
import { NextIntlClientProvider } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, type LocaleCode } from "./config";
import common from "../../messages/en/common.json";
import desktop from "../../messages/en/desktop.json";
import mobile from "../../messages/en/mobile.json";
import lab from "../../messages/en/lab.json";

const EN = { common, desktop, mobile, lab };
const Ctx = createContext<{ locale: LocaleCode; setLocale: (l: LocaleCode) => void }>({ locale: DEFAULT_LOCALE, setLocale: () => {} });
export const useLocale = () => useContext(Ctx);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [messages] = useState<typeof EN>(EN);
  const setLocale = useCallback((l: LocaleCode) => {
    setLocaleState(l);
    try { localStorage.setItem("cs.locale", l); } catch {}
  }, []);
  useEffect(() => {
    try { const s = localStorage.getItem("cs.locale") as LocaleCode | null;
      if (s && LOCALES.some((x) => x.code === s)) setLocaleState(s); } catch {}
  }, []);
  useEffect(() => {
    const meta = LOCALES.find((x) => x.code === locale)!;
    document.documentElement.lang = locale; document.documentElement.dir = meta.dir;
  }, [locale]);
  return (
    <Ctx.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Dubai"
        onError={() => {}} getMessageFallback={({ namespace, key }) => `${namespace}.${key}`}>
        {children}
      </NextIntlClientProvider>
    </Ctx.Provider>
  );
}

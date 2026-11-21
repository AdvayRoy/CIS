// OWNER: worker F (w/i18n).
export const LOCALES = [
  { code: "en", name: "English", english: "English", dir: "ltr", intl: "en" },
  { code: "ar", name: "العربية", english: "Arabic", dir: "rtl", intl: "ar-AE" },
  { code: "ru", name: "Русский", english: "Russian", dir: "ltr", intl: "ru" },
  { code: "uk", name: "Українська", english: "Ukrainian", dir: "ltr", intl: "uk" },
  { code: "kk", name: "Қазақша", english: "Kazakh", dir: "ltr", intl: "kk" },
  { code: "uz", name: "Oʻzbekcha", english: "Uzbek", dir: "ltr", intl: "uz" },
  { code: "az", name: "Azərbaycan dili", english: "Azerbaijani", dir: "ltr", intl: "az" },
  { code: "hy", name: "Հայերեն", english: "Armenian", dir: "ltr", intl: "hy" },
  { code: "ka", name: "ქართული", english: "Georgian", dir: "ltr", intl: "ka" },
  { code: "ky", name: "Кыргызча", english: "Kyrgyz", dir: "ltr", intl: "ky" },
  { code: "tg", name: "Тоҷикӣ", english: "Tajik", dir: "ltr", intl: "tg" },
  { code: "tk", name: "Türkmençe", english: "Turkmen", dir: "ltr", intl: "tk" },
  { code: "be", name: "Беларуская", english: "Belarusian", dir: "ltr", intl: "be" },
  { code: "ro", name: "Română", english: "Romanian", dir: "ltr", intl: "ro" },
] as const;
export type LocaleCode = (typeof LOCALES)[number]["code"];
export type LocaleMeta = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: LocaleCode = "en";
export const NAMESPACES = ["common", "desktop", "mobile", "lab"] as const;
export type Namespace = (typeof NAMESPACES)[number];
export const LOCALE_STORAGE_KEY = "cs.locale";

export function isLocale(v: unknown): v is LocaleCode {
  return typeof v === "string" && LOCALES.some((l) => l.code === v);
}
export function localeMeta(code: LocaleCode): LocaleMeta {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

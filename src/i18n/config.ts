// OWNER: worker F (w/i18n) after base commit.
export const LOCALES = [
  { code: "en", name: "English", dir: "ltr" },
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "ru", name: "Русский", dir: "ltr" },
  { code: "uk", name: "Українська", dir: "ltr" },
  { code: "kk", name: "Қазақша", dir: "ltr" },
  { code: "uz", name: "Oʻzbekcha", dir: "ltr" },
  { code: "az", name: "Azərbaycan dili", dir: "ltr" },
  { code: "hy", name: "Հայերեն", dir: "ltr" },
  { code: "ka", name: "ქართული", dir: "ltr" },
  { code: "ky", name: "Кыргызча", dir: "ltr" },
  { code: "tg", name: "Тоҷикӣ", dir: "ltr" },
  { code: "tk", name: "Türkmençe", dir: "ltr" },
  { code: "be", name: "Беларуская", dir: "ltr" },
  { code: "ro", name: "Română", dir: "ltr" },
] as const;
export type LocaleCode = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: LocaleCode = "en";
export const NAMESPACES = ["common", "desktop", "mobile", "lab"] as const;

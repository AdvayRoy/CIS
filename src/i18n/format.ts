// OWNER: worker F (w/i18n). Locale-aware display helpers. Values are never converted to floating point.
import { createElement, type ReactElement, type ReactNode } from "react";
import { DEFAULT_LOCALE, isLocale, localeMeta, type LocaleCode } from "./config";

/** BCP 47 tag used for Intl. Digits are pinned to Western 0-9 so amounts read the same in every locale. */
export function intlTag(locale: LocaleCode | string): string {
  const base = isLocale(locale) ? localeMeta(locale).intl : locale || localeMeta(DEFAULT_LOCALE).intl;
  return base.includes("-u-") ? base : `${base}-u-nu-latn`;
}

function safe<T>(make: (tag: string) => T, locale: LocaleCode | string): T {
  try { return make(intlTag(locale)); } catch { return make(intlTag(DEFAULT_LOCALE)); }
}

export type AmountOptions = {
  /** Fraction digits always shown. Default: min(decimals, 2). */
  minFractionDigits?: number;
  /** Fraction digits kept at most; extra digits are cut only when they are zero. Default: decimals. */
  maxFractionDigits?: number;
};

/** Splits integer base units into whole and fraction digit strings. Pure string arithmetic. */
export function splitUnits(amount: string, decimals: number): { negative: boolean; whole: string; fraction: string } {
  const negative = amount.startsWith("-");
  const digits = (negative ? amount.slice(1) : amount).replace(/^0+(?=\d)/, "");
  if (!/^\d+$/.test(digits)) throw new Error("amount must be an integer base-unit string");
  const padded = digits.padStart(decimals + 1, "0");
  return {
    negative,
    whole: padded.slice(0, padded.length - decimals),
    fraction: decimals ? padded.slice(padded.length - decimals) : "",
  };
}

/**
 * Formats integer base units for display, e.g. ("100000", 2, "ru") -> "1 000,00".
 * The whole part is grouped by Intl from a BigInt; the fraction digits are copied verbatim.
 * No digit of the underlying value is rounded: non-zero fraction digits are never dropped.
 */
export function formatUnits(amount: string, decimals: number, locale: LocaleCode | string, opts: AmountOptions = {}): string {
  const { negative, whole, fraction } = splitUnits(amount, decimals);
  const min = Math.min(decimals, opts.minFractionDigits ?? Math.min(decimals, 2));
  const max = Math.max(min, Math.min(decimals, opts.maxFractionDigits ?? decimals));
  let frac = fraction.replace(/0+$/, "");
  if (frac.length <= max) frac = frac.padEnd(min, "0");
  const nf = safe((tag) => new Intl.NumberFormat(tag, { useGrouping: true, maximumFractionDigits: 0 }), locale);
  const wholeText = nf.format(BigInt(whole));
  const decimalSep = safe((tag) => new Intl.NumberFormat(tag, { minimumFractionDigits: 1 }), locale)
    .formatToParts(1.5).find((p) => p.type === "decimal")?.value ?? ".";
  const sign = negative && (whole !== "0" || /[1-9]/.test(frac)) ? "\u2212" : "";
  return sign + wholeText + (frac ? decimalSep + frac : "");
}

/** Number followed by the unchanged asset code, joined by a no-break space: "1 000,00 AED". */
export function formatAmount(amount: string, asset: { code: string; decimals: number }, locale: LocaleCode | string, opts?: AmountOptions): string {
  return `${formatUnits(amount, asset.decimals, locale, opts)}\u00A0${asset.code}`;
}

/** Plain integers such as execution counts. */
export function formatCount(n: number | bigint, locale: LocaleCode | string): string {
  return safe((tag) => new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }), locale).format(n);
}

/** Accepts unix seconds (contract `expiry`, `createdAt`) or unix milliseconds (event `at`). */
export function toDate(unix: number): Date {
  return new Date(unix < 1e11 ? unix * 1000 : unix);
}

export type DateStyle = "datetime" | "date" | "time" | "precise";
const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  datetime: { dateStyle: "medium", timeStyle: "short" },
  date: { dateStyle: "medium" },
  time: { timeStyle: "medium" },
  precise: { dateStyle: "medium", timeStyle: "medium" },
};

export function formatDateTime(unix: number, locale: LocaleCode | string, style: DateStyle = "datetime", timeZone = "Asia/Dubai"): string {
  return safe((tag) => new Intl.DateTimeFormat(tag, { ...DATE_OPTIONS[style], timeZone }), locale).format(toDate(unix));
}

/** "in 2 minutes" / "3 minutes ago", relative to `now` (unix seconds or ms). */
export function formatRelative(unix: number, now: number, locale: LocaleCode | string): string {
  const seconds = Math.round((toDate(unix).getTime() - toDate(now).getTime()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = safe((tag) => new Intl.RelativeTimeFormat(tag, { numeric: "always" }), locale);
  if (abs < 60) return rtf.format(seconds, "second");
  if (abs < 3600) return rtf.format(Math.trunc(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.trunc(seconds / 3600), "hour");
  return rtf.format(Math.trunc(seconds / 86400), "day");
}

/**
 * Identifier (address, hash, account id, nonce): rendered verbatim inside <bdi dir="ltr">,
 * so it is never translated, reordered or mirrored in right-to-left layouts.
 */
export function Ident({ children, className }: { children: ReactNode; className?: string }): ReactElement {
  return createElement("bdi", { dir: "ltr", translate: "no", className: className ? `ident ${className}` : "ident" }, children);
}

/** Amount with its asset code, isolated left-to-right so "1,000.00 AED" keeps its order in Arabic. */
export function AmountText({ amount, asset, locale, options, className }: {
  amount: string; asset: { code: string; decimals: number }; locale: LocaleCode | string; options?: AmountOptions; className?: string;
}): ReactElement {
  return createElement("bdi", { dir: "ltr", translate: "no", className: className ? `tabular ${className}` : "tabular" }, formatAmount(amount, asset, locale, options));
}

/** Short ends of a long identifier for tight layouts; the full value belongs in a title or expanded view. */
export function shortIdent(value: string, head = 6, tail = 4): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}\u2026${value.slice(-tail)}`;
}

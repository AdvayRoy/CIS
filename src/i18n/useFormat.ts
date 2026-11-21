"use client";
// OWNER: worker F (w/i18n). Formatting helpers bound to the active locale.
import { useMemo } from "react";
import { useLocale } from "./provider";
import { formatAmount, formatCount, formatDateTime, formatRelative, formatUnits, type AmountOptions, type DateStyle } from "./format";

export function useFormat() {
  const { locale } = useLocale();
  return useMemo(() => ({
    locale,
    units: (amount: string, decimals: number, opts?: AmountOptions) => formatUnits(amount, decimals, locale, opts),
    amount: (amount: string, asset: { code: string; decimals: number }, opts?: AmountOptions) => formatAmount(amount, asset, locale, opts),
    count: (n: number | bigint) => formatCount(n, locale),
    dateTime: (unix: number, style?: DateStyle) => formatDateTime(unix, locale, style),
    relative: (unix: number, now: number) => formatRelative(unix, now, locale),
  }), [locale]);
}

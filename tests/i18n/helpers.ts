import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, NAMESPACES } from "../../src/i18n/config";
import { flattenKeys } from "../../src/i18n/merge";

export const ROOT = join(__dirname, "..", "..");
export const TARGET_LOCALES = LOCALES.map((l) => l.code).filter((c) => c !== "en");
export { NAMESPACES };

export function load(locale: string, ns: string): Record<string, string> | null {
  const file = join(ROOT, "messages", locale, `${ns}.json`);
  if (!existsSync(file)) return null;
  return flattenKeys(JSON.parse(readFileSync(file, "utf8")));
}

/** ICU argument names used in a message, sorted: "{count, plural, ...} {name}" -> ["count", "name"]. */
export function icuArgs(message: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (ch === "'" && message[i + 1] === "{") { const end = message.indexOf("'", i + 2); i = end === -1 ? message.length : end; continue; }
    if (ch === "{") {
      depth++;
      if (depth === 1) { const m = /^\s*([A-Za-z0-9_]+)\s*[,}]/.exec(message.slice(i + 1)); if (m) names.add(m[1]); }
    } else if (ch === "}") depth = Math.max(0, depth - 1);
  }
  return [...names].sort();
}

/** Rich-text tags such as <b>…</b>, sorted. */
export function tags(message: string): string[] {
  return [...new Set([...message.matchAll(/<\/?([A-Za-z][A-Za-z0-9]*)\s*\/?>/g)].map((m) => m[1]))].sort();
}

/** Identifier-like tokens that must survive translation verbatim. */
export function protectedTokens(message: string): string[] {
  return [...new Set(message.match(/\b(?:CounterSign|AED|CSUSD|EIP-712|ACC-[A-Z]+-\d+|0x[0-9a-fA-F]{4,})\b/g) ?? [])].sort();
}

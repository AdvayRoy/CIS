import { describe, expect, it } from "vitest";
import { NAMESPACES, TARGET_LOCALES, load } from "./helpers";

/** Length ratio (translation / English) above which a string is flagged as an overflow candidate. */
const RATIO_WARN = 1.8;
const MIN_ENGLISH_LENGTH = 6;
/** Short labels sit in fixed-width UI (buttons, chips, field labels); flag long absolute lengths too. */
const SHORT_LABEL = 14;
const SHORT_LABEL_MAX = 30;

describe("coverage report", () => {
  it("reports per-locale coverage, English fallbacks and overflow candidates", () => {
    const lines: string[] = [];
    const overflow: string[] = [];
    for (const locale of TARGET_LOCALES) {
      const parts: string[] = [];
      for (const ns of NAMESPACES) {
        const english = load("en", ns)!;
        const translated = load(locale, ns);
        const total = Object.keys(english).length;
        if (!translated) { parts.push(`${ns} 0/${total} (English fallback)`); continue; }
        const missing = Object.keys(english).filter((k) => !(k in translated) || translated[k].trim() === "");
        const identical = Object.keys(english).filter((k) => translated[k] === english[k] && /[A-Za-z]{4,}/.test(english[k]) && !/^[A-Z0-9 _.-]+$|^CounterSign$/.test(english[k]));
        parts.push(`${ns} ${total - missing.length}/${total}` + (missing.length ? ` missing: ${missing.join(", ")}` : "") + (identical.length ? ` same-as-English: ${identical.join(", ")}` : ""));
        for (const key of Object.keys(english)) {
          if (!(key in translated)) continue;
          const e = [...english[key]].length, t = [...translated[key]].length;
          const ratio = t / e;
          if ((e >= MIN_ENGLISH_LENGTH && ratio > RATIO_WARN) || (e <= SHORT_LABEL && t > SHORT_LABEL_MAX))
            overflow.push(`${locale}/${ns}.${key}: ${e} -> ${t} chars (x${ratio.toFixed(2)})`);
        }
      }
      lines.push(`${locale}: ${parts.join(" | ")}`);
    }
    console.info(["i18n coverage", ...lines].join("\n  "));
    if (overflow.length) console.warn([`i18n overflow candidates (${overflow.length}); check at 375 px`, ...overflow].join("\n  "));
    expect(lines).toHaveLength(TARGET_LOCALES.length);
  });

  it("payment-critical namespace `common` is translated for Russian and Arabic", () => {
    for (const locale of ["ru", "ar"]) {
      const english = load("en", "common")!;
      const translated = load(locale, "common");
      expect(translated, `${locale}/common.json`).not.toBeNull();
      expect(Object.keys(english).filter((k) => !(k in translated!))).toEqual([]);
    }
  });
});

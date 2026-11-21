import { describe, expect, it } from "vitest";
import { NAMESPACES, TARGET_LOCALES, icuArgs, load, protectedTokens, tags } from "./helpers";

/**
 * Translated namespaces must match the English key set exactly.
 * A namespace file that does not exist yet is an explicit English fallback: it is reported
 * by coverage.test.ts and in STATUS.md, and is not a failure here.
 */
describe.each(NAMESPACES)("namespace %s", (ns) => {
  const english = load("en", ns)!;

  it("English source has no empty values", () => {
    expect(Object.entries(english).filter(([, v]) => typeof v !== "string" || v.trim() === "").map(([k]) => k)).toEqual([]);
  });

  describe.each(TARGET_LOCALES)("locale %s", (locale) => {
    const translated = load(locale, ns);
    const run = translated ? it : it.skip;

    run("has exactly the English key set", () => {
      const missing = Object.keys(english).filter((k) => !(k in translated!));
      const extra = Object.keys(translated!).filter((k) => !(k in english));
      expect({ missing, extra }, `${locale}/${ns}: missing keys fall back to English`).toEqual({ missing: [], extra: [] });
    });

    run("has no empty or non-string values", () => {
      expect(Object.entries(translated!).filter(([, v]) => typeof v !== "string" || v.trim() === "").map(([k]) => k)).toEqual([]);
    });

    run("preserves ICU placeholders and rich-text tags", () => {
      const broken = Object.keys(english).filter((k) => k in translated!).filter((k) =>
        icuArgs(english[k]).join() !== icuArgs(translated![k]).join() || tags(english[k]).join() !== tags(translated![k]).join());
      expect(broken).toEqual([]);
    });

    run("keeps brand, asset codes and identifiers verbatim", () => {
      const broken = Object.keys(english).filter((k) => k in translated!).filter((k) =>
        protectedTokens(english[k]).some((token) => !translated![k].includes(token)));
      expect(broken).toEqual([]);
    });
  });
});

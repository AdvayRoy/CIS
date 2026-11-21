import { describe, expect, it } from "vitest";
import { formatAmount, formatDateTime, formatUnits, splitUnits } from "../../src/i18n/format";
import { mergeOverEnglish } from "../../src/i18n/merge";
import { LOCALES } from "../../src/i18n/config";

const digitsOf = (s: string) => s.replace(/[^0-9]/g, "");

describe("formatUnits", () => {
  it("formats the fixed scenario amounts", () => {
    expect(formatUnits("100000", 2, "en")).toBe("1,000.00");
    expect(formatUnits("10000", 2, "en")).toBe("100.00");
    expect(formatUnits("90000", 2, "en")).toBe("900.00");
    expect(formatUnits("0", 2, "en")).toBe("0.00");
    expect(formatUnits("5", 2, "en")).toBe("0.05");
    expect(formatUnits("1000000000000000000000", 18, "en")).toBe("1,000.00");
    expect(formatUnits("100000000000000000000", 18, "en")).toBe("100.00");
  });

  it("never rounds or drops non-zero digits, beyond float precision", () => {
    expect(formatUnits("123456789012345678901234567890123456789", 18, "en")).toBe("123,456,789,012,345,678,901.234567890123456789");
    expect(formatUnits("1000000000000000000001", 18, "en")).toBe("1,000.000000000000000001");
    expect(formatUnits("9007199254740993", 0, "en")).toBe("9,007,199,254,740,993");
    expect(formatUnits("1", 18, "en", { maxFractionDigits: 2 })).toBe("0.000000000000000001");
  });

  it("keeps every digit in every locale and uses Western digits", () => {
    for (const { code } of LOCALES) {
      const out = formatUnits("123456789", 2, code);
      expect(digitsOf(out), code).toBe("123456789");
      expect(/[\u0660-\u0669\u06f0-\u06f9]/.test(out), code).toBe(false);
      expect(formatAmount("10000", { code: "AED", decimals: 2 }, code).endsWith("\u00A0AED"), code).toBe(true);
    }
  });

  it("uses locale separators", () => {
    expect(formatUnits("100000", 2, "ru").replace(/\s/g, " ")).toBe("1 000,00");
    expect(formatUnits("100000", 2, "ar")).toBe("1,000.00");
  });

  it("rejects non-integer input", () => {
    expect(() => splitUnits("1.5", 2)).toThrow();
    expect(() => splitUnits("1e3", 2)).toThrow();
  });
});

describe("formatDateTime", () => {
  it("accepts unix seconds and milliseconds and formats in every locale", () => {
    const seconds = 1795249200;
    expect(formatDateTime(seconds, "en")).toBe(formatDateTime(seconds * 1000, "en"));
    for (const { code } of LOCALES) expect(formatDateTime(seconds, code).length, code).toBeGreaterThan(5);
    expect(formatDateTime(seconds, "ar")).toMatch(/2026/);
  });
});

describe("mergeOverEnglish", () => {
  it("falls back to English per key and ignores unknown or empty keys", () => {
    const en = { a: "A", n: { b: "B", c: "C" } };
    expect(mergeOverEnglish(en, { a: "X", n: { b: "" }, zzz: "nope" })).toEqual({ a: "X", n: { b: "B", c: "C" } });
    expect(mergeOverEnglish(en, null)).toEqual(en);
  });
});

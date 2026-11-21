# Localization status

All non-English text is **model-written and has not been reviewed by a native speaker** of any language.
No human-quality review was possible for any locale. Payment-critical wording (states, rejection reasons,
approve/decline, receipts) should be reviewed by a native speaker before any real use.

Financial authorization never depends on these strings: the server returns structured codes
(`STATES`, `REASONS`) and the frontend only translates them for display.

| Locale | Language | common | mobile (approval flow) | desktop | lab | Status | Native review |
|---|---|---|---|---|---|---|---|
| en | English | source | source | source | source | Source | n/a |
| ar | العربية (RTL) | 55/55 | 95/95 | 112/112 | English | Complete | No |
| ru | Русский | 55/55 | 95/95 | 112/112 | English | Complete | No |
| uk | Українська | 55/55 | 95/95 | 112/112 | English | Complete | No |
| be | Беларуская | 55/55 | 95/95 | 112/112 | English | Complete | No |
| ro | Română | 55/55 | 95/95 | 112/112 | English | Complete | No |
| kk | Қазақша | 55/55 | 95/95 | 112/112 | English | Complete, lower confidence | No |
| uz | Oʻzbekcha | 55/55 | 95/95 | 112/112 | English | Complete, lower confidence | No |
| az | Azərbaycan dili | 55/55 | 95/95 | 112/112 | English | Complete, lower confidence | No |
| hy | Հայերեն | 55/55 | 95/95 | 112/112 | English | Complete, lower confidence | No |
| ka | ქართული | 55/55 | 95/95 | 112/112 | English | Complete, lower confidence | No |
| ky | Кыргызча | 55/55 | 95/95 | 112/112 | English | Complete, lowest confidence | No |
| tg | Тоҷикӣ | 55/55 | 95/95 | 112/112 | English | Complete, lowest confidence | No |
| tk | Türkmençe | 55/55 | 95/95 | 112/112 | English | Complete, lowest confidence | No |

Notes

- "Complete" means every English key has a translated value; it is not a quality claim. Confidence is the
  author's own estimate: highest for ru, ar, uk, be, ro; lowest for ky, tg, tk, where fintech terminology
  is least settled.
- `lab` holds one operator-only key and is intentionally left as English fallback. `/lab` operator controls
  are not customer-facing.
- Any key added to `messages/en/*.json` after these files were written falls back to English per key
  (`src/i18n/merge.ts`); `tests/i18n/dictionaries.test.ts` then fails and lists the missing keys per locale.
- Digits are Western (0-9) in every locale, including Arabic, so amounts read identically everywhere.
  Asset codes, account IDs, addresses and hashes are never translated and are rendered left-to-right.
- `tests/i18n/coverage.test.ts` prints length-ratio overflow candidates (a warning, not a failure).

Browser checks actually run (headless Chrome, fixture data via `?fixture=1`, not a live payment)

- `/approve/demo?fixture=1` at 375x812 in states `awaiting_approval`, `rejected`, `settled`, all 14 locales:
  no horizontal scroll, no off-screen text, no clipped buttons, no console errors.
- `/command?fixture=1` at 1280x800, all 14 locales: same checks pass.
- Arabic sets `<html dir="rtl">`; layout mirrors; identifiers stay left-to-right.
- Not run: a live end-to-end payment in ru/ar against the real server, and any physical-iPhone test.

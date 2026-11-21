// OWNER: worker F (w/i18n). Script fonts referenced by --font-sans in globals.css.
// Geist covers Latin and basic Cyrillic; these cover Arabic, Armenian and Georgian.
import { Noto_Sans_Arabic, Noto_Sans_Armenian, Noto_Sans_Georgian } from "next/font/google";

const notoArabic = Noto_Sans_Arabic({ variable: "--font-noto-arabic", subsets: ["arabic"], display: "swap", preload: false });
const notoArmenian = Noto_Sans_Armenian({ variable: "--font-noto-armenian", subsets: ["armenian"], display: "swap", preload: false });
const notoGeorgian = Noto_Sans_Georgian({ variable: "--font-noto-georgian", subsets: ["georgian"], display: "swap", preload: false });

/** Class names that define the three CSS variables; the provider puts them on <html>. */
export const scriptFontClassName = [notoArabic.variable, notoArmenian.variable, notoGeorgian.variable].join(" ");

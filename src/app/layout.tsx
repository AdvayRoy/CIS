import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GlassPointer } from "@/components/fx/GlassPointer";
import { I18nProvider } from "@/i18n/provider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "cyrillic"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CounterSign — One payment. Exactly as agreed.",
  description: "CounterSign enforces the payment you approved: exact recipient, exact amount, once.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col text-fg">
        <GlassPointer /><p data-testid="demo-indicator" className="flex h-6 shrink-0 items-center justify-center gap-1.5 border-b border-line bg-black text-[11px] text-muted">
          <span aria-hidden className="size-1.5 rounded-full bg-amber" />Demo environment — no real funds
        </p>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

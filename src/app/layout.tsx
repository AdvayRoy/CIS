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
export const viewport: Viewport = { themeColor: "#05070D", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col text-fg">
        <GlassPointer /><I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

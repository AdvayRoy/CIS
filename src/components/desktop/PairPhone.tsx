"use client";
import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Smartphone } from "lucide-react";
import { api, ApiFailure } from "@/lib/api";
import { toMs } from "./format";

type Pairing = { url: string; expiresAt: number };

/** Mount with key={agreementId}; only rendered while the agreement is awaiting approval. */
export function PairPhone({ agreementId, canPair, serverTime }: { agreementId: string; canPair: boolean; serverTime: number }) {
  const t = useTranslations("desktop");
  const tc = useTranslations("common");
  const fmt = useFormatter();
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const expired = pairing ? toMs(serverTime) > toMs(pairing.expiresAt) : false;

  async function pair() {
    setBusy(true); setError(null); setCopied(false);
    try {
      const p = await api.pairing(agreementId);
      setPairing({ url: window.location.origin + p.approvePath, expiresAt: p.expiresAt });
    } catch (e) {
      setPairing(null);
      setError(e instanceof ApiFailure ? e.code : "BAD_REQUEST");
    } finally { setBusy(false); }
  }
  async function copy() {
    if (!pairing) return;
    try { await navigator.clipboard.writeText(pairing.url); setCopied(true); } catch { setCopied(false); }
  }
  const errorText = error && (tc.has(`reason.${error}`) ? tc(`reason.${error}`) : t("pair.error"));

  return (
    <div className="rounded-[16px] border border-amber/30 bg-surface p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t("pair.title")}</p>
          <p className="mt-0.5 text-[13px] text-muted">{canPair ? t("pair.hint") : t("pair.needSignIn")}</p>
        </div>
        <button type="button" onClick={pair} disabled={!canPair || busy}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-fg px-4 text-sm font-medium text-bg transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
          <Smartphone aria-hidden className="size-4" />
          {pairing ? t("pair.again") : t("pair.action")}
        </button>
      </div>
      {errorText && <p role="alert" className="mt-3 text-[13px] text-coral">{errorText}</p>}
      <AnimatePresence initial={false}>
        {pairing && (
          <motion.div key="qr" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }} className="overflow-hidden">
            <div className="mt-4 flex items-center gap-5 border-t border-line pt-4">
              <div className={`shrink-0 rounded-xl bg-white p-2.5 ${expired ? "opacity-30" : ""}`}>
                <QRCodeSVG value={pairing.url} size={128} marginSize={0} title={t("pair.qrAlt")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] ${expired ? "text-coral" : "text-muted"}`}>
                  {expired ? t("pair.expired") : t("pair.expires", { time: fmt.dateTime(new Date(toMs(pairing.expiresAt)), { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) })}
                </p>
                <p className="ident mt-2 max-h-16 overflow-hidden rounded-lg border border-line bg-bg px-3 py-2 text-[11px] text-muted">{pairing.url}</p>
                <button type="button" onClick={copy}
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-[13px] hover:bg-surface-2">
                  {copied ? <Check aria-hidden className="size-4 text-mint" /> : <Copy aria-hidden className="size-4" />}
                  {copied ? t("pair.copied") : t("pair.copy")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

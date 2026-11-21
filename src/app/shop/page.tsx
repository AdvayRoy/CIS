"use client";
// Merchant checkout fixture (English, demo). Holds only the merchant capability: it can propose a payment
// and submit the execution attempt. It cannot approve; the customer does that on a paired phone.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2, ShieldCheck, ShoppingBag, Smartphone, X } from "lucide-react";
import { api, type ApiFailure } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { BANK_ACCOUNTS, formatUnitsStr, type AgreementView, type Overview } from "@/shared/contract";

const TOKEN_100 = "100000000000000000000";
type Rail = "bank" | "crypto";

export default function ShopPage() {
  const { data: ov } = usePoll<Overview>(() => api.state(), 1500);
  const [rail, setRail] = useState<Rail>("bank");
  const [id, setId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: view, connected } = usePoll<AgreementView>(() => api.agreement(id!), 1000, !!id);
  const submitted = useRef<string | null>(null);
  const shop = ov?.chain.protected?.shop;
  const chainUp = !!ov?.chain.available && !!shop;

  // An honest merchant submits exactly what was approved, once, as soon as the approval exists.
  useEffect(() => {
    if (!view || view.state !== "approved" || submitted.current === view.agreement.id) return;
    submitted.current = view.agreement.id;
    const a = view.agreement;
    api.execute(a.id, { recipient: a.recipient, amount: a.amount, operation: a.operation, continuingAllowance: "0" })
      .catch((e: ApiFailure) => setError(`${e.code}: ${e.message}`));
  }, [view]);

  const pay = async () => {
    setBusy(true); setError(null);
    try {
      await api.signIn("merchant", "demo-merchant");
      const v = await api.createAgreement(rail === "bank"
        ? { rail: "bank", recipient: BANK_ACCOUNTS.merchant, recipientDisplayName: "Demo Merchant LLC", amount: "10000", ttlSeconds: 600 }
        : { rail: "crypto", recipient: shop!, recipientDisplayName: "Demo Shop", amount: TOKEN_100, itemId: "1", ttlSeconds: 600 });
      setId(v.agreement.id);
    } catch (e) { const f = e as ApiFailure; setError(`${f.code ?? "ERR"}: ${f.message}`); }
    finally { setBusy(false); }
  };

  const state = view?.state;
  const receipt = view?.evidence.find((e) => e.receipt)?.receipt;
  const step = !id ? 0 : state === "awaiting_approval" ? 1 : state === "approved" || state === "executing" ? 2 : state === "settled" ? 3 : -1;
  const steps = ["Order placed", "Customer approves on their phone", "Shop submits the approved payment", "Paid"];
  const price = rail === "bank" ? "100.00 AED" : "100 CSUSD";

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-10 md:grid-cols-[1.1fr_0.9fr]">
      <section className="tilt rounded-[20px] border border-line bg-surface p-8">
        <p className="flex items-center gap-2 text-xs tracking-widest text-muted uppercase"><ShoppingBag aria-hidden className="size-4" />Demo Shop · merchant checkout fixture</p>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">Annual membership</h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">One payment of {price}. You approve the exact recipient and amount on your phone; the shop cannot change either afterwards or charge twice.</p>
        <p className="ticker mt-8 text-6xl font-semibold"><span className="hero-amount">{rail === "bank" ? "100.00" : "100"}</span><span className="ms-2 text-xl font-normal text-muted">{rail === "bank" ? "AED" : "CSUSD"}</span></p>
        <div className="seg mt-8" role="group" aria-label="Payment method">
          <button type="button" aria-pressed={rail === "bank"} disabled={!!id} onClick={() => setRail("bank")}>Bank transfer</button>
          <button type="button" aria-pressed={rail === "crypto"} disabled={!!id || !chainUp} onClick={() => setRail("crypto")}>CSUSD token</button>
        </div>
        {!chainUp && <p className="mt-2 text-xs text-amber">Local chain is not available; token payment is disabled.</p>}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {!id ? (
            <button type="button" onClick={pay} disabled={busy} className="btn-primary inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm disabled:opacity-50">
              {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ShieldCheck aria-hidden className="size-4" />}Pay with CounterSign
            </button>
          ) : (
            <button type="button" onClick={() => { setId(null); setError(null); }} className="inline-flex h-12 items-center rounded-full border border-line bg-white/5 px-6 text-sm">New order</button>
          )}
          <span className="text-xs text-muted">Bank simulation · Local-chain demo</span>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-coral">{error}</p>}
      </section>

      <section className="rounded-[20px] border border-line bg-surface p-8" aria-live="polite">
        <h2 className="text-xs tracking-widest text-muted uppercase">Order status</h2>
        {!id && <p className="mt-6 text-sm leading-relaxed text-muted">Nothing ordered yet. Choose a payment method and press Pay with CounterSign.</p>}
        {id && (
          <>
            <ol className="mt-6 space-y-5">
              {steps.map((label, i) => {
                const done = step > i || step === 3; const active = step === i && step !== 3;
                return (
                  <li key={label} className="flex items-start gap-3">
                    <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] ${done ? "border-mint bg-mint text-black" : active ? "border-fg text-fg" : "border-line text-muted"}`}>
                      {done ? <Check aria-hidden className="size-3.5" /> : active ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : i + 1}
                    </span>
                    <span className={`text-sm ${done || active ? "text-fg" : "text-muted"}`}>{label}</span>
                  </li>
                );
              })}
            </ol>
            {connected === false && <p role="alert" className="mt-5 text-sm text-amber">Connection lost. The status above may be out of date.</p>}
            {step === 1 && (
              <div className="mt-6 rounded-[14px] border border-line bg-white/5 p-4">
                <p className="flex items-center gap-2 text-sm font-medium"><Smartphone aria-hidden className="size-4" />Waiting for the customer</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">Open your CounterSign account, pair your phone and approve this payment there. This shop page cannot approve it.</p>
                <Link href="/command" className="btn-primary mt-3 inline-flex h-10 items-center rounded-full px-5 text-sm">Open CounterSign account</Link>
              </div>
            )}
            {step === -1 && view && (
              <p role="alert" className="mt-6 flex items-center gap-2 text-sm text-coral"><X aria-hidden className="size-4" />Not paid. State: {view.state}.</p>
            )}
            {step === 3 && view && (
              <div className="glow-mint mt-6 rounded-[14px] border border-mint/40 p-4">
                <p className="text-sm font-medium text-mint">Order confirmed</p>
                <p className="mt-1 text-xs text-muted">Paid {formatUnitsStr(view.agreement.amount, view.agreement.asset.decimals)} {view.agreement.asset.code}, executed {view.executionCount} time.</p>
                {receipt && <p className="ident mt-2 text-[11px] text-muted">{receipt.kind === "ledger" ? receipt.transferId : receipt.txHash}</p>}
              </div>
            )}
            <p className="ident mt-6 text-[11px] text-muted">{id}</p>
          </>
        )}
      </section>
    </main>
  );
}

"use client";
// OWNER: worker B. Customer approval screen; every state shown comes from the server's AgreementView.
import { Logo } from "@/components/Logo";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Ban, CheckCircle2, CircleAlert, Clock, Hourglass, Loader2, ShieldCheck, Smartphone, WifiOff, XCircle } from "lucide-react";
import { formatUnitsStr, type AgreementState, type AgreementView } from "@/shared/contract";
import { api } from "@/lib/api";
import { usePoll } from "@/lib/usePoll";
import { cn } from "@/lib/cn";
import { fixtureView, parseFixtureOptions, type FixtureOptions } from "./fixture";
import { usePairingToken, useServerNow } from "./hooks";
import { PaymentCard } from "./PaymentCard";
import { PaymentPath } from "./PaymentPath";
import { StoppedPanel } from "./StoppedPanel";
import { Receipt } from "./Receipt";
import { HoldButton } from "@/components/fx/HoldButton";
import { LanguageSelector } from "@/components/i18n/LanguageSelector";

type Tone = "mint" | "amber" | "coral" | "muted";
const STATE_UI: Record<AgreementState, { tone: Tone; Icon: typeof Clock; spin?: boolean }> = {
  awaiting_approval: { tone: "amber", Icon: Clock },
  approved: { tone: "amber", Icon: Hourglass },
  executing: { tone: "amber", Icon: Loader2, spin: true },
  rejected: { tone: "coral", Icon: Ban },
  settled: { tone: "mint", Icon: CheckCircle2 },
  declined: { tone: "muted", Icon: XCircle },
  expired: { tone: "muted", Icon: Clock },
  failed: { tone: "coral", Icon: CircleAlert },
};
const TONE_HEAD: Record<Tone, string> = { mint: "text-mint", amber: "text-amber", coral: "text-coral", muted: "text-fg" };
// Solid fills only for the two final outcomes; waiting and neutral states stay quiet.
const TONE_TILE: Record<Tone, string> = { mint: "bg-mint text-bg", amber: "bg-amber/10 text-amber", coral: "bg-coral text-bg", muted: "bg-white/5 text-muted" };
const TONE_BORDER: Record<Tone, string> = { mint: "border-mint/40", amber: "border-amber/30", coral: "border-coral/40", muted: "border-line" };
const EASE = [0.165, 0.84, 0.44, 1] as const;

export function ApproveScreen({ id }: { id: string }) {
  const t = useTranslations("mobile");
  const c = useTranslations("common");
  const reduce = useReducedMotion();
  const dur = reduce ? 0 : 0.28;
  const move = { duration: dur, ease: EASE };
  const rise = { initial: reduce ? false : { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: reduce ? 0 : 0.36, ease: EASE } } as const;

  // ?fixture=1 is read after mount so the default (server) path never depends on it.
  const [fx, setFx] = useState<FixtureOptions | null | undefined>(undefined);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value, read once after hydration
  useEffect(() => { setFx(parseFixtureOptions(window.location.search)); }, []);
  const [fxState, setFxState] = useState<AgreementState | null>(null);
  const live = fx === null;

  const { ready: tokenReady, token } = usePairingToken(id);
  const poll = usePoll<AgreementView>(useCallback(() => api.agreement(id), [id]), 1000, live);
  const now = useServerNow(live);

  const fxView = useMemo(
    () => (fx ? fixtureView(fxState ?? fx.state, fx.rail, fx.at) : null),
    [fx, fxState],
  );
  const view = fx ? fxView : poll.data;
  // An HTTP error response still proves the server was reached.
  const connected = fx ? !fx.offline : poll.connected ?? (poll.error && poll.error.status > 0 ? true : null);
  const offline = connected === false;
  const state = view?.state;

  const pair = usePoll(
    useCallback(() => api.checkPairing(id, token ?? ""), [id, token]),
    5000,
    live && !!token && state === "awaiting_approval",
  );
  const pairing: "checking" | "paired" | "unpaired" = fx
    ? (fx.paired ? "paired" : "unpaired")
    : !tokenReady ? "checking"
    : !token ? "unpaired"
    : pair.error && pair.error.status > 0 ? "unpaired"
    : pair.data ? (pair.data.valid ? "paired" : "unpaired")
    : "checking";

  const [busyRaw, setBusy] = useState<"approve" | "decline" | null>(null);
  // An action stays "busy" only while the server still reports awaiting_approval.
  const busy = state === "awaiting_approval" ? busyRaw : null;
  const [actionError, setActionError] = useState<string | null>(null);

  const act = async (kind: "approve" | "decline") => {
    if (busy || !view || offline) return;
    setActionError(null);
    if (fx) { setFxState(kind === "approve" ? "approved" : "declined"); return; }
    if (!token) return;
    setBusy(kind);
    try {
      await (kind === "approve" ? api.approve(id, token) : api.decline(id, token));
      // Stay busy until the next poll confirms the new state; no optimistic state change.
    } catch (e) {
      setBusy(null);
      setActionError((e as { code?: string }).code ?? "BAD_REQUEST");
    }
  };

  const expiryMs = view ? view.agreement.expiry * 1000 : 0;
  const remainingMs = view && now !== null ? expiryMs - now : null;
  const locallyExpired = remainingMs !== null && remainingMs <= 0;
  const ui = state ? STATE_UI[state] : null;
  const notFound = live && !view && poll.error?.status === 404;
  const loadError = live && !view && !!poll.error && poll.error.status > 0 && poll.error.status !== 404;
  const showActions = state === "awaiting_approval" && pairing === "paired";
  const envLabel = view ? c(`env.${view.agreement.rail === "bank" ? "bank" : "chain"}`) : null;
  const reasonText = (code: string) => (c.has(`reason.${code}`) ? c(`reason.${code}`) : code);

  return (
    <main
      className="mx-auto flex min-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingInlineStart: "max(env(safe-area-inset-left), 16px)",
        paddingInlineEnd: "max(env(safe-area-inset-right), 16px)",
      }}
    >
      <header className="flex min-h-11 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Logo className="size-5 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{c("brand")}</p>
            <p className="truncate text-xs leading-tight text-muted">{t("header.approval")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* LANGUAGE-SELECTOR SLOT: the lead mounts <LanguageSelector /> from
              src/components/i18n/LanguageSelector.tsx (worker F) inside this element. */}
          <div data-slot="language-selector" className="flex min-h-11 items-center"><LanguageSelector /></div>
          <ConnectionPill connected={connected} />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 pb-4 pt-3">
        {fx && (
          <p className="rounded-full border border-amber/30 px-3.5 py-1.5 text-xs text-amber" data-testid="fixture-banner">
            {t("fixture")}
          </p>
        )}

        <AnimatePresence initial={false}>
          {offline && (
            <motion.div
              key="offline"
              role="alert"
              data-testid="disconnected"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              transition={move}
              className="overflow-hidden"
            >
              <div className="flex gap-3 rounded-2xl border border-amber/40 bg-surface p-3">
                <WifiOff aria-hidden className="mt-0.5 size-5 shrink-0 text-amber" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-amber">{t("disconnected.title")}</p>
                  <p className="text-muted">{view ? t("disconnected.body") : t("disconnected.never")}</p>
                  {showActions && <p className="mt-1 text-muted">{t("disconnected.actions")}</p>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!view && !offline && (notFound || loadError) && (
          <section role="alert" className="rounded-2xl border border-line bg-surface p-5" data-testid={notFound ? "not-found" : "load-error"}>
            <CircleAlert aria-hidden className="size-6 text-coral" />
            <h1 className="font-sans mt-3 text-lg font-semibold">{t(notFound ? "notFound.title" : "loadError.title")}</h1>
            <p className="mt-1 text-sm text-muted">{t(notFound ? "notFound.body" : "loadError.body")}</p>
            <p className="ident mt-3 text-xs text-muted">{id}</p>
          </section>
        )}
        {!view && !offline && !notFound && !loadError && (
          <section aria-busy="true" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-sm text-muted" data-testid="loading">
            <Loader2 aria-hidden className="size-5 animate-spin" />
            {t("loading")}
          </section>
        )}

        {view && state && ui && (
          <>
            <section
              aria-live="polite"
              data-testid="state-banner"
              data-state={state}
              className={cn("rounded-2xl border bg-surface p-4 transition-colors duration-300", TONE_BORDER[ui.tone], ui.tone === "coral" && "cs-stop")}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={state}
                  initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -8 }}
                  transition={move}
                  className="flex items-start gap-3.5"
                >
                  <motion.span
                    className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", TONE_TILE[ui.tone])}
                    initial={{ scale: reduce ? 1 : 0.6 }} animate={{ scale: 1 }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 24 }}
                  >
                    <ui.Icon aria-hidden className={cn("size-5", ui.spin && "animate-spin")} strokeWidth={2.25} />
                  </motion.span>
                  <div className="min-w-0 flex-1">
                    <h1 className={cn("break-words text-2xl leading-[1.15]", TONE_HEAD[ui.tone])}>{c(`state.${state}`)}</h1>
                    <p className="mt-1 text-sm leading-snug text-muted">{t(`status.${state}`)}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
              <PaymentPath view={view} />
            </section>

            <AnimatePresence initial={false}>
              {(state === "rejected" || state === "failed") && view.evidence.length > 0 && (
                <motion.div key="stopped" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={move} className="overflow-hidden">
                  <StoppedPanel evidence={view.evidence[view.evidence.length - 1]} reasonText={reasonText} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {state !== "awaiting_approval" && (
                <motion.div key="receipt" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  transition={move} className="overflow-hidden">
                  <Receipt view={view} reasonText={reasonText} />
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div {...rise}>
              <PaymentCard view={view} remainingMs={remainingMs} envLabel={envLabel} />
            </motion.div>

            {state === "awaiting_approval" && pairing === "unpaired" && (
              <section role="status" data-testid="not-paired" className="flex gap-3 rounded-2xl border border-amber/40 bg-surface p-4">
                <Smartphone aria-hidden className="mt-0.5 size-5 shrink-0 text-amber" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-amber">{t("pairing.unpairedTitle")}</p>
                  <p className="mt-0.5 text-muted">{t("pairing.unpairedBody")}</p>
                </div>
              </section>
            )}
            {state === "awaiting_approval" && pairing === "checking" && (
              <p role="status" className="flex items-center gap-2 px-1 text-sm text-muted">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                {t("pairing.checking")}
              </p>
            )}
          </>
        )}
      </div>

      {view && showActions && (
        <div
          className="[@media(min-height:700px)]:sticky bottom-0 -mx-4 rounded-t-3xl border-t border-line bg-bg px-4 pt-4"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          {actionError && (
            <p role="alert" className="mb-2 text-sm text-coral" data-testid="action-error">
              {t("action.failed")}: {reasonText(actionError)}
            </p>
          )}
          {locallyExpired && <p role="status" className="mb-2 text-sm text-muted">{t("action.expiredLocal")}</p>}
          {/* The exact terms being signed stay in view next to the control that signs them. */}
          <div className="mb-3 flex items-baseline justify-between gap-4 px-1">
            <p className="tabular shrink-0 text-base font-semibold">
              <bdi>{t("card.amountValue", { amount: formatUnitsStr(view.agreement.amount, view.agreement.asset.decimals), asset: view.agreement.asset.code })}</bdi>
            </p>
            <p className="ident min-w-0 text-end text-[11px] leading-snug text-muted">{view.agreement.recipient}</p>
          </div>
          <HoldButton
            data-testid="approve"
            onConfirm={() => act("approve")}
            disabled={!!busy || offline || locallyExpired}
            hint={busy === "approve" ? undefined : t("action.holdHint")}
            className="min-h-16 rounded-full px-4 text-base"
          >
            {busy === "approve" && <Loader2 aria-hidden className="size-5 animate-spin" />}
            {busy === "approve" ? t("action.approving") : t("action.approve")}
          </HoldButton>
          <button
            type="button"
            data-testid="decline"
            onClick={() => act("decline")}
            disabled={!!busy || offline}
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-white/5 px-4 text-[15px] font-medium text-fg transition-opacity duration-200 disabled:opacity-40"
          >
            {busy === "decline" && <Loader2 aria-hidden className="size-5 animate-spin" />}
            {busy === "decline" ? t("action.declining") : t("action.decline")}
          </button>
        </div>
      )}
      {!(view && showActions) && <div style={{ height: "env(safe-area-inset-bottom)" }} />}
    </main>
  );
}

function ConnectionPill({ connected }: { connected: boolean | null }) {
  const c = useTranslations("common");
  const key = connected === null ? "connecting" : connected ? "connected" : "disconnected";
  return (
    <span
      role="status"
      data-testid="connection"
      data-connection={key}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs",
        connected === false ? "text-amber" : "text-muted",
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", connected === null ? "bg-muted" : connected ? "bg-mint" : "bg-amber")} />
      {c(`connection.${key}`)}
    </span>
  );
}

"use client";
// OWNER: worker B.
import { useEffect, useState } from "react";

/** Timestamps in the contract are seconds (expiry) or milliseconds (events). Normalise to ms. */
export const toMs = (n: number) => (n < 1e11 ? n * 1000 : n);

/**
 * Pairing token from the URL fragment (#t=TOKEN). Kept in memory and sessionStorage only,
 * then removed from the address bar so it is not shared or stored in history.
 */
export function usePairingToken(id: string) {
  const [state, setState] = useState<{ ready: boolean; token: string | null }>({ ready: false, token: null });
  useEffect(() => {
    const key = `cs.pair.${id}`;
    const m = /(?:^#|&)t=([^&]+)/.exec(window.location.hash);
    let token: string | null = m ? decodeURIComponent(m[1]) : null;
    try {
      if (token) sessionStorage.setItem(key, token);
      else token = sessionStorage.getItem(key);
    } catch {}
    if (m) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value, read once after hydration
    setState({ ready: true, token });
  }, [id]);
  return state;
}

/** Server-adjusted clock in ms. Offset comes from GET /api/health (never cached). */
export function useServerNow(enabled: boolean) {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const sync = async () => {
      try {
        const sent = Date.now();
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = (await res.json()) as { serverTime?: number };
        const got = Date.now();
        if (!stop && typeof body.serverTime === "number") setOffset(toMs(body.serverTime) - (sent + got) / 2);
      } catch {}
    };
    sync();
    const t = setInterval(sync, 30000);
    return () => { stop = true; clearInterval(t); };
  }, [enabled]);
  useEffect(() => {
    const tick = () => setNow(Date.now() + offset);
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 500);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [offset]);
  return now;
}

"use client";
// Lead-owned. ~1s polling of authoritative state; exposes connection truth.
import { useEffect, useRef, useState } from "react";
export function usePoll<T>(fetcher: () => Promise<T>, intervalMs = 1000, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null); // null = first load pending
  const [error, setError] = useState<{ code: string; status: number } | null>(null);
  const f = useRef(fetcher);
  useEffect(() => { f.current = fetcher; });
  useEffect(() => {
    if (!enabled) return;
    let stop = false; let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try { const d = await f.current(); if (!stop) { setData(d); setConnected(true); setError(null); } }
      catch (e) { const x = e as { code?: string; status?: number };
        if (!stop) { if (!x.status) setConnected(false); if (x.status === 404) setData(null); setError({ code: x.code ?? "ERR", status: x.status ?? 0 }); } }
      if (!stop) timer = setTimeout(tick, intervalMs);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [intervalMs, enabled]);
  return { data, connected, error };
}

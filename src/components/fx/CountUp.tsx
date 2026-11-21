"use client";
import { useEffect, useRef, useState } from "react";

// Animates between two integer base-unit amounts. The final frame is always the exact server value.
export function CountUp({ value, format, className }: { value: string; format: (v: string) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = BigInt(from.current), b = BigInt(value);
    if (a === b || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { from.current = value; setShown(value); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 700);
      const e = BigInt(Math.round((1 - Math.pow(1 - p, 3)) * 1000));
      setShown(p >= 1 ? value : (a + ((b - a) * e) / BigInt(1000)).toString());
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]);
  return <span className={className} data-value={value}>{format(shown)}</span>;
}

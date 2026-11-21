"use client";
import { useEffect } from "react";

// Pointer-reactive glass: moves a specular highlight across whichever pane is under the pointer,
// and tilts panes marked .tilt. Purely presentational.
export function GlassPointer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last: HTMLElement | null = null;
    let raf = 0;
    const clear = (el: HTMLElement) => {
      el.style.setProperty("--glow", "0");
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    };
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = (e.target as Element | null)?.closest?.<HTMLElement>(".bg-surface, .bg-surface-2, .glass") ?? null;
        if (last && last !== el) clear(last);
        last = el;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
        el.style.setProperty("--glow", "1");
        if (el.classList.contains("tilt") && e.pointerType === "mouse") {
          el.style.setProperty("--rx", `${((0.5 - y) * 5).toFixed(2)}deg`);
          el.style.setProperty("--ry", `${((x - 0.5) * 5).toFixed(2)}deg`);
        }
      });
    };
    const onLeave = () => { if (last) clear(last); last = null; };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onLeave, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onLeave);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);
  return null;
}

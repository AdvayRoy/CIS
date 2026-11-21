"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const HOLD_MS = 800;

// Press-and-hold confirmation. Keyboard activation (Enter/Space) confirms directly.
export function HoldButton({ onConfirm, disabled, children, hint, className, ...rest }:
  { onConfirm: () => void; disabled?: boolean; children: ReactNode; hint?: ReactNode; className?: string; "data-testid"?: string }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; setHolding(false); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <button type="button" {...rest} disabled={disabled} data-holding={holding || undefined}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        setHolding(true);
        timer.current = setTimeout(() => { timer.current = null; setHolding(false); navigator.vibrate?.(12); onConfirm(); }, HOLD_MS);
      }}
      onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onClick={(e) => { if (e.detail === 0 && !disabled) onConfirm(); }}
      onContextMenu={(e) => e.preventDefault()}
      className={cn("hold-btn btn-primary relative flex w-full touch-none flex-col items-center justify-center overflow-hidden select-none", className)}>
      <span aria-hidden className="hold-fill" style={{ transitionDuration: holding ? `${HOLD_MS}ms` : "180ms" }} />
      <span className="relative flex items-center gap-2">{children}</span>
      {hint && <span className="relative text-[11px] font-medium opacity-70">{hint}</span>}
    </button>
  );
}

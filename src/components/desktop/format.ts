import type { AgreementState, Asset, FieldDiff } from "@/shared/contract";

/** Shared easing for every desktop transition. */
export const EASE = [0.165, 0.84, 0.44, 1] as const;
export const LABEL = "text-[11px] font-medium tracking-[0.12em] text-muted uppercase";

export type Tone = "mint" | "amber" | "coral" | "muted";
export type Stage = "approved" | "attempted" | "executed";

/** Integer base units -> grouped decimal string, no floating point. */
export function fmtAmount(amount: string, decimals: number): string {
  const s = amount.padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  let frac = decimals ? s.slice(s.length - decimals) : "";
  if (decimals > 2) frac = frac.replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
export const fmtAsset = (amount: string, asset: Asset) => `${fmtAmount(amount, asset.decimals)} ${asset.code}`;

export const short = (id: string, head = 8, tail = 6) =>
  id.length > head + tail + 3 ? `${id.slice(0, head)}…${id.slice(-tail)}` : id;

/** Contract mixes unix seconds and ms; normalise to ms. */
export const toMs = (n: number) => (n < 1e12 ? n * 1000 : n);

export function stateTone(s: AgreementState): Tone {
  switch (s) {
    case "settled": case "approved": return "mint";
    case "awaiting_approval": case "executing": return "amber";
    case "rejected": case "failed": return "coral";
    default: return "muted";
  }
}

export const toneText: Record<Tone, string> = {
  mint: "text-mint", amber: "text-amber", coral: "text-coral", muted: "text-muted",
};
export const toneBorder: Record<Tone, string> = {
  mint: "border-mint/40", amber: "border-amber/40", coral: "border-coral/50", muted: "border-line",
};
export const toneBg: Record<Tone, string> = {
  mint: "bg-mint", amber: "bg-amber", coral: "bg-coral", muted: "bg-line",
};

export function diffValue(d: FieldDiff, which: "approved" | "attempted", asset: Asset): string {
  const v = d[which];
  if ((d.field === "amount" || d.field === "continuingAllowance") && /^\d+$/.test(v)) return fmtAsset(v, asset);
  return v;
}

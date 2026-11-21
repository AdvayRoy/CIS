import { SampleNote } from "./HeroPanels";
import { NetworkCloud } from "./NetworkCloud";

const LIME = "#BCFF2F";
const CORAL = "#FF5466";
const LEGEND = [
  { color: LIME, title: "Matches the approval", body: "Same recipient, same amount, first use. It reaches the rail." },
  { color: CORAL, title: "Differs from the approval", body: "Changed recipient, amount or a second use. It stops at CounterSign." },
  { color: "#A3A199", title: "Either way", body: "The approval, the attempt and the decision are recorded as evidence." },
] as const;

export function PaymentGraph() {
  return (
    <figure className="relative m-0 overflow-hidden rounded-[28px] bg-[#131312] text-[#FAF9F5]">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "radial-gradient(rgb(255 255 255 / 0.09) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />
      <p className="sr-only">
        Graph: customer approvals and merchant attempts meet at CounterSign. Matching payments continue to the bank or crypto rail,
        changed payments stop, and every attempt is recorded as evidence.
      </p>
      <NetworkCloud />
      <ul className="relative m-0 grid list-none gap-5 p-5 sm:grid-cols-3 sm:gap-8 sm:p-8 border-t border-white/10">
        {LEGEND.map((l) => (
          <li key={l.title} className="flex gap-3">
            <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
            <span>
              <span className="block text-[15px] font-semibold">{l.title}</span>
              <span className="mt-1 block text-[14px] leading-relaxed text-[#A3A199]">{l.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <SampleNote className="relative px-5 pb-5 !text-[#A3A199] sm:px-8 sm:pb-6" />
    </figure>
  );
}

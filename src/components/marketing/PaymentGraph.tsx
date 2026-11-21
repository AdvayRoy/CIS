import { SampleNote } from "./HeroPanels";

const LIME = "#BCFF2F";
const CORAL = "#FF5466";
const P = {
  approve: "M190,120 C330,120 350,220 440,220",
  attempt: "M190,320 C330,320 350,220 440,220",
  bank: "M560,220 C680,220 690,100 800,100",
  crypto: "M560,220 L800,220",
  evidence: "M560,220 C680,220 690,340 800,340",
} as const;

const NODES = [
  { x: 110, y: 120, title: "Customer", sub: "approves the exact terms" },
  { x: 110, y: 320, title: "Merchant app", sub: "submits a payment" },
  { x: 880, y: 100, title: "Bank rail", sub: "ledger transfer" },
  { x: 880, y: 220, title: "Crypto rail", sub: "token payment" },
  { x: 880, y: 340, title: "Evidence", sub: "every attempt recorded" },
] as const;

function Dot({ path, color, begin, dur = 2.4, r = 5 }: { path: string; color: string; begin: number; dur?: number; r?: number }) {
  return (
    <circle r={r} fill={color} opacity="0">
      <animateMotion path={path} dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.85;1" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
    </circle>
  );
}

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
      <svg
        viewBox="0 0 1000 440"
        role="img"
        aria-label="Graph: the customer approval and the merchant attempt meet at CounterSign. Matching payments continue to the bank or crypto rail, changed payments stop, and every attempt is recorded as evidence."
        className="relative hidden w-full lg:block"
      >
        <defs>
          <radialGradient id="pg-glow">
            <stop offset="0" stopColor={LIME} stopOpacity="0.35" />
            <stop offset="1" stopColor={LIME} stopOpacity="0" />
          </radialGradient>
        </defs>
        {Object.values(P).map((d) => (
          <path key={d} d={d} fill="none" stroke="rgb(255 255 255 / 0.16)" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
        ))}
        <circle cx="500" cy="220" r="150" fill="url(#pg-glow)" />
        <g className="motion-reduce:hidden" fill="none" stroke={LIME}>
          {[0, 1.5].map((b) => (
            <circle key={b} cx="500" cy="220" r="62" strokeWidth="1.5" opacity="0">
              <animate attributeName="r" values="62;130" dur="3s" begin={`${b}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0" dur="3s" begin={`${b}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </g>
        <g className="motion-reduce:hidden">
          <Dot path={P.approve} color="#FAF9F5" begin={0} />
          <Dot path={P.approve} color="#FAF9F5" begin={3.6} />
          <Dot path={P.attempt} color={LIME} begin={1.2} />
          <Dot path={P.bank} color={LIME} begin={3.6} />
          <Dot path={P.evidence} color="#A3A199" begin={3.6} r={4} />
          <Dot path={P.attempt} color={LIME} begin={4.8} />
          <Dot path={P.crypto} color={LIME} begin={7.2} dur={1.8} />
          <Dot path={P.evidence} color="#A3A199" begin={7.2} r={4} />
          <Dot path={P.attempt} color={CORAL} begin={2.4} dur={3.6} r={6} />
          <Dot path={P.evidence} color={CORAL} begin={6} r={4} />
        </g>
        <circle cx="500" cy="220" r="62" fill="#131312" stroke={LIME} strokeWidth="2" />
        <text x="500" y="216" textAnchor="middle" fill={LIME} fontSize="17" fontWeight="600">CounterSign</text>
        <text x="500" y="237" textAnchor="middle" fill="#A3A199" fontSize="12">compares the two</text>
        {NODES.map((n) => (
          <g key={n.title}>
            <rect x={n.x - 90} y={n.y - 32} width="180" height="64" rx="16" fill="#1C1C1A" stroke="rgb(255 255 255 / 0.14)" />
            <text x={n.x} y={n.y - 3} textAnchor="middle" fill="#FAF9F5" fontSize="15" fontWeight="600">{n.title}</text>
            <text x={n.x} y={n.y + 16} textAnchor="middle" fill="#A3A199" fontSize="12">{n.sub}</text>
          </g>
        ))}
      </svg>
      <ul className="relative m-0 grid list-none gap-5 p-5 sm:grid-cols-3 sm:gap-8 sm:p-8 lg:border-t lg:border-white/10">
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

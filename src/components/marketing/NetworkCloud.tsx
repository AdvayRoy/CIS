"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

const LIME = "#BCFF2F";
const CORAL = "#FF5466";
// Positions are fractions of the stage; x and y swap when the stage is portrait.
const CLUSTERS = [
  { key: "customers", label: "Customers", x: 0.13, y: 0.27, r: 0.14, n: 58, color: "#8E9BFF" },
  { key: "merchants", label: "Merchant apps", x: 0.13, y: 0.73, r: 0.14, n: 58, color: "#F5B544" },
  { key: "core", label: "CounterSign", x: 0.5, y: 0.5, r: 0.13, n: 46, color: LIME },
  { key: "bank", label: "Bank rail", x: 0.87, y: 0.2, r: 0.11, n: 40, color: "#5ED3F3" },
  { key: "crypto", label: "Crypto rail", x: 0.87, y: 0.5, r: 0.11, n: 40, color: "#B58CFF" },
  { key: "evidence", label: "Evidence", x: 0.87, y: 0.8, r: 0.11, n: 44, color: "#A3A199" },
] as const;
const [CUSTOMERS, MERCHANTS, CORE, BANK, CRYPTO, EVIDENCE] = [0, 1, 2, 3, 4, 5];
const BUNDLES: readonly [number, number, number][] = [
  [CUSTOMERS, CORE, 30],
  [MERCHANTS, CORE, 30],
  [CORE, BANK, 20],
  [CORE, CRYPTO, 20],
  [CORE, EVIDENCE, 24],
];

type Route = { from: number; to: number; bend: number };
type Particle = Route & { t: number; speed: number; color: string; size: number; then?: "match" | "stop" };

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGraph() {
  const rnd = seeded(7);
  const nodes: { c: number; a: number; d: number; ph: number; spin: number; size: number }[] = [];
  const members: number[][] = CLUSTERS.map(() => []);
  CLUSTERS.forEach((cl, c) => {
    for (let i = 0; i < cl.n; i++) {
      members[c].push(nodes.length);
      nodes.push({
        c,
        a: rnd() * Math.PI * 2,
        d: c === CORE ? 0.5 + rnd() * 0.5 : Math.sqrt(rnd()),
        ph: rnd() * Math.PI * 2,
        spin: (rnd() - 0.5) * 0.16 + (c === CORE ? 0.12 : 0),
        size: 0.8 + rnd() * rnd() * 2.4,
      });
    }
  });
  const pick = (c: number) => members[c][Math.floor(rnd() * members[c].length)];
  const inner: Route[][] = CLUSTERS.map((_, c) =>
    members[c].flatMap((i) => [0, 1].map(() => ({ from: i, to: pick(c), bend: 0 })))
  );
  const bundles: (Route & { c: number })[] = BUNDLES.flatMap(([a, b, n]) =>
    Array.from({ length: n }, () => ({ from: pick(a), to: pick(b), bend: (rnd() - 0.5) * 0.5, c: a }))
  );
  return { nodes, members, inner, bundles };
}

export function NetworkCloud({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { nodes, members, inner, bundles } = buildGraph();
    const px = new Float32Array(nodes.length);
    const py = new Float32Array(nodes.length);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const any = (c: number) => members[c][Math.floor(Math.random() * members[c].length)];
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let bursts: { x: number; y: number; age: number }[] = [];
    let raf = 0;
    let last = 0;
    let clock = 0;
    let spawnIn = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const place = (t: number) => {
      const tall = h > w;
      const unit = Math.min(w, h);
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const cl = CLUSTERS[n.c];
        const cx = (tall ? cl.y : cl.x) * w;
        const cy = (tall ? cl.x : cl.y) * h;
        const a = n.a + t * n.spin;
        const r = n.d * cl.r * unit * (1 + 0.07 * Math.sin(t * 0.7 + n.ph));
        px[i] = cx + Math.cos(a) * r;
        py[i] = cy + Math.sin(a) * r;
      }
    };

    const control = (r: Route) => {
      const dx = px[r.to] - px[r.from];
      const dy = py[r.to] - py[r.from];
      return [(px[r.from] + px[r.to]) / 2 - dy * r.bend, (py[r.from] + py[r.to]) / 2 + dx * r.bend] as const;
    };
    const along = (r: Route, t: number) => {
      const [qx, qy] = control(r);
      const u = 1 - t;
      return [
        u * u * px[r.from] + 2 * u * t * qx + t * t * px[r.to],
        u * u * py[r.from] + 2 * u * t * qy + t * t * py[r.to],
      ] as const;
    };

    const spawn = () => {
      const core = any(CORE);
      const matched = Math.random() < 0.7;
      particles.push({ from: any(CUSTOMERS), to: core, bend: (Math.random() - 0.5) * 0.4, t: 0, speed: 0.5, color: "#FAF9F5", size: 2 });
      particles.push({
        from: any(MERCHANTS),
        to: core,
        bend: (Math.random() - 0.5) * 0.4,
        t: -0.25,
        speed: 0.5,
        color: matched ? LIME : CORAL,
        size: 2.6,
        then: matched ? "match" : "stop",
      });
    };

    const step = (dt: number) => {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = 0.32 + Math.random() * 0.3;
      }
      const next: Particle[] = [];
      for (const p of particles) {
        p.t += dt * p.speed;
        if (p.t < 1) {
          next.push(p);
          continue;
        }
        if (!p.then) continue;
        const bend = (Math.random() - 0.5) * 0.4;
        if (p.then === "match") {
          next.push({ from: p.to, to: any(Math.random() < 0.5 ? BANK : CRYPTO), bend, t: 0, speed: 0.6, color: LIME, size: 2.6 });
        } else {
          bursts.push({ x: px[p.to], y: py[p.to], age: 0 });
        }
        next.push({ from: p.to, to: any(EVIDENCE), bend: -bend, t: 0, speed: 0.6, color: p.then === "match" ? "#D8D6CE" : CORAL, size: 1.6 });
      }
      particles = next;
      bursts = bursts.filter((b) => (b.age += dt * 1.4) < 1);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      const tall = h > w;
      const core = CLUSTERS[CORE];
      const gx = (tall ? core.y : core.x) * w;
      const gy = (tall ? core.x : core.y) * h;
      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.min(w, h) * 0.34);
      glow.addColorStop(0, "rgba(188,255,47,0.20)");
      glow.addColorStop(1, "rgba(188,255,47,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.lineWidth = 0.6;
      CLUSTERS.forEach((cl, c) => {
        ctx.strokeStyle = cl.color;
        ctx.globalAlpha = 0.16;
        ctx.beginPath();
        for (const l of inner[c]) {
          ctx.moveTo(px[l.from], py[l.from]);
          ctx.lineTo(px[l.to], py[l.to]);
        }
        ctx.stroke();
      });
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.15;
      for (const l of bundles) {
        const [qx, qy] = control(l);
        ctx.strokeStyle = CLUSTERS[l.c].color;
        ctx.beginPath();
        ctx.moveTo(px[l.from], py[l.from]);
        ctx.quadraticCurveTo(qx, qy, px[l.to], py[l.to]);
        ctx.stroke();
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        ctx.fillStyle = CLUSTERS[n.c].color;
        if (n.size > 1.9) {
          ctx.globalAlpha = 0.12;
          ctx.beginPath();
          ctx.arc(px[i], py[i], n.size * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(px[i], py[i], n.size, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of particles) {
        if (p.t <= 0) continue;
        ctx.fillStyle = p.color;
        for (let k = 0; k < 7; k++) {
          const t = p.t - k * 0.022;
          if (t <= 0) break;
          const [x, y] = along(p, t);
          ctx.globalAlpha = k === 0 ? 1 : 0.5 * (1 - k / 7);
          ctx.beginPath();
          ctx.arc(x, y, p.size * (k === 0 ? 1 : 1 - k / 9), 0, Math.PI * 2);
          ctx.fill();
        }
        const [x, y] = along(p, p.t);
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(x, y, p.size * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = CORAL;
      ctx.lineWidth = 1.5;
      for (const b of bursts) {
        ctx.globalAlpha = 1 - b.age;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4 + b.age * 24, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      clock += dt;
      place(clock);
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (still || raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const ro = new ResizeObserver(() => {
      resize();
      place(clock);
      draw();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div className={cn("relative aspect-[3/4] sm:aspect-[2/1]", className)}>
      <canvas ref={ref} aria-hidden className="absolute inset-0 size-full" />
      {CLUSTERS.map((c) => (
        <span
          key={c.key}
          aria-hidden
          style={{ "--x": `${c.x * 100}%`, "--y": `${c.y * 100}%` } as React.CSSProperties}
          className={cn(
            "pointer-events-none absolute left-[var(--y)] top-[var(--x)] inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#131312]/80 px-2.5 py-1 text-[11px] font-semibold text-[#FAF9F5] ring-1 ring-white/10 sm:left-[var(--x)] sm:top-[var(--y)] sm:px-3 sm:text-[13px]",
            c.key === "core" && "px-3 py-1.5 text-[13px] text-[#BCFF2F] ring-[#BCFF2F]/60 sm:px-4 sm:text-[15px]"
          )}
        >
          {c.key !== "core" && <span className="size-1.5 rounded-full" style={{ background: c.color }} />}
          {c.label}
        </span>
      ))}
    </div>
  );
}

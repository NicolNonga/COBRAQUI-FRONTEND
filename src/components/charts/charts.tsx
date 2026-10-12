"use client";
import { useMemo, useState, type ReactNode } from "react";
import { cn, formatMoney } from "@/lib/utils";

/* Gráfico de área com duas séries, grelha discreta e tooltip. */
export function AreaChart({ data, series, height = 260, format = (v: number) => formatMoney(v, "AOA", true) }: {
  data: { label: string; [k: string]: number | string }[];
  series: { key: string; label: string; color: string }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = height, P = { t: 12, r: 12, b: 28, l: 64 };
  const max = useMemo(() => {
    const m = Math.max(...data.flatMap((d) => series.map((s) => Number(d[s.key]))));
    const pow = Math.pow(10, Math.floor(Math.log10(m || 1)));
    return Math.ceil(m / pow) * pow;
  }, [data, series]);
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  const path = (key: string) => {
    const pts = data.map((d, i) => [x(i), y(Number(d[key]))]);
    return pts.reduce((acc, [px, py], i) => {
      if (i === 0) return `M${px},${py}`;
      const [qx, qy] = pts[i - 1];
      const cx = (qx + px) / 2;
      return `${acc} C${cx},${qy} ${cx},${py} ${px},${py}`;
    }, "");
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onMouseLeave={() => setHover(null)}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity="0.22" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? "" : "3 4"} />
            <text x={P.l - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>
        ))}
        {series.map((s) => (
          <g key={s.key}>
            <path d={`${path(s.key)} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#g-${s.key})`} />
            <path d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2.25" strokeLinecap="round" />
          </g>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--muted)" strokeOpacity="0.4" />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]))} r="4.5" fill="var(--surface)" stroke={s.color} strokeWidth="2.5" />
            ))}
          </g>
        )}
        {data.map((_, i) => (
          <rect key={i} x={x(i) - (W - P.l - P.r) / data.length / 2} y={0} width={(W - P.l - P.r) / data.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-xl border surface p-3 text-xs shadow-pop"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? "calc(-100% - 12px)" : "12px"})` }}>
          <p className="mb-2 font-medium">{data[hover].label}</p>
          {series.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4 py-0.5">
              <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <span className="tabular font-medium">{formatMoney(Number(data[hover][s.key]))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Donut({ data, size = 168, thickness = 22, center }: {
  data: { label: string; value: number; color: string }[]; size?: number; thickness?: number; center?: ReactNode;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft)" strokeWidth={thickness} />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const gap = data.length > 1 ? 3 : 0;
          const el = (
            <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={active === i ? thickness + 4 : thickness}
              strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-acc} className="transition-all duration-200"
              onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {active !== null ? (
          <>
            <span className="tabular text-xl font-semibold">{data[active].value}</span>
            <span className="text-xs text-muted">{data[active].label}</span>
          </>
        ) : center}
      </div>
    </div>
  );
}

export function HBars({ data, format = (v: number) => formatMoney(v, "AOA", true), colors }: {
  data: { label: string; value: number }[]; format?: (v: number) => string; colors?: string[];
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const palette = colors ?? ["bg-brand-300", "bg-brand-400", "bg-brand-500", "bg-brand-700"];
  return (
    <div className="space-y-4">
      {data.map((d, i) => (
        <div key={d.label}>
          <div className="mb-1.5 flex items-center justify-between text-[13px]">
            <span className="text-muted">{d.label}</span>
            <span className="tabular font-medium">{format(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-soft">
            <div className={cn("h-full rounded-full", palette[i % palette.length])} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ values, color = "var(--color-brand-500)", className }: { values: number[]; color?: string; className?: string }) {
  const max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / (max - min || 1)) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-8 w-24", className)}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

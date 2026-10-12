"use client";
import { useMemo, useState, type ReactNode } from "react";
import { FileDown, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Input, SegmentedControl, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useQuery } from "@/hooks/use-query";
import { errorMessage } from "@/lib/api/http";
import { organizationService, userService } from "@/lib/api/services";
import { reportService, type ReportKey } from "@/lib/api/reports";
import { cn, formatMoney, formatNumber, todayIso } from "@/lib/utils";
import type { Pagination } from "@/types/models";
import type { AgingBucket, AgingBucketKey } from "@/types/reports";

/* ───────── formatação ───────── */
export const money = (v: number | string | null | undefined, code = "AOA") => formatMoney(v, code);
export const moneyShort = (v: number | string | null | undefined, code = "AOA") => formatMoney(v, code, true);
export const pctS = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? "—" : `${v.toFixed(digits).replace(".", ",")}%`);
export const dateS = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
export const dateTimeS = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "—";
export const durationS = (s: number | null | undefined) => (s ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : "—");
export const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

/* ───────── cores das faixas de aging ───────── */
export const BUCKET_COLOR: Record<AgingBucketKey, string> = {
  CURRENT: "bg-success-500", D1_30: "bg-brand-500", D31_60: "bg-warning-400", D61_90: "bg-warning-600", D91_180: "bg-danger-500", D180_PLUS: "bg-danger-700",
};
export const BUCKET_TEXT: Record<AgingBucketKey, string> = {
  CURRENT: "text-success-700 dark:text-success-300", D1_30: "text-brand-700 dark:text-brand-300", D31_60: "text-warning-700", D61_90: "text-warning-700",
  D91_180: "text-danger-700 dark:text-danger-300", D180_PLUS: "text-danger-700 dark:text-danger-300",
};

/* ───────── período ───────── */
export type Preset = "30d" | "90d" | "month" | "year" | "custom";
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export function periodFor(preset: Preset, custom: { from: string; to: string }) {
  const to = todayIso();
  if (preset === "30d") return { from: addDays(to, -29), to };
  if (preset === "90d") return { from: addDays(to, -89), to };
  if (preset === "month") return { from: `${to.slice(0, 8)}01`, to };
  if (preset === "year") return { from: `${to.slice(0, 4)}-01-01`, to };
  return custom;
}

export interface FiltersState { preset: Preset; custom: { from: string; to: string }; organizationId: string; agentId: string }
export const initialFilters = (preset: Preset = "90d"): FiltersState => ({ preset, custom: { from: addDays(todayIso(), -89), to: todayIso() }, organizationId: "", agentId: "" });

/** Barra de filtros comum: período, credor e agente (cada separador mostra o que usa). */
export function FilterBar({ value, onChange, period = true, agent = true, children, actions }: {
  value: FiltersState; onChange: (v: FiltersState) => void; period?: boolean; agent?: boolean; children?: ReactNode; actions?: ReactNode;
}) {
  const { data: orgs } = useQuery(() => organizationService.dropdown().catch(() => []));
  const { data: users } = useQuery(() => (agent ? userService.dropdown().catch(() => []) : Promise.resolve([])), [agent]);
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {period && <>
        <SegmentedControl value={value.preset} onChange={(preset) => onChange({ ...value, preset })}
          options={[{ value: "30d", label: "30 dias" }, { value: "90d", label: "90 dias" }, { value: "month", label: "Este mês" }, { value: "year", label: "Este ano" }, { value: "custom", label: "Período" }]} />
        {value.preset === "custom" && (
          <div className="flex items-center gap-1.5">
            <Input type="date" value={value.custom.from} max={value.custom.to} onChange={(e) => onChange({ ...value, custom: { ...value.custom, from: e.target.value } })} className="h-8 w-38" aria-label="Desde" />
            <span className="text-sm text-muted">–</span>
            <Input type="date" value={value.custom.to} min={value.custom.from} max={todayIso()} onChange={(e) => onChange({ ...value, custom: { ...value.custom, to: e.target.value } })} className="h-8 w-38" aria-label="Até" />
          </div>
        )}
      </>}
      <Select value={value.organizationId} onChange={(e) => onChange({ ...value, organizationId: e.target.value })} className="h-8 w-48" aria-label="Credor">
        <option value="">Todos os credores</option>
        {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Select>
      {agent && (
        <Select value={value.agentId} onChange={(e) => onChange({ ...value, agentId: e.target.value })} className="h-8 w-48" aria-label="Agente">
          <option value="">Todos os agentes</option>
          {(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.fullName ?? u.email}</option>)}
        </Select>
      )}
      {children}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Botão "Gerar PDF": o servidor gera o documento com os filtros activos. */
export function PdfButton({ report, params, label = "Gerar PDF" }: { report: ReportKey; params: object; label?: string }) {
  const toast = useToast();
  return (
    <Button icon={<FileDown className="h-4 w-4" />} onClick={async () => {
      try {
        await reportService.pdf(report, params);
        toast("success", "PDF gerado", "O relatório foi descarregado.");
      } catch (e) {
        toast("error", "Não foi possível gerar o PDF", errorMessage(e));
      }
    }}>{label}</Button>
  );
}

/* ───────── cartões de indicador ───────── */
export type KpiTone = "neutral" | "success" | "warning" | "danger" | "brand";
const TONE_TEXT: Record<KpiTone, string> = {
  neutral: "text-[var(--text)]", brand: "text-brand-700 dark:text-brand-300", success: "text-success-700 dark:text-success-300",
  warning: "text-warning-700 dark:text-warning-400", danger: "text-danger-700 dark:text-danger-300",
};
const TONE_BAR: Record<KpiTone, string> = { neutral: "bg-ink-300", brand: "bg-brand-500", success: "bg-success-500", warning: "bg-warning-500", danger: "bg-danger-500" };
const VERDICT: Record<KpiTone, string> = { neutral: "", brand: "", success: "Bom", warning: "Atenção", danger: "Crítico" };

/** tom pelo valor: menor é melhor (DSO, inadimplência, custo) ou maior é melhor (CEI) */
export const toneFor = (v: number | null, good: number, bad: number, higherIsBetter = false): KpiTone => {
  if (v === null) return "neutral";
  if (higherIsBetter) return v >= good ? "success" : v <= bad ? "danger" : "warning";
  return v <= good ? "success" : v >= bad ? "danger" : "warning";
};

export function KpiTile({ label, value, tone = "neutral", hint, help, verdict = false, loading }: {
  label: string; value: ReactNode; tone?: KpiTone; hint?: ReactNode; help?: string; verdict?: boolean; loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="relative h-full overflow-hidden">
      <span className={cn("absolute inset-y-0 left-0 w-1", TONE_BAR[tone])} />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <div className="flex items-center gap-1.5">
          {verdict && VERDICT[tone] && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-current/20", TONE_TEXT[tone])}>{VERDICT[tone]}</span>}
          {help && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Como se calcula: ${label}`} title="Como se calcula"
              className="rounded-md p-0.5 text-muted hover:bg-soft hover:text-[var(--text)]"><HelpCircle className="h-4 w-4" /></button>
          )}
        </div>
      </div>
      {loading ? <div className="skeleton mt-3 h-8 w-32 rounded-md" /> : <p className={cn("tabular mt-2 text-[26px] leading-8 font-semibold tracking-tight", TONE_TEXT[tone])}>{value}</p>}
      {hint && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
      {open && help && <p className="mt-3 rounded-lg bg-subtle p-2.5 text-xs leading-relaxed text-muted">{help}</p>}
    </Card>
  );
}

/* ───────── aging: barra empilhada + legenda ───────── */
export function AgingStack({ buckets, currency }: { buckets: AgingBucket[]; currency: string }) {
  const total = buckets.reduce((s, b) => s + b.amount, 0);
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-soft" role="img" aria-label="Distribuição do valor em aberto por faixa de atraso">
        {total > 0 && buckets.filter((b) => b.amount > 0).map((b) => (
          <div key={b.key} className={cn("h-full", BUCKET_COLOR[b.key])} style={{ width: `${(b.amount / total) * 100}%` }} title={`${b.label}: ${money(b.amount, currency)} (${pctS(b.pct)})`} />
        ))}
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {buckets.map((b) => (
          <div key={b.key} className="flex items-center gap-2.5 text-sm">
            <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", BUCKET_COLOR[b.key])} />
            <span className="flex-1 text-muted">{b.label}</span>
            <span className="tabular font-medium">{moneyShort(b.amount, currency)}</span>
            <span className="tabular w-14 text-right text-xs text-muted">{pctS(b.pct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── paginação no cliente (relatórios devolvem a lista completa) ───────── */
export function useClientPage<T>(rows: T[] | undefined, perPage = 20) {
  const [page, setPage] = useState(1);
  const list = rows ?? [];
  const lastPage = Math.max(1, Math.ceil(list.length / perPage));
  const current = Math.min(page, lastPage);
  const meta: Pagination = { total: list.length, perPage, currentPage: current, lastPage, firstPage: 1 };
  const pageRows = useMemo(() => list.slice((current - 1) * perPage, current * perPage), [list, current, perPage]);
  return { pageRows, meta, setPage };
}

/** pequena caixa de explicação no fim de cada separador */
export function Explain({ children }: { children: ReactNode }) {
  return <div className="mt-5 rounded-xl bg-subtle px-4 py-3 text-xs leading-relaxed text-muted">{children}</div>;
}

export function filtersToParams(f: FiltersState, opts: { period?: boolean; agent?: boolean } = {}) {
  const p = periodFor(f.preset, f.custom);
  return {
    ...(opts.period === false ? {} : { from: p.from, to: p.to }),
    organizationId: f.organizationId ? Number(f.organizationId) : undefined,
    ...(opts.agent === false ? {} : { agentId: f.agentId ? Number(f.agentId) : undefined }),
  };
}

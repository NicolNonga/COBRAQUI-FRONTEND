"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarClock, FileWarning, Handshake, PhoneCall, Scale } from "lucide-react";
import { Badge, Card, CardHeader, Skeleton } from "@/components/ui/display";
import { SearchInput, SegmentedControl, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { HBars } from "@/components/charts/charts";
import { ErrorBanner } from "@/components/shared/process-list";
import { useDebounced, useQuery } from "@/hooks/use-query";
import { catalogService } from "@/lib/api/services";
import { reportService } from "@/lib/api/reports";
import { cn, formatNumber } from "@/lib/utils";
import type { AgingBucketKey, AgingRow, BrokenReport, CashFlowReport, ContactsReport, DisputesReport } from "@/types/reports";
import {
  AgingStack, BUCKET_TEXT, dateS, dateTimeS, durationS, Explain, FilterBar, filtersToParams, initialFilters, KpiTile, money, moneyShort, pctS, PdfButton, plural,
  toneFor, useClientPage, type FiltersState,
} from "./shared";

const Tbl = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("overflow-x-auto", className)}><table className="w-full text-sm">{children}</table></div>
);
const Th = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => <th className={cn("px-4 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>;
const Td = ({ children, right, className }: { children?: React.ReactNode; right?: boolean; className?: string }) => <td className={cn("px-4 py-2.5", right && "tabular text-right", className)}>{children}</td>;

/* ═══════════════════════════ Aging list detalhado ═══════════════════════════ */
export function AgingTab() {
  const [f, setF] = useState<FiltersState>(initialFilters());
  const [bucket, setBucket] = useState<AgingBucketKey | "">("");
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const params = { ...filtersToParams(f, { period: false }), bucket: bucket || undefined, search: debounced || undefined };
  const { data: a, loading, error, reload } = useQuery(() => reportService.aging(params), [JSON.stringify(params)]);
  const cur = a?.currency.code ?? "AOA";
  const { pageRows, meta, setPage } = useClientPage(a?.rows, 25);

  const cols: Column<AgingRow>[] = [
    { key: "debtor", header: "Devedor", cell: (i) => <div className="min-w-0"><Link href={`/debtors/${i.debtorId}`} className="block max-w-[220px] truncate font-medium hover:underline">{i.debtorName}</Link><p className="text-xs text-muted">{i.organizationName}</p></div> },
    { key: "ref", header: "Factura", cell: (i) => <span className="font-mono text-xs">{i.reference}</span> },
    { key: "due", header: "Vencimento", cell: (i) => <span className="tabular">{dateS(i.dueDate)}</span> },
    { key: "days", header: "Atraso", align: "right", cell: (i) => i.daysOverdue > 0 ? <span className="tabular">{i.daysOverdue} d</span> : <span className="text-xs text-muted">a vencer</span> },
    { key: "bucket", header: "Faixa", cell: (i) => <span className={cn("text-[13px] font-medium", BUCKET_TEXT[i.bucket])}>{i.bucketLabel}</span> },
    { key: "sit", header: "Situação", hideOnMobile: true, cell: (i) => <span className="text-[13px] text-muted">{i.situation}</span> },
    { key: "agent", header: "Agente", hideOnMobile: true, cell: (i) => <span className="text-[13px]">{i.agentName ?? <span className="text-muted">—</span>}</span> },
    { key: "amount", header: "Valor", align: "right", hideOnMobile: true, cell: (i) => <span className="tabular text-muted">{money(i.amount, cur)}</span> },
    { key: "out", header: "Em aberto", align: "right", cell: (i) => <span className="tabular font-medium">{money(i.outstanding, cur)}</span> },
  ];

  return (
    <>
      <FilterBar value={f} onChange={setF} period={false} actions={<PdfButton report="aging" params={params} />}>
        <Select value={bucket} onChange={(e) => setBucket(e.target.value as AgingBucketKey | "")} className="h-8 w-44" aria-label="Faixa de atraso">
          <option value="">Todas as faixas</option>
          {(a?.buckets ?? []).map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </Select>
      </FilterBar>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <Card>
        <CardHeader title="Resumo por faixa de atraso" description={a ? `Situação a ${dateS(a.asOf)} · ${money(a.totalOutstanding, cur)} em aberto` : "A carregar…"} />
        <div className="mt-5">{a ? <AgingStack buckets={a.buckets} currency={cur} /> : <Skeleton className="h-24" />}</div>
      </Card>
      <div className="mt-4">
        <DataTable columns={cols} rows={pageRows} meta={meta} loading={loading} onPage={setPage} onRefresh={reload}
          toolbar={<>
            <SearchInput value={search} onChange={setSearch} placeholder="Devedor, NIF ou factura…" className="sm:w-72" />
            {a && <span className="tabular text-[13px] text-muted">{plural(a.rows.length, "factura", "facturas")} · {money(a.filteredOutstanding, cur)}</span>}
          </>}
          empty={{ title: "Sem facturas em aberto", description: "Nenhuma factura em aberto corresponde aos filtros.", icon: <FileWarning /> }} />
      </div>
      {a?.truncated && <p className="mt-2 text-xs text-warning-700">A lista mostra as primeiras 5 000 facturas. Use os filtros para reduzir o resultado.</p>}
      <Explain>O aging é sempre calculado à data de hoje. Com acordo em vigor, o valor em aberto de cada factura é a sua parte do que falta pagar do acordo. O PDF agrupa as facturas por devedor, com subtotais.</Explain>
    </>
  );
}

/* ═══════════════════════════ Projecção de fluxo de caixa ═══════════════════════════ */
export function CashFlowTab() {
  const [f, setF] = useState<FiltersState>(initialFilters());
  const [gran, setGran] = useState<"week" | "month">("week");
  const params = { ...filtersToParams(f, { period: false }), granularity: gran };
  const { data: c, error, reload } = useQuery(() => reportService.cashFlow(params), [JSON.stringify(params)]);
  const cur = c?.currency.code ?? "AOA";
  const rows: CashFlowReport["periods"] = c ? [c.overdue, ...c.periods] : [];
  const max = Math.max(1, ...rows.map((r) => r.nominal));
  const inst = useClientPage(c?.installments.map((i, idx) => ({ ...i, id: idx + 1 })), 15);

  return (
    <>
      <FilterBar value={f} onChange={setF} period={false} actions={<PdfButton report="cash-flow" params={params} />}>
        <SegmentedControl value={gran} onChange={setGran} options={[{ value: "week", label: "12 semanas" }, { value: "month", label: "6 meses" }]} />
      </FilterBar>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile loading={!c} label="Entrada provável" tone="success" value={c ? moneyShort(c.totals.probable, cur) : "—"} hint="Ponderada pelo histórico de cumprimento"
          help="Prestações × taxa de cumprimento das prestações nos últimos 180 dias (metade para prestações já em atraso) + facturas a vencer × percentagem de facturas pagas nos últimos 180 dias + pagamentos já registados a confirmar (100%)." />
        <KpiTile loading={!c} label="Valor nominal" value={c ? moneyShort(c.totals.nominal, cur) : "—"} hint="Tudo o que vence no horizonte" />
        <KpiTile loading={!c} label="Prestações de acordos" tone="brand" value={c ? moneyShort(c.totals.agreements, cur) : "—"}
          hint={c ? `Cumprimento histórico: ${c.rates.installment === null ? "sem histórico" : pctS(c.rates.installment * 100)}` : undefined} />
        <KpiTile loading={!c} label="Pagamentos a confirmar" value={c ? moneyShort(c.totals.pending, cur) : "—"}
          hint={c ? plural(c.totals.pendingCount, "pagamento registado", "pagamentos registados") : undefined} />
      </div>

      <Card className="mt-4" padded={false}>
        <div className="p-5 pb-3"><CardHeader title="Entradas por período" description={c ? `A partir de ${dateS(c.asOf)}` : undefined} /></div>
        {!c ? <Skeleton className="m-5 h-64" /> : (
          <Tbl>
            <thead><tr className="border-y bg-subtle text-xs text-muted">
              <Th>Período</Th><Th right>Acordos</Th><Th right>Facturas a vencer</Th><Th right>A confirmar</Th><Th right>Nominal</Th><Th right>Provável</Th><Th>Distribuição</Th><Th right>Acumulado</Th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.label} className={cn("border-b last:border-0", i === 0 && r.nominal === 0 && "hidden")}>
                  <Td className={cn("whitespace-nowrap font-medium", i === 0 && "text-warning-700")}>{r.label}</Td>
                  <Td right>{r.agreements ? money(r.agreements, cur) : <span className="text-muted">—</span>}</Td>
                  <Td right>{r.invoices ? money(r.invoices, cur) : <span className="text-muted">—</span>}</Td>
                  <Td right>{r.pending ? money(r.pending, cur) : <span className="text-muted">—</span>}</Td>
                  <Td right>{money(r.nominal, cur)}</Td>
                  <Td right className="font-semibold text-success-700 dark:text-success-300">{money(r.probable, cur)}</Td>
                  <Td>
                    <div className="relative h-2 w-28 overflow-hidden rounded-full bg-soft" title={`Provável ${money(r.probable, cur)} de ${money(r.nominal, cur)}`}>
                      <div className="absolute inset-y-0 left-0 bg-brand-200 dark:bg-brand-500/30" style={{ width: `${(r.nominal / max) * 100}%` }} />
                      <div className="absolute inset-y-0 left-0 bg-success-500" style={{ width: `${(r.probable / max) * 100}%` }} />
                    </div>
                  </Td>
                  <Td right className="text-muted">{money(r.cumulative, cur)}</Td>
                </tr>
              ))}
            </tbody>
          </Tbl>
        )}
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Prestações de acordos previstas</h3>
          <DataTable dense rows={inst.pageRows} meta={inst.meta} onPage={inst.setPage} loading={!c}
            columns={[
              { key: "due", header: "Vencimento", cell: (i) => <span className={cn("tabular", i.status === "OVERDUE" && "font-medium text-danger-600")}>{dateS(i.dueDate)}</span> },
              { key: "deb", header: "Devedor", cell: (i) => <div><p className="max-w-[180px] truncate font-medium">{i.debtorName}</p><p className="text-xs text-muted">Acordo #{i.negotiationId} · {i.number ? `prestação ${i.number}/${i.of}` : "à vista"}</p></div> },
              { key: "ag", header: "Agente", hideOnMobile: true, cell: (i) => <span className="text-[13px]">{i.agentName ?? "—"}</span> },
              { key: "v", header: "Por receber", align: "right", cell: (i) => <span className="tabular font-medium">{money(i.remaining, cur)}</span> },
            ]}
            empty={{ title: "Sem prestações no horizonte", icon: <CalendarClock /> }} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Facturas a vencer (sem acordo)</h3>
          <DataTable dense rows={c?.upcomingInvoices} loading={!c}
            columns={[
              { key: "due", header: "Vencimento", cell: (i) => <span className="tabular">{dateS(i.dueDate)}</span> },
              { key: "ref", header: "Factura", cell: (i) => <div><p className="font-mono text-xs">{i.reference}</p><p className="max-w-[180px] truncate text-xs text-muted">{i.debtorName}</p></div> },
              { key: "v", header: "Em aberto", align: "right", cell: (i) => <span className="tabular font-medium">{money(i.outstanding, cur)}</span> },
            ]}
            empty={{ title: "Sem facturas a vencer no horizonte", icon: <CalendarClock /> }} />
        </div>
      </div>
      <Explain>
        A previsão junta três fontes: prestações dos acordos em vigor (na data de vencimento), facturas ainda não vencidas sem acordo e pagamentos já registados que aguardam confirmação.
        O valor provável aplica as taxas observadas nos últimos 180 dias{c ? ` (prestações ${c.rates.installment === null ? "sem histórico" : pctS(c.rates.installment * 100)}, facturas ${c.rates.invoice === null ? "sem histórico" : pctS(c.rates.invoice * 100)})` : ""}.
      </Explain>
    </>
  );
}

/* ═══════════════════════════ Histórico de contactos ═══════════════════════════ */
type ContactRow = ContactsReport["rows"][number];
const STATUS_TONE: Record<string, "success" | "danger" | "neutral" | "info" | "warning"> = {
  answered: "success", negotiation_started: "success", no_answer: "danger", failed: "danger", attempted: "info", pending: "warning",
};

export function ContactsTab() {
  const [f, setF] = useState<FiltersState>(initialFilters("30d"));
  const [status, setStatus] = useState("");
  const [typeId, setTypeId] = useState("");
  const params = { ...filtersToParams(f), status: status || undefined, contactTypeId: typeId ? Number(typeId) : undefined };
  const { data: c, loading, error, reload } = useQuery(() => reportService.contacts(params), [JSON.stringify(params)]);
  const { data: types } = useQuery(() => catalogService.contactTypes().then((r) => r.data).catch(() => []));
  const { pageRows, meta, setPage } = useClientPage(c?.rows, 25);
  const failed = c ? c.byStatus.filter((s) => s.key === "no_answer" || s.key === "failed").reduce((a, s) => a + s.count, 0) : 0;

  const cols: Column<ContactRow>[] = [
    { key: "at", header: "Data e hora", cell: (x) => <span className="tabular whitespace-nowrap">{dateTimeS(x.contactedAt)}</span> },
    { key: "agent", header: "Agente", cell: (x) => <span className="text-[13px]">{x.agentName ?? "—"}</span> },
    { key: "deb", header: "Devedor", cell: (x) => <div><p className="max-w-[200px] truncate font-medium">{x.debtorName}</p><p className="text-xs text-muted">Processo #{x.processId} · {x.organizationName}</p></div> },
    { key: "type", header: "Tipo", hideOnMobile: true, cell: (x) => x.type },
    { key: "st", header: "Resultado", cell: (x) => <Badge tone={STATUS_TONE[x.status] ?? "neutral"} dot>{x.statusLabel}</Badge> },
    { key: "dur", header: "Duração", align: "right", hideOnMobile: true, cell: (x) => <span className="tabular text-muted">{durationS(x.durationSeconds)}</span> },
    { key: "notes", header: "Notas", hideOnMobile: true, cell: (x) => <span className="line-clamp-2 max-w-[280px] text-[13px] text-muted" title={x.notes ?? ""}>{x.notes || "—"}</span> },
  ];

  return (
    <>
      <FilterBar value={f} onChange={setF} actions={<PdfButton report="contacts" params={params} />}>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 w-44" aria-label="Resultado">
          <option value="">Todos os resultados</option>
          <option value="answered">Atendido</option><option value="negotiation_started">Negociação iniciada</option><option value="no_answer">Sem resposta</option>
          <option value="failed">Falhou</option><option value="attempted">Tentativa</option><option value="pending">Pendente</option>
        </Select>
        <Select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="h-8 w-40" aria-label="Tipo de contacto">
          <option value="">Todos os tipos</option>
          {(types ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </FilterBar>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile loading={!c} label="Contactos" tone="brand" value={c ? formatNumber(c.total) : "—"} hint={c ? plural(c.debtorsContacted, "devedor contactado", "devedores contactados") : undefined} />
        <KpiTile loading={!c} label="Contacto efectivo" verdict tone={toneFor(c?.reachRate ?? null, 50, 25, true)} value={pctS(c?.reachRate)} hint="Atendidos ou com negociação iniciada" />
        <KpiTile loading={!c} label="Negociações iniciadas" tone="success" value={c ? formatNumber(c.negotiationsStarted) : "—"} />
        <KpiTile loading={!c} label="Sem resposta ou falhados" tone="warning" value={c ? formatNumber(failed) : "—"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" padded={false}>
          <div className="p-5 pb-3"><CardHeader title="Por agente" description="Produtividade e eficácia no período" /></div>
          <Tbl>
            <thead><tr className="border-y bg-subtle text-xs text-muted"><Th>Agente</Th><Th right>Contactos</Th><Th right>Devedores</Th><Th right>Efectivos</Th><Th right>Taxa</Th><Th right>Negociações</Th><Th right>Duração média</Th></tr></thead>
            <tbody>
              {(c?.byAgent ?? []).map((a) => (
                <tr key={a.agentName} className="border-b last:border-0">
                  <Td className="font-medium">{a.agentName}</Td><Td right>{formatNumber(a.total)}</Td><Td right>{formatNumber(a.debtors)}</Td><Td right>{formatNumber(a.reached)}</Td>
                  <Td right>{pctS(a.reachRate)}</Td><Td right>{formatNumber(a.negotiations)}</Td><Td right>{durationS(a.avgDurationSeconds)}</Td>
                </tr>
              ))}
              {c && !c.byAgent.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">Sem contactos no período.</td></tr>}
            </tbody>
          </Tbl>
        </Card>
        <Card>
          <CardHeader title="Por resultado" />
          <div className="mt-4">{c ? <HBars data={c.byStatus.map((s) => ({ label: s.label, value: s.count }))} format={(v) => formatNumber(v)}
            colors={["bg-success-500", "bg-brand-500", "bg-warning-500", "bg-danger-500", "bg-ink-400"]} /> : <Skeleton className="h-32" />}</div>
        </Card>
      </div>

      <div className="mt-4">
        <DataTable columns={cols} rows={pageRows} meta={meta} loading={loading} onPage={setPage} onRefresh={reload}
          toolbar={c ? <span className="tabular text-[13px] text-muted">{plural(c.total, "contacto", "contactos")}</span> : undefined}
          empty={{ title: "Sem contactos no período", description: "Ajuste o período ou os filtros.", icon: <PhoneCall /> }} />
      </div>
      {c?.truncated && <p className="mt-2 text-xs text-warning-700">Lista limitada aos 5 000 contactos mais recentes. Reduza o período para ver tudo.</p>}
    </>
  );
}

/* ═══════════════════════════ Acordos quebrados ═══════════════════════════ */
type BrokenRow = BrokenReport["rows"][number];
export function BrokenTab() {
  const [f, setF] = useState<FiltersState>(initialFilters());
  const params = filtersToParams(f);
  const { data: b, loading, error, reload } = useQuery(() => reportService.brokenAgreements(params), [JSON.stringify(params)]);
  const cur = b?.currency.code ?? "AOA";
  const { pageRows, meta, setPage } = useClientPage(b?.rows, 20);

  const cols: Column<BrokenRow>[] = [
    { key: "id", header: "Acordo", cell: (x) => <Link href={`/negotiations/${x.id}`} className="font-medium text-brand-600 hover:underline">#{x.id}</Link> },
    { key: "deb", header: "Devedor", cell: (x) => <div><p className="max-w-[200px] truncate font-medium">{x.debtorName}</p><p className="text-xs text-muted">{x.organizationName}</p></div> },
    { key: "ag", header: "Agente", hideOnMobile: true, cell: (x) => <span className="text-[13px]">{x.agentName ?? "—"}</span> },
    { key: "dates", header: "Início → quebra", cell: (x) => <span className="tabular whitespace-nowrap text-[13px]">{dateS(x.startedAt?.slice(0, 10))} → <b>{dateS(x.brokenAt.slice(0, 10))}</b></span> },
    { key: "inst", header: "Prestações", align: "center", cell: (x) => <span className="tabular">{x.installmentsPaid}/{x.installmentsTotal}</span> },
    { key: "agreed", header: "Acordado", align: "right", hideOnMobile: true, cell: (x) => <span className="tabular text-muted">{money(x.agreed, cur)}</span> },
    { key: "paid", header: "Pago", align: "right", hideOnMobile: true, cell: (x) => <span className="tabular">{money(x.paid, cur)}</span> },
    { key: "miss", header: "Em falta", align: "right", cell: (x) => <span className="tabular font-medium text-danger-600">{money(x.missing, cur)}</span> },
    { key: "why", header: "Motivo", cell: (x) => <div className="max-w-[260px]"><Badge tone={x.automatic ? "warning" : "neutral"}>{x.automatic ? "Automática" : `Manual · ${x.brokenByName ?? "—"}`}</Badge><p className="mt-1 line-clamp-2 text-xs text-muted" title={x.breakReason}>{x.breakReason}</p></div> },
    { key: "ren", header: "Renegociado", cell: (x) => x.renegotiatedId ? <Link href={`/negotiations/${x.renegotiatedId}`} className="text-[13px] text-brand-600 hover:underline">#{x.renegotiatedId}</Link> : <span className="text-xs text-muted">Não</span> },
  ];

  return (
    <>
      <FilterBar value={f} onChange={setF} actions={<PdfButton report="broken-agreements" params={params} />} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile loading={!b} label="Acordos quebrados" tone="danger" value={b ? formatNumber(b.count) : "—"} hint={b ? `Automáticos: ${b.automatic} · manuais: ${b.count - b.automatic}` : undefined} />
        <KpiTile loading={!b} label="Taxa de quebra" verdict tone={toneFor(b?.breakRate ?? null, 15, 35)} value={pctS(b?.breakRate)}
          hint={b ? `Quebrados ÷ (quebrados + ${plural(b.completed, "concluído", "concluídos")})` : undefined}
          help="Dos acordos que terminaram no período (quebrados ou concluídos), a percentagem que foi quebrada." />
        <KpiTile loading={!b} label="Valor em falta" tone="warning" value={b ? moneyShort(b.missing, cur) : "—"} hint={b ? `De ${moneyShort(b.agreed, cur)} acordados · pago ${moneyShort(b.paid, cur)}` : undefined} />
        <KpiTile loading={!b} label="Renegociados" tone="brand" value={b ? formatNumber(b.renegotiated) : "—"} hint={b && b.count ? `${pctS((b.renegotiated / b.count) * 100)} dos quebrados` : undefined} />
      </div>
      {b && b.byAgent.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Por agente" description="Quem tem mais acordos quebrados (e quanto ficou por receber)" />
          <div className="mt-4"><HBars data={b.byAgent.map((a) => ({ label: `${a.agentName} · ${plural(a.count, "acordo", "acordos")}`, value: a.missing }))} format={(v) => money(v, cur)} colors={["bg-danger-500", "bg-danger-400", "bg-warning-500"]} /></div>
        </Card>
      )}
      <div className="mt-4">
        <DataTable columns={cols} rows={pageRows} meta={meta} loading={loading} onPage={setPage} onRefresh={reload}
          empty={{ title: "Nenhum acordo quebrado no período", description: "Bom sinal. Experimente um período maior.", icon: <Handshake /> }} />
      </div>
    </>
  );
}

/* ═══════════════════════════ Disputas e contestações ═══════════════════════════ */
type DisputeRow = DisputesReport["rows"][number];
const OUTCOME_LABEL: Record<string, string> = { UPHELD: "Procedente (volta à cobrança)", CANCELLED: "Factura anulada", ADJUSTED: "Valor corrigido" };

export function DisputesTab() {
  const [f, setF] = useState<FiltersState>(initialFilters());
  const [status, setStatus] = useState<"" | "OPEN" | "RESOLVED">("");
  const params = { ...filtersToParams(f, { agent: false }), status: status || undefined };
  const { data: d, loading, error, reload } = useQuery(() => reportService.disputes(params), [JSON.stringify(params)]);
  const cur = d?.currency.code ?? "AOA";
  const { pageRows, meta, setPage } = useClientPage(d?.rows, 20);

  const cols: Column<DisputeRow>[] = [
    { key: "ref", header: "Factura", cell: (x) => <span className="font-mono text-xs">{x.reference}</span> },
    { key: "deb", header: "Devedor", cell: (x) => <div><p className="max-w-[200px] truncate font-medium">{x.debtorName}</p><p className="text-xs text-muted">{x.organizationName}</p></div> },
    { key: "val", header: "Valor", align: "right", cell: (x) => <span className="tabular">{money(x.originalAmount, cur)}</span> },
    { key: "why", header: "Motivo", cell: (x) => <span className="line-clamp-2 max-w-[260px] text-[13px]" title={x.reason}>{x.reason}</span> },
    { key: "open", header: "Aberta", cell: (x) => <div className="text-[13px]"><p className="tabular">{dateS(x.openedAt.slice(0, 10))}</p><p className="text-xs text-muted">{x.openedByName ?? "—"}</p></div> },
    {
      key: "st", header: "Estado", cell: (x) => x.status === "OPEN" ? <Badge tone="warning" dot>Em aberto</Badge> : (
        <div><Badge tone={x.outcome === "CANCELLED" ? "danger" : "success"} dot>{x.outcome === "ADJUSTED" ? `Corrigido p/ ${moneyShort(x.adjustedAmount, cur)}` : OUTCOME_LABEL[x.outcome ?? ""]}</Badge>
          <p className="mt-1 text-xs text-muted">{dateS(x.resolvedAt?.slice(0, 10))} · {x.resolvedByName ?? "—"}</p></div>
      ),
    },
    { key: "days", header: "Dias", align: "right", cell: (x) => <span className={cn("tabular", x.status === "OPEN" && x.days > 30 && "font-medium text-danger-600")}>{x.days}</span> },
  ];

  return (
    <>
      <FilterBar value={f} onChange={setF} agent={false} actions={<PdfButton report="disputes" params={params} />}>
        <Select value={status} onChange={(e) => setStatus(e.target.value as "" | "OPEN" | "RESOLVED")} className="h-8 w-40" aria-label="Estado">
          <option value="">Todos os estados</option><option value="OPEN">Em aberto</option><option value="RESOLVED">Resolvidas</option>
        </Select>
      </FilterBar>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile loading={!d} label="Abertas no período" tone="brand" value={d ? formatNumber(d.opened) : "—"} />
        <KpiTile loading={!d} label="Em aberto agora" tone="warning" value={d ? formatNumber(d.openNow) : "—"}
          hint={d ? `${moneyShort(d.openAmount, cur)} fora da cobrança${d.oldestOpenDays !== null ? ` · mais antiga: ${d.oldestOpenDays} dias` : ""}` : undefined} />
        <KpiTile loading={!d} label="Resolvidas no período" tone="success" value={d ? formatNumber(d.resolvedInPeriod) : "—"}
          hint={d?.avgResolutionDays !== null && d ? `Tempo médio de resolução: ${String(d.avgResolutionDays).replace(".", ",")} dias` : undefined} />
        <KpiTile loading={!d} label="Valor anulado ou reduzido" tone="danger" value={d ? moneyShort(d.cancelledAmount + d.adjustedReduction, cur) : "—"}
          hint={d ? `Anulado ${moneyShort(d.cancelledAmount, cur)} · reduzido ${moneyShort(d.adjustedReduction, cur)}` : undefined} />
      </div>
      {d && (
        <Card className="mt-4">
          <CardHeader title="Decisões" description="Disputas resolvidas por tipo de decisão" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {d.outcomes.map((o) => (
              <div key={o.key} className="rounded-xl border p-3.5">
                <p className="text-[13px] text-muted">{OUTCOME_LABEL[o.key]}</p>
                <p className="tabular mt-1 text-xl font-semibold">{formatNumber(o.count)}</p>
                <p className="tabular text-xs text-muted">{money(o.amount, cur)} em valor original</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="mt-4">
        <DataTable columns={cols} rows={pageRows} meta={meta} loading={loading} onPage={setPage} onRefresh={reload}
          empty={{ title: "Sem disputas", description: "Nenhuma disputa aberta ou resolvida no período.", icon: <Scale /> }} />
      </div>
      <Explain>Inclui as disputas abertas ou resolvidas no período e todas as que continuam abertas, mesmo que tenham começado antes. "Dias" conta desde a abertura até à resolução (ou até hoje, se ainda estiver aberta).</Explain>
    </>
  );
}

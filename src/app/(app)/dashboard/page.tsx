"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Banknote, CircleDollarSign, FileWarning, FolderKanban, Handshake, Hourglass, Target, Wallet } from "lucide-react";
import { displayName, useAuth } from "@/components/shared/auth-provider";
import { Avatar, Card, CardHeader, EmptyState, PageHeader, Progress, Skeleton, StatCard } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Input, SegmentedControl } from "@/components/ui/form";
import { AreaChart } from "@/components/charts/charts";
import { InvoiceStatusBadge } from "@/components/shared/status";
import { ErrorBanner } from "@/components/shared/process-list";
import { useQuery } from "@/hooks/use-query";
import { dashboardService, invoiceService, negotiationService, paymentService } from "@/lib/api/services";
import { formatDate, formatMoney, formatNumber, pct, todayIso } from "@/lib/utils";

type Range = "month" | "3m" | "12m" | "custom";
const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n, 1); return d.toISOString().slice(0, 10); };
const monthLabel = (ym: string) => new Intl.DateTimeFormat("pt-PT", { month: "short", year: "2-digit" }).format(new Date(`${ym}-01T00:00:00`));

export default function DashboardPage() {
  const { user, isManager } = useAuth();
  const [range, setRange] = useState<Range>("month");
  const [custom, setCustom] = useState({ from: monthsAgo(0), to: todayIso() });
  const period = useMemo(() => {
    if (range === "custom") return custom;
    if (range === "3m") return { from: monthsAgo(2), to: todayIso() };
    if (range === "12m") return { from: monthsAgo(11), to: todayIso() };
    return { from: monthsAgo(0), to: todayIso() };
  }, [range, custom]);

  const key = JSON.stringify(period);
  const { data: s, error, reload } = useQuery(() => dashboardService.summary(period), [key]);
  const { data: agents } = useQuery(() => dashboardService.byAgent(period), [key]);
  const { data: creditors } = useQuery(() => dashboardService.byCreditor(period), [key]);
  const { data: overdue } = useQuery(() => invoiceService.overdue({ perPage: 6, sort: "dueDate:asc" }));
  const { data: approvals } = useQuery(() => negotiationService.list({ status: "PENDING_APPROVAL", perPage: 5 }));
  const { data: pendingPayments } = useQuery(() => paymentService.pending({ perPage: 5 }));

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 19 ? "Boa tarde" : "Boa noite";
  const cur = s?.currency ?? "AOA";
  const recoveredShare = s && Number(s.placed) > 0 ? Number(s.recovered) / Number(s.placed) : 0;

  return (
    <>
      <PageHeader
        title={`${greet}, ${displayName(user).split(" ")[0]}`}
        description={s ? `Período ${formatDate(s.period.from)} – ${formatDate(s.period.to)} · ${s.scope === "ALL" ? "toda a operação" : s.scope === "TEAM" ? "a sua equipa" : "a sua carteira"}` : "Resumo da operação de cobrança"}
        actions={<>
          <SegmentedControl value={range} onChange={setRange} options={[{ value: "month", label: "Este mês" }, { value: "3m", label: "3 meses" }, { value: "12m", label: "12 meses" }, { value: "custom", label: "Período" }]} />
          {range === "custom" && <>
            <Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="h-8 w-38" />
            <Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="h-8 w-38" />
          </>}
        </>}
      />
      {error && <ErrorBanner message={error} onRetry={reload} />}

      {s && s.successRate !== null && Number(s.successRate) < 20 && (
        <div role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-warning-500/25 bg-warning-50/70 px-3 py-1.5 text-xs text-warning-700 dark:bg-warning-500/10">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate" title="A taxa de sucesso do período está abaixo de 20%. Reveja a régua de cobrança e os processos sem contacto recente.">
            Taxa de sucesso abaixo de 20%. Reveja a régua de cobrança e os processos sem contacto recente.
          </span>
          <Link href="/collection-ladders" className="shrink-0 font-medium underline-offset-2 hover:underline">Régua de cobrança</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {s ? <>
          <StatCard label="Em cobrança agora" value={formatMoney(s.inCollection, cur, true)} icon={<Wallet />} href="/processes"
            footer={<span className="text-muted">{formatNumber(s.openProcesses)} processos abertos</span>} />
          <StatCard label="Posto em cobrança no período" value={formatMoney(s.placed, cur, true)} icon={<FolderKanban />} tone="info"
            footer={<span className="text-muted">{formatNumber(s.placedProcesses)} processos novos</span>} />
          <StatCard label="Recuperado (confirmado)" value={formatMoney(s.recovered, cur, true)} icon={<Banknote />} tone="success" href="/payments"
            footer={<span className="text-muted">{formatNumber(s.recoveredPayments)} pagamentos</span>} />
          <StatCard label="Taxa de sucesso" value={pct(s.successRate)} icon={<Target />} tone="warning"
            footer={<Progress value={recoveredShare} tone="success" className="w-full" />} />
        </> : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[132px] rounded-2xl" />)}
      </div>

      {s && Number(s.pendingConfirmation) > 0 && (
        <Link href="/payments?tab=pending" className="mt-4 flex items-center gap-3 rounded-2xl border border-warning-500/30 bg-warning-50 px-5 py-3.5 text-sm text-warning-700 transition hover:shadow-card dark:bg-warning-500/10">
          <Hourglass className="h-4 w-4 shrink-0" />
          <span className="flex-1"><b className="tabular">{formatMoney(s.pendingConfirmation, cur)}</b> em pagamentos registados aguardam confirmação do comprovativo.</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Posto em cobrança vs. recuperado" description={`Valores mensais (${cur})`} />
          <div className="mt-4 flex gap-5 text-xs">
            <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full bg-brand-500" /> Posto em cobrança</span>
            <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full bg-success-500" /> Recuperado</span>
          </div>
          <div className="mt-2">
            {!s ? <Skeleton className="h-[260px]" /> : s.monthly.length < 2 ? (
              <EmptyState title="Poucos dados no período" description="Escolha um período com pelo menos dois meses para ver a evolução." />
            ) : (
              <AreaChart data={s.monthly.map((m) => ({ label: monthLabel(m.month), placed: Number(m.placed), recovered: Number(m.recovered) }))}
                series={[{ key: "placed", label: "Posto em cobrança", color: "var(--color-brand-500)" }, { key: "recovered", label: "Recuperado", color: "var(--color-success-500)" }]}
                format={(v) => formatMoney(v, cur, true)} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="A precisar de si" description="Decisões pendentes" />
          <div className="mt-4 space-y-3">
            <Link href="/negotiations?status=PENDING_APPROVAL" className="flex items-center gap-3 rounded-xl border p-3 hover:bg-subtle">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-50 text-warning-600 dark:bg-warning-500/15"><Handshake className="h-4 w-4" /></span>
              <span className="flex-1 text-sm"><b className="tabular">{approvals?.meta.total ?? "…"}</b> acordo(s) aguardam aprovação</span>
              <ArrowRight className="h-4 w-4 text-muted" />
            </Link>
            <Link href="/payments?tab=pending" className="flex items-center gap-3 rounded-xl border p-3 hover:bg-subtle">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15"><CircleDollarSign className="h-4 w-4" /></span>
              <span className="flex-1 text-sm"><b className="tabular">{pendingPayments?.meta.total ?? "…"}</b> pagamento(s) para confirmar</span>
              <ArrowRight className="h-4 w-4 text-muted" />
            </Link>
            <Link href="/invoices?state=OVERDUE" className="flex items-center gap-3 rounded-xl border p-3 hover:bg-subtle">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger-50 text-danger-600 dark:bg-danger-500/15"><FileWarning className="h-4 w-4" /></span>
              <span className="flex-1 text-sm"><b className="tabular">{overdue?.meta.total ?? "…"}</b> factura(s) vencida(s)</span>
              <ArrowRight className="h-4 w-4 text-muted" />
            </Link>
            {!isManager && <p className="text-xs text-muted">Algumas decisões só podem ser tomadas por gestores.</p>}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardHeader title="Desempenho por agente" description="Recuperado ÷ posto em cobrança no período"
              action={<Link href="/agents" className="flex items-center gap-1 text-[13px] font-medium text-brand-600">Equipa <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          </div>
          <FactsTable rows={(agents?.data ?? []).map((a) => ({ key: String(a.agentId ?? "none"), name: a.agentName ?? "Sem responsável", ...a }))} currency={cur} loading={!agents} />
        </Card>
        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardHeader title="Por credor" description="Carteira e recuperação por organização"
              action={<Link href="/creditor-accounts" className="flex items-center gap-1 text-[13px] font-medium text-brand-600">Conta-corrente <ArrowRight className="h-3.5 w-3.5" /></Link>} />
          </div>
          <FactsTable rows={(creditors?.data ?? []).map((c) => ({ key: String(c.organizationId), name: c.organizationName, ...c }))} currency={cur} loading={!creditors} />
        </Card>
      </div>

      <Card padded={false} className="mt-4">
        <div className="p-5 pb-3">
          <CardHeader title="Facturas vencidas mais antigas" description="Prioridade de contacto"
            action={<Link href="/invoices?state=OVERDUE" className="flex items-center gap-1 text-[13px] font-medium text-brand-600">Ver todas <ArrowRight className="h-3.5 w-3.5" /></Link>} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-y bg-subtle text-xs text-muted">
              <th className="px-5 py-2 text-left font-medium">Devedor</th><th className="px-5 py-2 text-left font-medium">Factura</th>
              <th className="px-5 py-2 text-right font-medium">Valor</th><th className="px-5 py-2 text-right font-medium">Atraso</th><th className="px-5 py-2 text-left font-medium">Estado</th>
            </tr></thead>
            <tbody>
              {overdue?.data.map((i) => (
                <tr key={i.id} className="border-b last:border-0 hover:bg-subtle">
                  <td className="px-5 py-3"><Link href={`/debtors/${i.debtorId}`} className="flex items-center gap-3"><Avatar name={i.debtor?.name ?? "?"} size="sm" /><span className="max-w-[220px] truncate font-medium">{i.debtor?.name}</span></Link></td>
                  <td className="px-5 py-3 font-mono text-xs text-muted">{i.referenceNumber}</td>
                  <td className="tabular px-5 py-3 text-right font-medium">{formatMoney(i.amount, i.currency?.code)}</td>
                  <td className="tabular px-5 py-3 text-right text-danger-600">{i.overdueDays ?? 0} dias</td>
                  <td className="px-5 py-3"><InvoiceStatusBadge code={i.invoiceState?.code} name={i.invoiceState?.name} /></td>
                </tr>
              )) ?? <tr><td colSpan={5} className="px-5 py-3"><Skeleton className="h-24" /></td></tr>}
              {overdue?.data.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-muted">Sem facturas vencidas.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function FactsTable({ rows, currency, loading }: { rows: { key: string; name: string; inCollection: string; placed: string; recovered: string; successRate: string | null; openProcesses: number }[]; currency: string; loading: boolean }) {
  if (loading) return <div className="p-5"><Skeleton className="h-40" /></div>;
  if (!rows.length) return <EmptyState title="Sem dados no período" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-y bg-subtle text-xs text-muted">
          <th className="px-5 py-2 text-left font-medium">Nome</th><th className="px-5 py-2 text-right font-medium">Em cobrança</th>
          <th className="px-5 py-2 text-right font-medium">Recuperado</th><th className="px-5 py-2 text-left font-medium">Taxa</th>
        </tr></thead>
        <tbody>
          {rows.slice(0, 8).map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <td className="px-5 py-2.5"><div className="flex items-center gap-2.5"><Avatar name={r.name} size="xs" /><span className="max-w-[180px] truncate font-medium">{r.name}</span></div></td>
              <td className="tabular px-5 py-2.5 text-right text-muted">{formatMoney(r.inCollection, currency, true)}</td>
              <td className="tabular px-5 py-2.5 text-right font-medium">{formatMoney(r.recovered, currency, true)}</td>
              <td className="px-5 py-2.5">
                <div className="flex w-28 items-center gap-2"><Progress value={r.successRate ? Number(r.successRate) / 100 : 0} tone="success" /><span className="tabular text-xs">{pct(r.successRate, 0)}</span></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

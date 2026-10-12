"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Clock } from "lucide-react";
import { Avatar, Card, CardHeader, PageHeader, Progress, StatCard, Tabs } from "@/components/ui/display";
import { Input, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { LadderTaskBadge } from "@/components/shared/status";
import { ladderActionMeta } from "@/components/shared/ladders";
import { ErrorBanner, ProcessDrawer } from "@/components/shared/process-list";
import { useAuth } from "@/components/shared/auth-provider";
import { useListState, useQuery } from "@/hooks/use-query";
import { ladderService, processService, userService } from "@/lib/api/services";
import type { LadderTask, LadderTaskStatus, Process } from "@/types/models";
import { cn, formatDate, formatNumber, pct } from "@/lib/utils";

type Row = Omit<LadderTask, "id"> & { id: number; uuid: string };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

export default function LadderTasksPage() {
  const { isManager } = useAuth();
  const list = useListState();
  const [status, setStatus] = useState<"all" | LadderTaskStatus>("PENDING");
  const [agentId, setAgentId] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState("");
  const [proc, setProc] = useState<Process | null>(null);
  useEffect(() => list.setPage(1), [status, agentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: agents } = useQuery(() => (isManager ? userService.dropdown() : Promise.resolve([])).catch(() => []), [isManager]);
  const tasks = useQuery(() => ladderService.tasks({ page: list.page, perPage: list.perPage, status: status === "all" ? undefined : status, agentId: agentId ? Number(agentId) : undefined }), [list.page, status, agentId]);
  const comp = useQuery(() => ladderService.compliance({ from: from || undefined, to: to || undefined, agentId: agentId ? Number(agentId) : undefined }), [from, to, agentId]);

  const rows = comp.data?.data ?? [];
  const tot = rows.reduce((a, r) => ({ tracked: a.tracked + r.tracked, on: a.on + r.fulfilledOnTime, late: a.late + r.fulfilledLate, overdue: a.overdue + r.overdue, pending: a.pending + r.pending }), { tracked: 0, on: 0, late: 0, overdue: 0, pending: 0 });
  const rate = tot.tracked ? tot.on / Math.max(1, tot.tracked - tot.pending) : 0;

  const cols: Column<Row>[] = [
    { key: "due", header: "Prazo", cell: (t) => <span className={cn("tabular", t.status === "OVERDUE" && "font-medium text-danger-600")}>{formatDate(t.dueOn)}</span> },
    {
      key: "task", header: "Tarefa", cell: (t) => {
        const m = ladderActionMeta[t.actionType];
        return <div className="flex items-center gap-2.5"><span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", m.cls)}><m.icon className="h-3.5 w-3.5" /></span><div><p className="font-medium">{t.title}</p><p className="text-xs text-muted">Dia {t.processDay} do processo</p></div></div>;
      },
    },
    { key: "debtor", header: "Devedor / processo", cell: (t) => <div><p className="max-w-[200px] truncate">{t.debtorName}</p><p className="font-mono text-[11px] text-muted">PRC-{String(t.processId).padStart(5, "0")}</p></div> },
    { key: "agent", header: "Agente", cell: (t) => t.agentName ? <span className="flex items-center gap-2"><Avatar name={t.agentName} size="xs" />{t.agentName}</span> : <span className="text-muted">—</span>, hideOnMobile: true },
    { key: "status", header: "Estado", cell: (t) => <div><LadderTaskBadge value={t.status} />{t.fulfilledAt && <p className="mt-0.5 text-[11px] text-muted">cumprida {formatDate(t.fulfilledAt)}{t.fulfilledLate && " (fora de prazo)"}</p>}</div> },
  ];

  return (
    <>
      <Link href="/ladders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--text)]"><ArrowLeft className="h-4 w-4" /> Régua de cobrança</Link>
      <PageHeader title="Tarefas e cumprimento" description="Passos da régua com prazo: cumprem-se registando um contacto no processo dentro do prazo." />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {isManager && (
          <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="h-8 w-52">
            <option value="">Toda a equipa</option>
            {(agents ?? []).map((a) => <option key={a.id} value={a.id}>{a.fullName ?? a.email}</option>)}
          </Select>
        )}
        <span className="ml-2 text-muted">Período do relatório:</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40" />
        <span className="text-muted">–</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-40" />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Taxa de cumprimento no prazo" value={pct(rate * 100)} icon={<CheckCircle2 />} tone="success" footer={<Progress value={rate} tone={rate > 0.8 ? "success" : rate > 0.5 ? "warning" : "danger"} />} />
        <StatCard label="Cumpridas fora de prazo" value={formatNumber(tot.late)} icon={<Clock />} tone="warning" />
        <StatCard label="Em atraso" value={formatNumber(tot.overdue)} icon={<AlertTriangle />} tone="danger" />
        <StatCard label="Pendentes" value={formatNumber(tot.pending)} icon={<ClipboardList />} tone="brand" />
      </div>

      {isManager && rows.length > 0 && (
        <Card padded={false} className="mb-6">
          <div className="p-5 pb-3"><CardHeader title="Cumprimento por agente" description={comp.data ? `${formatDate(comp.data.period.from)} – ${formatDate(comp.data.period.to)}` : undefined} /></div>
          <table className="w-full text-sm">
            <thead><tr className="border-y bg-subtle text-xs text-muted">
              {["Agente", "Tarefas", "No prazo", "Fora de prazo", "Em atraso", "Pendentes", "Taxa"].map((h, i) => <th key={h} className={cn("px-5 py-2 font-medium", i ? "text-right" : "text-left")}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.agentId ?? 0} className="border-b last:border-0">
                  <td className="px-5 py-2.5"><span className="flex items-center gap-2"><Avatar name={r.agentName ?? "?"} size="xs" />{r.agentName ?? "Sem agente"}</span></td>
                  <td className="tabular px-5 py-2.5 text-right">{r.tracked}</td>
                  <td className="tabular px-5 py-2.5 text-right text-success-600">{r.fulfilledOnTime}</td>
                  <td className="tabular px-5 py-2.5 text-right text-warning-600">{r.fulfilledLate}</td>
                  <td className="tabular px-5 py-2.5 text-right text-danger-600">{r.overdue}</td>
                  <td className="tabular px-5 py-2.5 text-right text-muted">{r.pending}</td>
                  <td className="tabular px-5 py-2.5 text-right font-semibold">{r.complianceRate ? pct(r.complianceRate) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mb-4"><Tabs value={status} onChange={setStatus} items={[{ value: "PENDING", label: "Pendentes" }, { value: "OVERDUE", label: "Em atraso" }, { value: "FULFILLED", label: "Cumpridas" }, { value: "VOID", label: "Sem efeito" }, { value: "all", label: "Todas" }]} /></div>
      {tasks.error && <ErrorBanner message={tasks.error} onRetry={tasks.reload} />}
      <DataTable columns={cols} rows={(tasks.data?.data ?? []).map((t, i) => ({ ...t, uuid: t.id, id: i + 1 }))} meta={tasks.data?.meta} loading={tasks.loading} onRefresh={tasks.reload} onPage={list.setPage}
        onRowClick={async (t) => { const r = await processService.list({ search: t.debtorName, perPage: 50, open: undefined }).catch(() => null); setProc(r?.data.find((p) => p.id === t.processId) ?? null); }}
        empty={{ title: status === "OVERDUE" ? "Nenhuma tarefa em atraso" : "Sem tarefas", description: "As tarefas surgem quando uma régua activa atinge um passo com prazo.", icon: <ClipboardList /> }} />
      <ProcessDrawer process={proc} initialTab="contacts" onClose={() => setProc(null)} onChanged={tasks.reload} />
    </>
  );
}

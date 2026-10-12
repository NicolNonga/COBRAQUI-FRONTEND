"use client";
import { useEffect, useState } from "react";
import { Activity, AlertOctagon, CheckCircle2, Clock, Inbox, Lock, RefreshCw, RotateCcw, Zap } from "lucide-react";
import { Badge, Card, CardHeader, DescriptionList, PageHeader, StatCard, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { OutboxStatusBadge } from "@/components/shared/status";
import { ErrorBanner } from "@/components/shared/process-list";
import { useListState, useQuery } from "@/hooks/use-query";
import { outboxService, type CircuitSnapshot } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { OutboxMessage, OutboxStatus } from "@/types/models";
import { cn, formatNumber, timeAgo } from "@/lib/utils";

type Row = Omit<OutboxMessage, "id"> & { id: number; uuid: string };
const typeLabel = (t: string) => ({ email: "Email", notification: "Notificação", "agent.added": "Novo agente" } as Record<string, string>)[t] ?? t;
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso)) : "—");

export default function OutboxPage() {
  const toast = useToast();
  const list = useListState({ perPage: 20 });
  const [status, setStatus] = useState<"all" | OutboxStatus>("DEAD");
  const [type, setType] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { list.setPage(1); setSelected([]); }, [status, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const msgs = useQuery(() => outboxService.list({ status: status === "all" ? undefined : status, type: type || undefined, page: list.page, perPage: list.perPage }), [status, type, list.page]);
  const stats = useQuery(() => outboxService.stats());
  const circuits = useQuery(() => outboxService.circuits().catch(() => null));
  const refresh = () => { msgs.reload(); stats.reload(); circuits.reload(); };
  useEffect(() => { const t = setInterval(refresh, 15000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows: Row[] = (msgs.data?.data ?? []).map((m, i) => ({ ...m, uuid: m.id, id: i + 1 }));
  const s = stats.data ?? {};
  const circuitList: CircuitSnapshot[] = Array.isArray(circuits.data) ? circuits.data
    : circuits.data ? Object.entries(circuits.data).map(([name, v]) => ({ name, ...(typeof v === "object" && v ? v : { state: String(v) }) } as CircuitSnapshot)) : [];
  const types = [...new Set(rows.map((r) => r.type))];

  const confirm = useConfirm();
  async function retry(ids: string[]) {
    const ok = await confirm({ title: `Reenviar ${ids.length} mensagem(ns)?`, tone: "primary", confirmLabel: "Reenviar",
      description: "As mensagens voltam à fila e são entregues de novo (emails, SMS e notificações). Confirme que a causa da falha já foi resolvida, para não falharem outra vez." }).catch(() => false);
    if (!ok) return;
    setBusy(true);
    try { const r = await outboxService.retry(ids); toast("success", r.message, `${r.count} mensagem(ns) reenfileirada(s).`); setSelected([]); refresh(); }
    catch (e) { toast("error", "Não foi possível reenviar", errorMessage(e)); } finally { setBusy(false); }
  }

  const cols: Column<Row>[] = [
    { key: "type", header: "Tipo", cell: (m) => <span className="flex items-center gap-2 font-medium">{typeLabel(m.type)}{m.encrypted && <Lock className="h-3 w-3 text-muted" aria-label="Conteúdo cifrado" />}</span> },
    { key: "status", header: "Estado", cell: (m) => <OutboxStatusBadge value={m.status} /> },
    { key: "attempts", header: "Tentativas", cell: (m) => <span className={cn("tabular", m.attempts >= m.maxAttempts && "font-semibold text-danger-600")}>{m.attempts}/{m.maxAttempts}</span> },
    { key: "err", header: "Último erro", cell: (m) => <span className="block max-w-[320px] truncate font-mono text-xs text-danger-600" title={m.lastError ?? ""}>{m.lastError ?? <span className="text-muted">—</span>}</span> },
    { key: "created", header: "Criada", cell: (m) => <span className="text-muted" title={when(m.createdAt)}>{timeAgo(m.createdAt)}</span> },
    { key: "next", header: "Próxima tentativa", cell: (m) => <span className="text-muted">{m.status === "PENDING" ? when(m.availableAt) : m.processedAt ? `enviada ${timeAgo(m.processedAt)}` : "—"}</span>, hideOnMobile: true },
  ];

  return (
    <>
      <PageHeader title="Fila de envios (outbox)" description="Emails e notificações enviados em segundo plano, com tentativas automáticas. Actualiza a cada 15 segundos."
        breadcrumbs={[{ label: "Administração" }, { label: "Outbox" }]}
        actions={<>
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={refresh}>Actualizar</Button>
          {status === "DEAD" && rows.length > 0 && <Button icon={<RotateCcw className="h-4 w-4" />} loading={busy} onClick={() => retry(rows.map((r) => r.uuid))}>Reenviar todas desta página</Button>}
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pendentes" value={formatNumber(s.PENDING ?? 0)} icon={<Clock />} tone="neutral" />
        <StatCard label="A processar" value={formatNumber(s.PROCESSING ?? 0)} icon={<Activity />} tone="brand" />
        <StatCard label="Enviadas" value={formatNumber(s.SENT ?? 0)} icon={<CheckCircle2 />} tone="success" />
        <StatCard label="Falhadas (DEAD)" value={formatNumber(s.DEAD ?? 0)} icon={<AlertOctagon />} tone="danger" />
      </div>

      {circuitList.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Circuit breakers" description="Quando um serviço externo (ex: SMTP) falha repetidamente, o circuito abre e os envios aguardam." />
          <div className="mt-4 flex flex-wrap gap-3">
            {circuitList.map((c) => (
              <div key={c.name} className="flex items-center gap-3 rounded-xl border px-4 py-2.5">
                <Zap className={cn("h-4 w-4", c.state === "CLOSED" ? "text-success-500" : c.state === "OPEN" ? "text-danger-500" : "text-warning-500")} />
                <span className="text-sm font-medium">{c.name}</span>
                <Badge tone={c.state === "CLOSED" ? "success" : c.state === "OPEN" ? "danger" : "warning"} dot>{c.state === "CLOSED" ? "Normal" : c.state === "OPEN" ? "Aberto" : "A testar"}</Badge>
                {c.failures !== undefined && <span className="text-xs text-muted">{c.failures} falhas</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-4"><Tabs value={status} onChange={setStatus} items={[
        { value: "DEAD", label: "Falhadas", count: s.DEAD }, { value: "PENDING", label: "Pendentes", count: s.PENDING },
        { value: "PROCESSING", label: "A processar", count: s.PROCESSING }, { value: "SENT", label: "Enviadas", count: s.SENT }, { value: "all", label: "Todas" },
      ]} /></div>
      {msgs.error && <ErrorBanner message={msgs.error} onRetry={msgs.reload} />}
      <DataTable columns={cols} rows={rows} meta={msgs.data?.meta} loading={msgs.loading} onRefresh={msgs.reload} onPage={list.setPage} onRowClick={setOpen}
        selectable={status === "DEAD"} selected={selected} onSelectedChange={setSelected}
        bulkActions={<Button size="sm" icon={<RotateCcw className="h-4 w-4" />} loading={busy} onClick={() => retry(rows.filter((r) => selected.includes(r.id)).map((r) => r.uuid))}>Reenviar seleccionadas</Button>}
        toolbar={<Select value={type} onChange={(e) => setType(e.target.value)} className="w-48"><option value="">Todos os tipos</option>{types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}</Select>}
        empty={{ title: status === "DEAD" ? "Nenhuma mensagem falhada" : "Sem mensagens", description: status === "DEAD" ? "Todos os envios estão a funcionar." : undefined, icon: <Inbox /> }} />

      <Drawer open={!!open} onClose={() => setOpen(null)} title={open ? typeLabel(open.type) : ""} description={open && <OutboxStatusBadge value={open.status} />}
        footer={open && open.status === "DEAD" && <Button icon={<RotateCcw className="h-4 w-4" />} loading={busy} onClick={() => { retry([open.uuid]); setOpen(null); }}>Reenviar</Button>}>
        {open && (
          <div className="space-y-5">
            <DescriptionList items={[
              { label: "ID", value: <span className="font-mono text-xs">{open.uuid}</span> }, { label: "Tipo", value: open.type },
              { label: "Tentativas", value: `${open.attempts} de ${open.maxAttempts}` }, { label: "Conteúdo", value: open.encrypted ? "Cifrado em repouso" : "Simples" },
              { label: "Criada", value: when(open.createdAt) }, { label: "Disponível a partir de", value: when(open.availableAt) },
              { label: "Processada", value: when(open.processedAt) }, { label: "ID do pedido", value: <span className="font-mono text-xs">{open.requestId ?? "—"}</span> },
            ]} />
            {open.lastError && <div><p className="mb-1 text-xs font-medium text-muted">Último erro</p><pre className="overflow-x-auto rounded-xl bg-danger-50 p-3 font-mono text-xs whitespace-pre-wrap text-danger-700 dark:bg-danger-500/10">{open.lastError}</pre></div>}
          </div>
        )}
      </Drawer>
    </>
  );
}

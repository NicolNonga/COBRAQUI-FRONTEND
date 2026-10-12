"use client";
import { useEffect, useState } from "react";
import { Activity, Banknote, Download, Eye, FilterX, History, LogIn, Users } from "lucide-react";
import { Avatar, Badge, PageHeader, StatCard } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Input, SearchInput, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { ActionBadge, AuditDetailDrawer, actionLabel, actionOptions, changeCount, changeSummary, entityLabel, entityOptions, fullDateTime, isSensitive } from "@/components/shared/audit";
import { ErrorBanner } from "@/components/shared/process-list";
import { useListState, useQuery } from "@/hooks/use-query";
import { auditService, userService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { AuditLog } from "@/types/models";
import { downloadFile, formatDate, formatNumber, toCsv } from "@/lib/utils";

const emptyFilters = { actorId: "", entity: "", action: "", from: "", to: "" };

export default function AuditPage() {
  const toast = useToast();
  const list = useListState({ perPage: 20 });
  const [f, setF] = useState(emptyFilters);
  const [open, setOpen] = useState<Row | null>(null);
  const { data: users } = useQuery(() => userService.dropdown().catch(() => []));
  const { data: stats } = useQuery(() => auditService.stats());

  useEffect(() => list.setPage(1), [f]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = {
    page: list.page, perPage: list.perPage, search: list.debounced || undefined, actorId: f.actorId ? Number(f.actorId) : undefined,
    entity: f.entity || undefined, action: f.action || undefined, from: f.from || undefined, to: f.to || undefined,
  };
  const { data, loading, error, reload } = useQuery(() => auditService.list(query), [JSON.stringify(query)]);
  const activeFilters = Object.values(f).filter(Boolean).length + (list.search ? 1 : 0);

  async function exportCsv() {
    try {
      const rows: AuditLog[] = [];
      for (let page = 1; page <= 50; page++) {
        const r = await auditService.list({ ...query, page, perPage: 100 });
        rows.push(...r.data);
        if (page >= r.meta.lastPage) break;
      }
      downloadFile(`auditoria_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows.map((l) => ({
        Data: fullDateTime(l.createdAt), Utilizador: l.actorName ?? "Sistema", Email: l.actorEmail ?? "", Perfil: l.actorRole ?? "",
        Accao: actionLabel(l.action), Entidade: entityLabel(l.entity), Registo: l.entityLabel ?? l.entityId ?? "", IP: l.ip ?? "",
        Dados: l.payload ? JSON.stringify(l.payload) : "", Pedido: l.requestId ?? "",
      }))));
      toast("success", "Exportação concluída", `${rows.length} eventos exportados.`);
    } catch (e) { toast("error", "Falha na exportação", errorMessage(e)); }
  }

  const cols: Column<Row>[] = [
    {
      key: "date", header: "Data e hora", cell: (l) => (
        <div title={fullDateTime(l.createdAt)}>
          <p className="tabular font-medium">{formatDate(l.createdAt, { day: "2-digit", month: "short", year: "numeric" })}</p>
          <p className="tabular text-xs text-muted">{new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(l.createdAt))}</p>
        </div>
      ),
    },
    {
      key: "user", header: "Utilizador", cell: (l) => l.actorName ? (
        <div className="flex items-center gap-2.5">
          <Avatar name={l.actorName} size="sm" />
          <div className="min-w-0"><p className="max-w-[170px] truncate font-medium">{l.actorName}</p><p className="text-xs text-muted">{l.actorRole ?? l.actorEmail}</p></div>
        </div>
      ) : <span className="text-muted">Sistema</span>,
    },
    { key: "action", header: "Acção", cell: (l) => <ActionBadge action={l.action} /> },
    { key: "entity", header: "Registo", cell: (l) => <span>{entityLabel(l.entity)}{l.entityLabel ? <span className="text-muted"> · {l.entityLabel}</span> : l.entityId && <span className="text-xs text-muted"> n.º {l.entityId}</span>}</span> },
    {
      key: "data", header: "Dados", cell: (l) => {
        const n = changeCount({ ...l, id: l._key });
        return n ? (
          <button onClick={(e) => { e.stopPropagation(); setOpen(l); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30">
            <Eye className="h-3.5 w-3.5" />{changeSummary({ ...l, id: l._key })}
          </button>
        ) : <span className="text-xs text-muted">—</span>;
      },
    },
    { key: "lvl", header: "Nível", cell: (l) => isSensitive(l.action) ? <Badge tone="danger" dot>Sensível</Badge> : <span className="text-xs text-muted">Normal</span> },
    { key: "ip", header: "IP", cell: (l) => <span className="font-mono text-xs text-muted">{l.ip ?? "—"}</span>, hideOnMobile: true },
    { key: "view", header: "", align: "right", cell: (l) => <Button variant="ghost" size="icon-sm" title="Ver detalhe" aria-label="Ver detalhe" onClick={(e) => { e.stopPropagation(); setOpen(l); }}><Eye className="h-4 w-4" /></Button> },
  ];
  // DataTable precisa de id numérico: usamos o índice da página como chave
  const rows: Row[] = (data?.data ?? []).map((l, i) => ({ ...l, _key: l.id, id: i + 1 + (list.page - 1) * list.perPage }));

  return (
    <>
      <PageHeader title="Auditoria" description="Registo imutável de todas as acções: quem fez, o quê, quando e de onde."
        breadcrumbs={[{ label: "Administração" }, { label: "Auditoria" }]}
        actions={<Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>Exportar CSV</Button>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Eventos (24h)" value={formatNumber(stats?.events ?? 0)} icon={<Activity />} />
        <StatCard label="Eventos financeiros (24h)" value={formatNumber(stats?.financial ?? 0)} icon={<Banknote />} tone="success" />
        <StatCard label="Sessões iniciadas (24h)" value={formatNumber(stats?.logins ?? 0)} icon={<LogIn />} tone="info" />
        <StatCard label="Utilizadores activos (24h)" value={formatNumber(stats?.users ?? 0)} icon={<Users />} tone="neutral" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={f.actorId} onChange={(e) => setF({ ...f, actorId: e.target.value })} className="w-48">
          <option value="">Todos os utilizadores</option>
          {(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.fullName ?? u.email}</option>)}
        </Select>
        <Select value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value })} className="w-44">
          <option value="">Todos os registos</option>
          {entityOptions(stats?.entities ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} className="w-56">
          <option value="">Todas as acções</option>
          {actionOptions(stats?.actions ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="w-40" aria-label="Desde" />
          <span className="text-sm text-muted">–</span>
          <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="w-40" aria-label="Até" />
        </div>
        {activeFilters > 0 && <Button variant="ghost" icon={<FilterX className="h-4 w-4" />} onClick={() => { setF(emptyFilters); list.setSearch(""); }}>Limpar ({activeFilters})</Button>}
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      <DataTable columns={cols} rows={rows} meta={data?.meta} loading={loading} onRefresh={reload} onPage={list.setPage} onRowClick={(r) => setOpen(r)}
        toolbar={<>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Pesquisar acção, registo, utilizador ou IP…" className="sm:w-96" />
          <span className="tabular text-[13px] text-muted">{formatNumber(data?.meta.total ?? 0)} eventos</span>
        </>}
        empty={{ title: "Nenhum evento encontrado", description: "Ajuste os filtros ou o período.", icon: <History /> }} />

      <AuditDetailDrawer log={open ? { ...open, id: open._key } : null} onClose={() => setOpen(null)} />
    </>
  );
}

type Row = Omit<AuditLog, "id"> & { id: number; _key: string };

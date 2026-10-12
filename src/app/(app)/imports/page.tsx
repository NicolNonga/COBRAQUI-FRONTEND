"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle, Building2, CheckCircle2, Download, Eye, FileSpreadsheet, FileText, FileUp, FilterX, Layers, Search, Users, XCircle,
} from "lucide-react";
import { Avatar, Badge, EmptyState, PageHeader, Skeleton, StatCard, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Input, SearchInput, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { ErrorBanner } from "@/components/shared/process-list";
import { useListState, useQuery } from "@/hooks/use-query";
import { importHistoryService, userService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { ImportBatch, ImportBatchDetail, ImportKind, ImportStatus } from "@/types/models";

/* ───────── rótulos ───────── */
const KIND_META: Record<ImportKind, { label: string; icon: typeof FileText; unit: string }> = {
  ORGANIZATIONS: { label: "Credores", icon: Building2, unit: "linhas" },
  DEBTORS: { label: "Devedores", icon: Users, unit: "linhas" },
  INVOICES: { label: "Facturas", icon: FileSpreadsheet, unit: "linhas" },
  INVOICE_PDFS: { label: "PDFs de facturas", icon: FileText, unit: "ficheiros" },
};
const STATUS_META: Record<ImportStatus, { label: string; tone: "success" | "warning" | "danger"; icon: typeof CheckCircle2 }> = {
  SUCCESS: { label: "Concluída", tone: "success", icon: CheckCircle2 },
  PARTIAL: { label: "Com erros", tone: "warning", icon: AlertTriangle },
  FAILED: { label: "Falhou", tone: "danger", icon: XCircle },
};
const formatSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 ** 2).toFixed(1).replace(".", ",")} MB`);
const dateTime = (iso: string) => new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const emptyFilters = { status: "", userId: "", from: "", to: "" };

export default function ImportsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><ImportsView /></Suspense>;
}

function ImportsView() {
  const router = useRouter();
  const params = useSearchParams();
  const list = useListState({ perPage: 20 });
  const [kind, setKind] = useState<ImportKind | "ALL">("ALL");
  const [f, setF] = useState(emptyFilters);
  const openId = params.get("id") ? Number(params.get("id")) : null;
  const setOpenId = (id: number | null) => router.replace(id ? `/imports?id=${id}` : "/imports", { scroll: false });

  const { data: users } = useQuery(() => userService.dropdown().catch(() => []));
  const { data: stats, reload: reloadStats } = useQuery(() => importHistoryService.stats());
  useEffect(() => list.setPage(1), [kind, f]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = {
    page: list.page, perPage: list.perPage, search: list.debounced || undefined,
    kind: kind === "ALL" ? undefined : kind, status: (f.status || undefined) as ImportStatus | undefined,
    userId: f.userId ? Number(f.userId) : undefined, from: f.from || undefined, to: f.to || undefined,
  };
  const { data, loading, error, reload } = useQuery(() => importHistoryService.list(query), [JSON.stringify(query)]);
  const activeFilters = Object.values(f).filter(Boolean).length + (list.search ? 1 : 0);

  const cols: Column<ImportBatch>[] = [
    {
      key: "file", header: "Ficheiro", cell: (b) => {
        const Icon = KIND_META[b.kind].icon;
        return (
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-soft text-muted"><Icon className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="max-w-[260px] truncate font-medium" title={b.fileName}>{b.fileName}</p>
              <p className="text-xs text-muted">{KIND_META[b.kind].label}{b.fileSize ? ` · ${formatSize(b.fileSize)}` : ""}</p>
            </div>
          </div>
        );
      },
    },
    { key: "status", header: "Resultado", cell: (b) => <StatusBadge status={b.status} /> },
    {
      key: "rows", header: "Importadas", cell: (b) => b.total ? (
        <div className="w-36">
          <p className="tabular text-sm"><span className="font-medium">{formatNumber(b.imported)}</span><span className="text-muted"> de {formatNumber(b.total)}</span></p>
          <ResultBar imported={b.imported} total={b.total} />
        </div>
      ) : <span className="text-xs text-muted">—</span>,
    },
    {
      key: "errors", header: "Erros", cell: (b) => b.failed
        ? <span className="tabular font-medium text-danger-600">{formatNumber(b.failed)}</span>
        : b.status === "FAILED" ? <span className="text-xs text-danger-600">Ficheiro rejeitado</span> : <span className="text-xs text-muted">0</span>,
    },
    {
      key: "user", header: "Importado por", hideOnMobile: true, cell: (b) => b.createdByName ? (
        <div className="flex items-center gap-2"><Avatar name={b.createdByName} size="xs" /><span className="max-w-[150px] truncate">{b.createdByName}</span></div>
      ) : <span className="text-muted">—</span>,
    },
    { key: "date", header: "Data", cell: (b) => <span className="tabular whitespace-nowrap text-sm">{dateTime(b.createdAt)}</span> },
    {
      key: "view", header: "", align: "right", cell: (b) => (
        <Button variant="ghost" size="icon-sm" title="Ver detalhe" aria-label="Ver detalhe" onClick={(e) => { e.stopPropagation(); setOpenId(b.id); }}><Eye className="h-4 w-4" /></Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Importações" description="Todos os ficheiros importados de credores, devedores e facturas: o resultado, o ficheiro original e os erros de cada linha."
        breadcrumbs={[{ label: "Administração" }, { label: "Importações" }]} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Importações (30 dias)" value={formatNumber(stats?.batches ?? 0)} icon={<FileUp />} />
        <StatCard label="Linhas importadas" value={formatNumber(stats?.imported ?? 0)} icon={<CheckCircle2 />} tone="success" />
        <StatCard label="Linhas com erro" value={formatNumber(stats?.failed ?? 0)} icon={<AlertTriangle />} tone="danger" />
        <StatCard label="Importações por corrigir" value={formatNumber(stats?.withErrors ?? 0)} icon={<Layers />} tone="neutral" />
      </div>

      <div className="mb-4">
        <Tabs<ImportKind | "ALL"> value={kind} onChange={setKind} items={[
          { value: "ALL", label: "Todas" },
          ...(Object.keys(KIND_META) as ImportKind[]).map((k) => ({ value: k, label: KIND_META[k].label })),
        ]} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="w-44">
          <option value="">Todos os resultados</option>
          {(Object.keys(STATUS_META) as ImportStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </Select>
        <Select value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })} className="w-48">
          <option value="">Todos os utilizadores</option>
          {(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.fullName ?? u.email}</option>)}
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className="w-40" aria-label="Desde" />
          <span className="text-sm text-muted">–</span>
          <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className="w-40" aria-label="Até" />
        </div>
        {activeFilters > 0 && <Button variant="ghost" icon={<FilterX className="h-4 w-4" />} onClick={() => { setF(emptyFilters); list.setSearch(""); }}>Limpar ({activeFilters})</Button>}
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      <DataTable columns={cols} rows={data?.data} meta={data?.meta} loading={loading} onRefresh={() => { reload(); reloadStats(); }} onPage={list.setPage}
        onRowClick={(b) => setOpenId(b.id)}
        toolbar={<>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Pesquisar ficheiro ou utilizador…" className="sm:w-80" />
          <span className="tabular text-[13px] text-muted">{formatNumber(data?.meta.total ?? 0)} importações</span>
        </>}
        empty={{ title: "Nenhuma importação encontrada", description: "Os ficheiros importados em Credores, Devedores e Facturas aparecem aqui.", icon: <FileUp /> }} />

      <ImportDetailDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function StatusBadge({ status }: { status: ImportStatus }) {
  const m = STATUS_META[status];
  return <Badge tone={m.tone} dot>{m.label}</Badge>;
}

function ResultBar({ imported, total }: { imported: number; total: number }) {
  const ok = total ? (imported / total) * 100 : 0;
  return (
    <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-danger-100 dark:bg-danger-500/20" title={`${imported} importadas, ${total - imported} com erro`}>
      <div className="h-full bg-success-500" style={{ width: `${ok}%` }} />
    </div>
  );
}

/* ───────── Detalhe ───────── */
type DetailTab = "errors" | "file";

function ImportDetailDrawer({ id, onClose }: { id: number | null; onClose: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<DetailTab>("errors");
  const { data: b, loading, error } = useQuery(() => (id ? importHistoryService.get(id) : Promise.resolve(null)), [id]);
  useEffect(() => setTab("errors"), [id]);
  const isSheet = b && b.kind !== "INVOICE_PDFS";

  const download = (fn: () => Promise<void>) => fn().catch((e) => toast("error", "Não foi possível descarregar", errorMessage(e)));

  return (
    <Drawer open={id !== null} onClose={onClose} width="max-w-5xl"
      title={b ? <span className="flex items-center gap-2"><span className="truncate">{b.fileName}</span></span> : "Importação"}
      description={b ? `${KIND_META[b.kind].label} · importado por ${b.createdByName ?? "—"} em ${dateTime(b.createdAt)}` : undefined}
      footer={b && <>
        {b.hasFile && <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => download(() => importHistoryService.downloadFile(b.id, b.fileName))}>Ficheiro original</Button>}
        {b.hasErrorReport && <Button icon={<Download className="h-4 w-4" />} onClick={() => download(() => importHistoryService.downloadErrorReport(b.id, b.fileName))}>Ficheiro com erros assinalados</Button>}
        {!b.hasFile && !b.hasErrorReport && <Button variant="secondary" onClick={onClose}>Fechar</Button>}
      </>}>
      {loading && !b ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>
        : error ? <EmptyState title="Não foi possível abrir a importação" description={error} />
        : b ? (
          <div className="space-y-5">
            <Summary b={b} />
            {b.message && (
              <div className="flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700 dark:bg-danger-500/10 dark:text-danger-300">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{b.message}</p>
              </div>
            )}
            <Tabs<DetailTab> value={tab} onChange={setTab} items={[
              { value: "errors", label: "Erros encontrados", count: b.errors.length },
              ...(isSheet && b.hasFile ? [{ value: "file" as const, label: "Ver ficheiro" }] : []),
            ]} />
            {tab === "errors" ? <ErrorsPanel b={b} onShowFile={isSheet && b.hasFile ? () => setTab("file") : undefined} /> : <SheetPanel id={b.id} />}
          </div>
        ) : null}
    </Drawer>
  );
}

function Summary({ b }: { b: ImportBatchDetail }) {
  const unit = KIND_META[b.kind].unit;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl bg-subtle p-3"><p className="text-xs text-muted">Resultado</p><div className="mt-1"><StatusBadge status={b.status} /></div></div>
      <div className="rounded-xl bg-subtle p-3"><p className="text-xs text-muted">Total de {unit}</p><p className="tabular text-xl font-semibold">{formatNumber(b.total)}</p></div>
      <div className="rounded-xl bg-success-50 p-3 dark:bg-success-500/10"><p className="text-xs text-muted">Importadas</p><p className="tabular text-xl font-semibold text-success-700 dark:text-success-300">{formatNumber(b.imported)}</p></div>
      <div className="rounded-xl bg-danger-50 p-3 dark:bg-danger-500/10"><p className="text-xs text-muted">Com erro</p><p className="tabular text-xl font-semibold text-danger-700 dark:text-danger-300">{formatNumber(b.failed)}</p></div>
    </div>
  );
}

/** Erros agrupados por motivo (o que corrigir primeiro) + lista linha a linha. */
function ErrorsPanel({ b, onShowFile }: { b: ImportBatchDetail; onShowFile?: () => void }) {
  const [search, setSearch] = useState("");
  const grouped = useMemo(() => {
    const m = new Map<string, number>();
    b.errors.forEach((e) => e.errors.forEach((msg) => m.set(msg, (m.get(msg) ?? 0) + 1)));
    return [...m.entries()].sort((a, z) => z[1] - a[1]);
  }, [b.errors]);
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return s ? b.errors.filter((e) => String(e.rowNumber) === s || (e.label ?? "").toLowerCase().includes(s) || e.errors.some((m) => m.toLowerCase().includes(s))) : b.errors;
  }, [b.errors, search]);

  if (!b.errors.length) {
    return b.status === "FAILED"
      ? <EmptyState icon={<XCircle />} title="Nenhuma linha foi processada" description="O ficheiro foi rejeitado antes de ler as linhas. Veja a mensagem acima." />
      : <EmptyState icon={<CheckCircle2 />} title="Sem erros" description="Todas as linhas do ficheiro foram importadas." />;
  }
  const lineLabel = b.kind === "INVOICE_PDFS" ? "Ficheiro" : "Linha";

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Motivos mais frequentes</h3>
        <ul className="divide-y rounded-xl border">
          {grouped.slice(0, 6).map(([msg, n]) => (
            <li key={msg} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" />
              <span className="flex-1">{msg}</span>
              <button className="tabular shrink-0 rounded-full bg-soft px-2 py-0.5 text-xs text-muted hover:text-[var(--text)]" onClick={() => setSearch(msg)} title="Filtrar por este motivo">
                {formatNumber(n)} {n === 1 ? "linha" : "linhas"}
              </button>
            </li>
          ))}
        </ul>
        {grouped.length > 6 && <p className="mt-1.5 text-xs text-muted">+ {grouped.length - 6} outros motivos</p>}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{b.kind === "INVOICE_PDFS" ? "Ficheiros não associados" : "Linhas com erro"}</h3>
          <div className="flex items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder={b.kind === "INVOICE_PDFS" ? "Nome do ficheiro ou motivo…" : "N.º da linha ou motivo…"} className="w-64" />
            {onShowFile && <Button variant="secondary" size="sm" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={onShowFile}>Ver no ficheiro</Button>}
          </div>
        </div>
        <div className="scroll-thin max-h-[420px] overflow-y-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-subtle text-left text-xs text-muted">
              <tr><th className="w-28 px-4 py-2 font-medium">{lineLabel}</th><th className="px-4 py-2 font-medium">O que corrigir</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((e) => (
                <tr key={`${e.rowNumber}-${e.label ?? ""}`} className="align-top">
                  <td className="tabular px-4 py-2.5 font-medium">{e.label ?? e.rowNumber}</td>
                  <td className="px-4 py-2.5">
                    <ul className="space-y-0.5">{e.errors.map((m, i) => <li key={i} className="text-danger-700 dark:text-danger-300">{m}</li>)}</ul>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={2} className="px-4 py-6 text-center text-muted"><Search className="mx-auto mb-1 h-4 w-4" />Nenhuma linha corresponde à pesquisa.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** O ficheiro original, como foi enviado, com as linhas com erro a vermelho e o motivo ao lado. */
function SheetPanel({ id }: { id: number }) {
  const { data, loading, error } = useQuery(() => importHistoryService.preview(id), [id]);
  const [onlyErrors, setOnlyErrors] = useState<"all" | "errors">("all");
  if (loading) return <Skeleton className="h-80" />;
  if (error || !data) return <EmptyState title="Não foi possível abrir o ficheiro" description={error ?? undefined} />;
  const errCount = Object.keys(data.errorsByRow).length;
  const rows = onlyErrors === "errors" ? data.rows.filter((r) => data.errorsByRow[r.rowNumber]) : data.rows;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Folha <span className="font-medium text-[var(--text)]">{data.sheetName}</span> · {formatNumber(data.totalRows)} linhas
          {data.truncated && ` (a mostrar as primeiras ${formatNumber(data.rows.length)} — descarregue o ficheiro para ver tudo)`}
        </p>
        <div className="inline-flex rounded-lg border p-0.5 text-sm">
          {(["all", "errors"] as const).map((v) => (
            <button key={v} onClick={() => setOnlyErrors(v)}
              className={cn("rounded-md px-3 py-1", onlyErrors === v ? "bg-soft font-medium" : "text-muted hover:text-[var(--text)]")}>
              {v === "all" ? "Todas as linhas" : `Só com erro (${errCount})`}
            </button>
          ))}
        </div>
      </div>
      <div className="scroll-thin max-h-[520px] overflow-auto rounded-xl border">
        <table className="w-max min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-subtle text-left text-xs text-muted">
            <tr>
              <th className="sticky left-0 bg-subtle px-3 py-2 font-medium">#</th>
              {data.headers.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">{h || `Coluna ${i + 1}`}</th>)}
              <th className="whitespace-nowrap px-3 py-2 font-medium text-danger-600">Erros</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const errs = data.errorsByRow[r.rowNumber];
              return (
                <tr key={r.rowNumber} className={cn(errs && "bg-danger-50/70 dark:bg-danger-500/10")}>
                  <td className={cn("tabular sticky left-0 px-3 py-2 text-xs text-muted", errs ? "bg-danger-50 dark:bg-[#2a1416]" : "surface")}>{r.rowNumber}</td>
                  {r.cells.map((c, i) => <td key={i} className="max-w-[240px] truncate whitespace-nowrap px-3 py-2" title={c}>{c}</td>)}
                  <td className="min-w-[280px] px-3 py-2 text-danger-700 dark:text-danger-300">{errs ? errs.join(" · ") : ""}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={data.headers.length + 2} className="px-4 py-6 text-center text-muted">Sem linhas para mostrar.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

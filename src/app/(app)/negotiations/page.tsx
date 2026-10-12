"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Handshake, Plus } from "lucide-react";
import { Avatar, PageHeader, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Input, SearchInput, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { NegotiationStatusBadge, negotiationStatusMeta } from "@/components/shared/status";
import { ErrorBanner } from "@/components/shared/process-list";
import { useListState, useQuery } from "@/hooks/use-query";
import { ExportPdfButton } from "@/components/shared/export-pdf-button";
import { negotiationService } from "@/lib/api/services";
import type { NegotiationListItem, NegotiationStatus } from "@/types/models";
import { formatDate, formatMoney, pct } from "@/lib/utils";

type S = "all" | NegotiationStatus;
const TABS: S[] = ["all", "PENDING_APPROVAL", "ACTIVE", "BROKEN", "COMPLETED", "RENEGOTIATED", "REJECTED", "CANCELLED"];

export default function NegotiationsPage() {
  const router = useRouter();
  const list = useListState();
  const [status, setStatus] = useState<S>("all");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => list.setPage(1), [status, kind, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = {
    page: list.page, perPage: list.perPage, search: list.debounced || undefined, status: status === "all" ? undefined : status,
    isInstallment: kind === "" ? undefined : kind === "installments", effectiveFrom: from || undefined, effectiveTo: to || undefined,
  };
  const { data, loading, error, reload } = useQuery(() => negotiationService.list(query), [JSON.stringify(query)]);
  const { data: counts } = useQuery(async () => {
    const e = await Promise.all(TABS.filter((t) => t !== "all").map(async (s) => [s, (await negotiationService.list({ status: s, perPage: 1 })).meta.total] as const));
    return Object.fromEntries(e) as Record<string, number>;
  });

  const columns: Column<NegotiationListItem>[] = [
    { key: "id", header: "Acordo", cell: (n) => <span className="font-mono text-xs font-medium">ACD-{String(n.id).padStart(5, "0")}</span> },
    { key: "debtor", header: "Devedor", cell: (n) => <div className="flex items-center gap-2.5"><Avatar name={n.debtor?.name ?? "?"} size="xs" /><div className="min-w-0"><p className="max-w-[220px] truncate font-medium">{n.debtor?.name ?? "—"}</p><p className="font-mono text-[11px] text-muted">{n.debtor?.nif}</p></div></div> },
    { key: "debt", header: "Dívida", align: "right", cell: (n) => <span className="tabular text-muted">{formatMoney(n.debtAmount)}</span>, hideOnMobile: true },
    { key: "disc", header: "Desconto", align: "right", cell: (n) => Number(n.discountRate) ? <span className="tabular text-success-600">−{pct(n.discountRate)}</span> : <span className="text-muted">—</span> },
    { key: "final", header: "Valor acordado", align: "right", cell: (n) => <span className="tabular font-semibold">{formatMoney(n.finalAmount)}</span> },
    { key: "inst", header: "Modalidade", cell: (n) => <span className="text-muted">{n.isInstallment ? `${n.totalInstallments}x` : "Único"}</span> },
    { key: "period", header: "Vigência", cell: (n) => <span className="text-muted">{formatDate(n.startDate, { day: "2-digit", month: "short" })} – {formatDate(n.endDate, { day: "2-digit", month: "short", year: "2-digit" })}</span>, hideOnMobile: true },
    { key: "proc", header: "Processos", align: "right", cell: (n) => <span className="tabular text-muted">{n.processesCount}</span>, hideOnMobile: true },
    { key: "status", header: "Estado", cell: (n) => <NegotiationStatusBadge status={n.status} /> },
  ];

  return (
    <>
      <PageHeader title="Negociações" description="Acordos de pagamento celebrados com os devedores."
        actions={<>
          <ExportPdfButton path="negotiations/export/pdf" name="negociacoes" params={query} disabled={!data?.data.length} />
          <Link href="/negotiations/new"><Button icon={<Plus className="h-4 w-4" />}>Nova negociação</Button></Link>
        </>} />
      <div className="mb-4">
        <Tabs value={status} onChange={setStatus} items={TABS.map((t) => ({ value: t, label: t === "all" ? "Todos" : negotiationStatusMeta[t].label, count: t === "all" ? undefined : counts?.[t] }))} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 w-44">
          <option value="">Único e em prestações</option><option value="single">Pagamento único</option><option value="installments">Em prestações</option>
        </Select>
        <span className="ml-2 text-muted">Data efectiva:</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40" />
        <span className="text-muted">–</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-40" />
      </div>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <DataTable columns={columns} rows={data?.data} meta={data?.meta} loading={loading} onRefresh={reload} onPage={list.setPage} onRowClick={(n) => router.push(`/negotiations/${n.id}`)}
        toolbar={<SearchInput value={list.search} onChange={list.setSearch} placeholder="Pesquisar devedor ou NIF…" />}
        empty={{ title: "Sem negociações", description: "Crie um acordo a partir de um processo ou devedor.", icon: <Handshake />, action: <Link href="/negotiations/new"><Button size="sm">Nova negociação</Button></Link> }} />
    </>
  );
}

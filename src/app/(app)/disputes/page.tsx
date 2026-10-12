"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Gavel, Scale } from "lucide-react";
import { Avatar, DescriptionList, PageHeader, StatCard, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput, Textarea } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { DisputeOutcomeBadge, DisputeStatusBadge, disputeOutcomeMeta } from "@/components/shared/status";
import { ErrorBanner } from "@/components/shared/process-list";
import { useAuth } from "@/components/shared/auth-provider";
import { useListState, useQuery } from "@/hooks/use-query";
import { disputeService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { Dispute, DisputeOutcome } from "@/types/models";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";

type Row = Omit<Dispute, "id"> & { id: number; uuid: string };

export default function DisputesPage() {
  const list = useListState();
  const [status, setStatus] = useState<"OPEN" | "RESOLVED" | "all">("OPEN");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => list.setPage(1), [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, error, reload } = useQuery(() => disputeService.list({ page: list.page, perPage: list.perPage, search: list.debounced || undefined, status: status === "all" ? undefined : status }), [list.page, list.debounced, status]);
  const { data: openCount, reload: reloadCount } = useQuery(() => disputeService.list({ status: "OPEN", perPage: 1 }));
  const refresh = () => { reload(); reloadCount(); };

  const cols: Column<Row>[] = [
    { key: "inv", header: "Factura", cell: (d) => <span className="font-mono text-xs font-medium">{d.invoiceReference}</span> },
    { key: "debtor", header: "Devedor", cell: (d) => <div className="flex items-center gap-2"><Avatar name={d.debtorName} size="xs" /><span className="max-w-[200px] truncate">{d.debtorName}</span></div> },
    { key: "org", header: "Credor", cell: (d) => <span className="text-muted">{d.organizationName}</span>, hideOnMobile: true },
    { key: "amount", header: "Valor", align: "right", cell: (d) => <span className="tabular font-medium">{formatMoney(d.originalAmount)}</span> },
    { key: "reason", header: "Motivo", cell: (d) => <span className="block max-w-[260px] truncate text-muted" title={d.reason}>{d.reason}</span> },
    { key: "days", header: "Aberta há", cell: (d) => d.status === "OPEN" ? <span className={cn("tabular", d.daysOpen > 15 ? "font-medium text-danger-600" : "text-muted")}>{d.daysOpen} dias</span> : <span className="text-muted">—</span> },
    { key: "status", header: "Estado", cell: (d) => d.status === "RESOLVED" && d.outcome ? <DisputeOutcomeBadge value={d.outcome} /> : <DisputeStatusBadge value={d.status} /> },
  ];

  return (
    <>
      <PageHeader title="Disputas de facturas" description="Facturas contestadas pelos devedores: ficam suspensas da cobrança até haver decisão."
        actions={<Link href="/invoices"><Button variant="secondary" icon={<Scale className="h-4 w-4" />}>Abrir disputa numa factura</Button></Link>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Disputas em aberto" value={formatNumber(openCount?.meta.total ?? 0)} icon={<Scale />} tone="warning" />
        <StatCard label="Mais antiga (nesta página)" value={status === "OPEN" && data?.data.length ? `${Math.max(...data.data.map((d) => d.daysOpen))} dias` : "—"} icon={<Clock />} tone="danger" />
        <StatCard label="Nesta vista" value={formatNumber(data?.meta.total ?? 0)} icon={<Gavel />} tone="neutral" />
      </div>
      <div className="mb-4"><Tabs value={status} onChange={setStatus} items={[{ value: "OPEN", label: "Em aberto", count: openCount?.meta.total }, { value: "RESOLVED", label: "Resolvidas" }, { value: "all", label: "Todas" }]} /></div>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <DataTable columns={cols} rows={(data?.data ?? []).map((d, i) => ({ ...d, uuid: d.id, id: i + 1 }))} meta={data?.meta} loading={loading} onRefresh={reload} onPage={list.setPage} onRowClick={(d) => setOpen(d.uuid)}
        toolbar={<SearchInput value={list.search} onChange={list.setSearch} placeholder="Factura ou devedor…" />}
        empty={{ title: status === "OPEN" ? "Sem disputas em aberto" : "Sem disputas", icon: <Scale /> }} />
      <DisputeDrawer id={open} onClose={() => setOpen(null)} onChanged={refresh} />
    </>
  );
}

function DisputeDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { can, isManager } = useAuth();
  const { data: d, reload } = useQuery(() => (id ? disputeService.get(id) : Promise.resolve(null)), [id]);
  const [outcome, setOutcome] = useState<DisputeOutcome>("UPHELD");
  const [notes, setNotes] = useState("");
  const [adjusted, setAdjusted] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOutcome("UPHELD"); setNotes(""); setAdjusted(""); }, [id]);
  const canResolve = isManager || can("invoice_dispute_resolve_permission");
  const ok = notes.trim().length >= 5 && (outcome !== "ADJUSTED" || (Number(adjusted) > 0 && Number(adjusted) < Number(d?.originalAmount ?? 0)));

  return (
    <Drawer open={!!id} onClose={onClose} title={d ? `Disputa · ${d.invoiceReference}` : "Disputa"} description={d && (d.outcome ? <DisputeOutcomeBadge value={d.outcome} /> : <DisputeStatusBadge value={d.status} />)}
      footer={d?.status === "OPEN" && canResolve && <Button disabled={!ok} loading={busy} icon={<Gavel className="h-4 w-4" />} onClick={async () => {
        setBusy(true);
        try {
          let msg = "";
          const effect = outcome === "ADJUSTED"
            ? <>O valor da factura passa a <b>{formatMoney(Number(adjusted).toFixed(2))}</b> e volta à cobrança.</>
            : outcome === "CANCELLED" ? <>A factura é <b>anulada</b> e sai da dívida do devedor.</> : <>A factura é devida e <b>volta à cobrança</b> pelo valor original.</>;
          const ok = await confirm({
            title: "Registar esta decisão?", tone: "primary", confirmLabel: "Registar decisão",
            description: <>{effect} A decisão fica registada na auditoria e não pode ser alterada depois.</>,
            onConfirm: async () => { msg = (await disputeService.resolve(d.id, { outcome, notes: notes.trim(), adjustedAmount: outcome === "ADJUSTED" ? Number(adjusted).toFixed(2) : undefined })).message; },
          });
          if (ok) { toast("success", msg); reload(); onChanged(); }
        } catch (e) { toast("error", "Não foi possível resolver", errorMessage(e)); } finally { setBusy(false); }
      }}>Registar decisão</Button>}>
      {d && (
        <div className="space-y-6">
          <DescriptionList items={[
            { label: "Devedor", value: <Link href={`/debtors/${d.debtorId}`} className="text-brand-600 hover:underline">{d.debtorName}</Link> },
            { label: "Credor", value: d.organizationName },
            { label: "Valor da factura", value: formatMoney(d.originalAmount) },
            { label: "Vencimento", value: formatDate(d.invoiceDueDate) },
            { label: "Aberta em", value: `${formatDate(d.openedAt)} por ${d.openedByName ?? "—"}` },
            { label: "Resolvida em", value: d.resolvedAt ? formatDate(d.resolvedAt) : "—" },
          ]} />
          <div><p className="mb-1 text-xs font-medium text-muted">Motivo do devedor</p><p className="rounded-xl bg-subtle p-3 text-sm">{d.reason}</p></div>
          {d.status === "RESOLVED" ? (
            <div className="rounded-xl border p-4 text-sm">
              <p className="font-medium">{d.outcome && disputeOutcomeMeta[d.outcome].label}</p>
              {d.adjustedAmount && <p className="mt-1">Novo valor: <b>{formatMoney(d.adjustedAmount)}</b></p>}
              {d.resolutionNotes && <p className="mt-2 text-muted">{d.resolutionNotes}</p>}
            </div>
          ) : canResolve ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Decisão</h3>
              <div className="grid gap-2">
                {(Object.keys(disputeOutcomeMeta) as DisputeOutcome[]).map((o) => (
                  <button key={o} type="button" onClick={() => setOutcome(o)} className={cn("rounded-xl border p-3 text-left text-sm transition", outcome === o ? "border-brand-500 bg-brand-50/50 dark:bg-brand-500/10" : "hover:bg-subtle")}>
                    <p className="font-medium">{disputeOutcomeMeta[o].label}</p><p className="text-xs text-muted">{disputeOutcomeMeta[o].help}</p>
                  </button>
                ))}
              </div>
              {outcome === "ADJUSTED" && <Field label="Novo valor da factura" required><Input type="number" min="0" step="0.01" value={adjusted} onChange={(e) => setAdjusted(e.target.value)} trailing="Kz" className="tabular" /></Field>}
              <Field label="Fundamentação" required hint="Mínimo 5 caracteres; fica registada."><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            </div>
          ) : <p className="rounded-xl bg-subtle p-3 text-sm text-muted">Aguarda decisão de um gestor.</p>}
        </div>
      )}
    </Drawer>
  );
}

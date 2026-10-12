"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banknote, Clock, Download, Plus, Search } from "lucide-react";
import { Avatar, Badge, PageHeader, StatCard, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { PaymentStatusBadge, paymentStatusMeta } from "@/components/shared/status";
import { PaymentDrawer, RegisterPaymentModal, paymentCode, receiverLabel } from "@/components/shared/payments";
import { ErrorBanner } from "@/components/shared/process-list";
import { useListState, useQuery } from "@/hooks/use-query";
import { ExportPdfButton } from "@/components/shared/export-pdf-button";
import { negotiationService, paymentService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { NegotiationDetail, NegotiationListItem, Payment, PaymentStatus } from "@/types/models";
import { downloadFile, formatDate, formatMoney, formatNumber, sumMoney, toCsv } from "@/lib/utils";

type Row = Omit<Payment, "id"> & { id: number; uuid: string };
/** "queue" = fila do utilizador (nunca inclui os que ele próprio registou: regra dos quatro olhos) */
type TabKey = "queue" | "all" | PaymentStatus;

export default function PaymentsPage() {
  const params = useSearchParams();
  const toast = useToast();
  const list = useListState();
  const [tab, setTab] = useState<TabKey>("all");
  const [receiver, setReceiver] = useState("");
  const [methodId, setMethodId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [registerFor, setRegisterFor] = useState<NegotiationDetail | null>(null);

  useEffect(() => {
    const id = params.get("id"); if (id) setOpenId(id);
    const t = params.get("tab"); if (t) setTab(t === "pending" ? "queue" : (t as TabKey));
  }, [params]);
  useEffect(() => list.setPage(1), [tab, receiver, methodId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: methods } = useQuery(() => paymentService.methods(false).catch(() => []));
  const query = {
    page: list.page, perPage: list.perPage, search: list.debounced || undefined, receiver: (receiver || undefined) as Payment["receiver"] | undefined,
    paymentMethodId: methodId ? Number(methodId) : undefined, paidFrom: from || undefined, paidTo: to || undefined,
    status: tab === "queue" || tab === "all" ? undefined : tab,
  };
  const { data, loading, error, reload } = useQuery(() => (tab === "queue" ? paymentService.pending(query) : paymentService.list(query)), [tab, JSON.stringify(query)]);
  const { data: pendingTotal, reload: reloadPending } = useQuery(() => paymentService.pending({ perPage: 100 }));
  const refresh = () => { reload(); reloadPending(); };

  const rows: Row[] = (data?.data ?? []).map((p, i) => ({ ...p, uuid: p.id, id: i + 1 }));

  const columns: Column<Row>[] = [
    { key: "code", header: "Pagamento", cell: (p) => <span className="font-mono text-xs font-medium">{paymentCode(p.uuid)}</span> },
    { key: "date", header: "Data", cell: (p) => <span>{formatDate(p.paidOn)}</span> },
    { key: "neg", header: "Acordo", cell: (p) => <span className="font-mono text-xs text-muted">ACD-{String(p.negotiationId).padStart(5, "0")}</span> },
    { key: "recv", header: "Recebido por", cell: (p) => <Badge tone={p.receiver === "AGENCY" ? "brand" : "info"}>{receiverLabel[p.receiver]}</Badge> },
    { key: "method", header: "Meio", cell: (p) => <span className="text-muted">{p.paymentMethod?.name ?? "—"}</span>, hideOnMobile: true },
    { key: "ref", header: "Referência", cell: (p) => <span className="font-mono text-xs text-muted">{p.reference ?? "—"}</span>, hideOnMobile: true },
    { key: "by", header: "Registado por", cell: (p) => p.registeredBy ? <span className="flex items-center gap-2 text-muted"><Avatar name={p.registeredBy.fullName ?? "?"} size="xs" />{p.registeredBy.fullName}</span> : "—", hideOnMobile: true },
    { key: "amount", header: "Valor", align: "right", cell: (p) => <span className="tabular font-semibold">{formatMoney(p.amount, p.currency?.code)}</span> },
    { key: "status", header: "Estado", cell: (p) => <PaymentStatusBadge value={p.status} /> },
  ];

  return (
    <>
      <PageHeader title="Pagamentos" description="Pagamentos registados nos acordos, com comprovativo e confirmação."
        actions={<>
          {tab !== "queue" && <ExportPdfButton path="payments/export/pdf" name="pagamentos" params={query} disabled={!data?.data.length} />}
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!data?.data.length}
            onClick={() => data && downloadFile("pagamentos.csv", toCsv(data.data.map((p) => ({ Pagamento: paymentCode(p.id), Data: p.paidOn, Acordo: p.negotiationId, Recebido: receiverLabel[p.receiver], Meio: p.paymentMethod?.name ?? "", Referencia: p.reference ?? "", Valor: p.amount, Moeda: p.currency?.code ?? "", Estado: paymentStatusMeta[p.status].label }))))}>Exportar CSV</Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setPickOpen(true)}>Registar pagamento</Button>
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Para eu confirmar" value={formatNumber(pendingTotal?.meta.total ?? 0)} icon={<Clock />} tone="warning" />
        <StatCard label="Valor a confirmar por mim" value={formatMoney(sumMoney((pendingTotal?.data ?? []).map((p) => p.amountBase)))} icon={<Banknote />} tone="brand" />
        <StatCard label="Nesta vista" value={formatNumber(data?.meta.total ?? 0)} icon={<Search />} tone="neutral" />
      </div>

      <div className="mb-4">
        <Tabs value={tab} onChange={setTab} items={[
          { value: "all", label: "Todos" },
          { value: "PENDING", label: "Pendentes" },
          { value: "queue", label: "Para eu confirmar", count: pendingTotal?.meta.total },
          { value: "CONFIRMED", label: "Confirmados" },
          { value: "CANCELLED", label: "Anulados" },
          { value: "REVERSED", label: "Estornados" },
        ]} />
      </div>
      {tab === "queue" && (
        <p className="mb-4 rounded-xl border bg-subtle px-4 py-3 text-[13px] text-muted">
          Pagamentos pendentes que <b className="text-[var(--text)]">pode confirmar</b>. Os que registou não aparecem aqui: por segurança, quem regista um pagamento não o pode confirmar
          (regra dos quatro olhos). Veja-os em <button className="font-medium text-brand-600 hover:underline" onClick={() => setTab("PENDING")}>Pendentes</button>.
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Select value={receiver} onChange={(e) => setReceiver(e.target.value)} className="h-8 w-44"><option value="">Qualquer recebedor</option><option value="AGENCY">Agência</option><option value="CREDITOR">Credor (directo)</option></Select>
        <Select value={methodId} onChange={(e) => setMethodId(e.target.value)} className="h-8 w-48"><option value="">Todos os meios</option>{(methods ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
        <span className="ml-2 text-muted">Pago entre</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40" />
        <span className="text-muted">e</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-40" />
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      <DataTable columns={columns} rows={rows} meta={data?.meta} loading={loading} onRefresh={reload} onPage={list.setPage} onRowClick={(p) => setOpenId(p.uuid)}
        toolbar={<SearchInput value={list.search} onChange={list.setSearch} placeholder="Devedor ou referência…" />}
        empty={{ title: tab === "queue" ? "Nenhum pagamento para confirmar" : "Sem pagamentos", description: tab === "queue" ? "Não há pagamentos de outras pessoas à espera da sua confirmação." : "Ajuste os filtros.", icon: <Banknote /> }} />

      <PaymentDrawer id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />
      <PickNegotiationModal open={pickOpen} onClose={() => setPickOpen(false)} onPick={async (n) => {
        try { setRegisterFor(await negotiationService.get(n.id)); setPickOpen(false); } catch (e) { toast("error", errorMessage(e)); }
      }} />
      {registerFor && (
        <RegisterPaymentModal open onClose={() => setRegisterFor(null)} onDone={() => { if (tab === "queue") setTab("all"); refresh(); }} negotiationId={registerFor.id} installments={registerFor.installments}
          debtorName={registerFor.processes?.[0]?.process?.debtor?.name} />
      )}
    </>
  );
}

function PickNegotiationModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (n: NegotiationListItem) => void }) {
  const [q, setQ] = useState("");
  const { data, loading } = useQuery(() => (open ? negotiationService.list({ status: "ACTIVE", search: q || undefined, perPage: 10 }) : Promise.resolve(null)), [open, q]);
  return (
    <Modal open={open} onClose={onClose} title="Registar pagamento" description="Escolha o acordo em vigor a que o pagamento se destina." icon={<Banknote className="h-5 w-5" />}>
      <Field label="Pesquisar acordo"><SearchInput value={q} onChange={setQ} placeholder="Nome ou NIF do devedor" className="sm:w-full" /></Field>
      <ul className="mt-3 max-h-80 divide-y overflow-y-auto rounded-xl border">
        {loading && <li className="px-4 py-6 text-center text-sm text-muted">A carregar…</li>}
        {!loading && data?.data.map((n) => (
          <li key={n.id}>
            <button onClick={() => onPick(n)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-subtle">
              <div><p className="text-sm font-medium">{n.debtor?.name}</p><p className="font-mono text-xs text-muted">ACD-{String(n.id).padStart(5, "0")} · {n.isInstallment ? `${n.totalInstallments}x` : "único"}</p></div>
              <span className="tabular text-sm font-semibold">{formatMoney(n.finalAmount)}</span>
            </button>
          </li>
        ))}
        {!loading && !data?.data.length && <li className="px-4 py-6 text-center text-sm text-muted">Nenhum acordo em vigor encontrado.</li>}
      </ul>
    </Modal>
  );
}

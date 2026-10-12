"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Building2, CheckCircle2, FileDown, Landmark, Percent, Plus, Scale, XCircle } from "lucide-react";
import { Avatar, Badge, Card, PageHeader, StatCard, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, FileDrop, Input, SearchInput, SegmentedControl, Select, Textarea } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { SettlementStatusBadge } from "@/components/shared/status";
import { ErrorBanner } from "@/components/shared/process-list";
import { useAuth } from "@/components/shared/auth-provider";
import { useListState, useQuery } from "@/hooks/use-query";
import { creditorService, paymentService } from "@/lib/api/services";
import { errorMessage, newIdempotencyKey } from "@/lib/api/http";
import type { CreditorBalance, LedgerLine, PaymentMethod, Settlement, SettlementDirection } from "@/types/models";
import { cn, formatDate, formatMoney, pct, sumMoney, todayIso } from "@/lib/utils";

type BalRow = CreditorBalance & { id: number };
type SetRow = Omit<Settlement, "id"> & { id: number; uuid: string };
const dirLabel: Record<SettlementDirection, string> = { TO_CREDITOR: "Repasse ao credor", FROM_CREDITOR: "Cobrança ao credor" };
const kindLabel: Record<LedgerLine["kind"], string> = { COLLECTED: "Valor cobrado", COMMISSION: "Comissão da agência", SETTLEMENT: "Repasse / acerto" };

export default function CreditorsPage() {
  const { can, isManager } = useAuth();
  const canSettle = isManager || can("creditor_settlement_permission");
  const [tab, setTab] = useState<"balances" | "settlements">("balances");
  const list = useListState();
  const [open, setOpen] = useState<CreditorBalance | null>(null);
  const [newSettlement, setNewSettlement] = useState<CreditorBalance | null>(null);
  const [settlement, setSettlement] = useState<string | null>(null);
  const [sStatus, setSStatus] = useState("");
  const [sDir, setSDir] = useState("");

  const balances = useQuery(() => creditorService.balances({ page: list.page, perPage: list.perPage, search: list.debounced || undefined }), [list.page, list.debounced]);
  const settlements = useQuery(() => creditorService.settlements({ page: list.page, perPage: list.perPage, status: sStatus || undefined, direction: (sDir || undefined) as SettlementDirection | undefined }), [list.page, sStatus, sDir]);
  useEffect(() => list.setPage(1), [tab, sStatus, sDir]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => { balances.reload(); settlements.reload(); };

  const b = balances.data?.data ?? [];
  const totals = { pending: sumMoney(b.map((x) => x.pendingToCreditor)), commission: sumMoney(b.map((x) => x.commission)), collected: sumMoney(b.map((x) => x.collected)), owed: sumMoney(b.map((x) => x.pendingFromCreditor)) };

  const balCols: Column<BalRow>[] = [
    { key: "org", header: "Credor", cell: (r) => <div className="flex items-center gap-2.5"><Avatar name={r.organizationName} size="sm" /><span className="font-medium">{r.organizationName}</span></div> },
    { key: "rate", header: "Comissão", cell: (r) => <Badge>{pct(r.commissionRate)}</Badge> },
    { key: "col", header: "Cobrado", align: "right", cell: (r) => <span className="tabular">{formatMoney(r.collected)}</span>, hideOnMobile: true },
    { key: "com", header: "Comissão", align: "right", cell: (r) => <span className="tabular text-muted">{formatMoney(r.commission)}</span>, hideOnMobile: true },
    { key: "set", header: "Já repassado", align: "right", cell: (r) => <span className="tabular text-muted">{formatMoney(r.settled)}</span>, hideOnMobile: true },
    { key: "to", header: "A repassar", align: "right", cell: (r) => <span className={cn("tabular font-semibold", Number(r.pendingToCreditor) > 0 && "text-brand-700 dark:text-brand-300")}>{formatMoney(r.pendingToCreditor)}</span> },
    { key: "from", header: "A receber do credor", align: "right", cell: (r) => <span className={cn("tabular", Number(r.pendingFromCreditor) > 0 ? "font-semibold text-warning-700" : "text-muted")}>{formatMoney(r.pendingFromCreditor)}</span> },
    { key: "a", header: "", align: "right", cell: (r) => canSettle ? <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setNewSettlement(r); }}>Registar repasse</Button> : null },
  ];
  const setCols: Column<SetRow>[] = [
    { key: "date", header: "Data", cell: (s) => formatDate(s.settledOn) },
    { key: "org", header: "Credor", cell: (s) => <span className="font-medium">{s.organizationName ?? `#${s.organizationId}`}</span> },
    { key: "dir", header: "Tipo", cell: (s) => <span className="flex items-center gap-1.5 text-muted">{s.direction === "TO_CREDITOR" ? <ArrowUpRight className="h-4 w-4 text-brand-600" /> : <ArrowDownLeft className="h-4 w-4 text-warning-600" />}{dirLabel[s.direction]}</span> },
    { key: "method", header: "Meio", cell: (s) => <span className="text-muted">{s.paymentMethodName ?? "—"}</span>, hideOnMobile: true },
    { key: "ref", header: "Referência", cell: (s) => <span className="font-mono text-xs text-muted">{s.reference ?? "—"}</span>, hideOnMobile: true },
    { key: "amount", header: "Valor", align: "right", cell: (s) => <span className="tabular font-semibold">{formatMoney(s.amount)}</span> },
    { key: "status", header: "Estado", cell: (s) => <SettlementStatusBadge value={s.status} /> },
  ];

  return (
    <>
      <PageHeader title="Conta-corrente dos credores" description="Quanto foi cobrado por credor, a comissão da agência e o que falta repassar." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total cobrado" value={formatMoney(totals.collected, "AOA", true)} icon={<Landmark />} />
        <StatCard label="Comissões da agência" value={formatMoney(totals.commission, "AOA", true)} icon={<Percent />} tone="success" />
        <StatCard label="A repassar aos credores" value={formatMoney(totals.pending, "AOA", true)} icon={<ArrowUpRight />} tone="brand" />
        <StatCard label="A receber dos credores" value={formatMoney(totals.owed, "AOA", true)} icon={<ArrowDownLeft />} tone="warning" />
      </div>
      <div className="mb-4"><Tabs value={tab} onChange={setTab} items={[{ value: "balances", label: "Saldos por credor", count: balances.data?.meta.total }, { value: "settlements", label: "Repasses", count: settlements.data?.meta.total }]} /></div>

      {tab === "balances" ? <>
        {balances.error && <ErrorBanner message={balances.error} onRetry={balances.reload} />}
        <DataTable columns={balCols} rows={b.map((x) => ({ ...x, id: x.organizationId }))} meta={balances.data?.meta} loading={balances.loading} onRefresh={balances.reload} onPage={list.setPage} onRowClick={setOpen}
          toolbar={<SearchInput value={list.search} onChange={list.setSearch} placeholder="Pesquisar credor…" />}
          empty={{ title: "Sem movimentos", description: "Os saldos aparecem quando houver pagamentos confirmados.", icon: <Building2 /> }} />
      </> : <>
        {settlements.error && <ErrorBanner message={settlements.error} onRetry={settlements.reload} />}
        <DataTable columns={setCols} rows={(settlements.data?.data ?? []).map((s, i) => ({ ...s, uuid: s.id, id: i + 1 }))} meta={settlements.data?.meta} loading={settlements.loading} onRefresh={settlements.reload} onPage={list.setPage} onRowClick={(s) => setSettlement(s.uuid)}
          toolbar={<div className="flex gap-2">
            <Select value={sDir} onChange={(e) => setSDir(e.target.value)} className="w-48"><option value="">Todos os tipos</option><option value="TO_CREDITOR">Repasse ao credor</option><option value="FROM_CREDITOR">Cobrança ao credor</option></Select>
            <Select value={sStatus} onChange={(e) => setSStatus(e.target.value)} className="w-44"><option value="">Todos os estados</option><option value="PENDING">Aguarda confirmação</option><option value="CONFIRMED">Confirmado</option><option value="CANCELLED">Anulado</option></Select>
          </div>}
          empty={{ title: "Sem repasses", icon: <Scale /> }} />
      </>}

      <AccountDrawer account={open} onClose={() => setOpen(null)} onChanged={refresh} onSettle={(a) => setNewSettlement(a)} canSettle={canSettle} canRate={isManager || can("creditor_commission_manage_permission")} />
      <SettlementModal account={newSettlement} onClose={() => setNewSettlement(null)} onDone={refresh} />
      <SettlementDrawer id={settlement} onClose={() => setSettlement(null)} onChanged={refresh} canSettle={canSettle} />
    </>
  );
}

function AccountDrawer({ account, onClose, onChanged, onSettle, canSettle, canRate }: {
  account: CreditorBalance | null; onClose: () => void; onChanged: () => void; onSettle: (a: CreditorBalance) => void; canSettle: boolean; canRate: boolean;
}) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rate, setRate] = useState("");
  const [editRate, setEditRate] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const confirm = useConfirm();
  const orgId = account?.organizationId ?? 0;
  const { data, reload } = useQuery(() => (orgId ? creditorService.account(orgId, { page, perPage: 20, from: from || undefined, to: to || undefined }) : Promise.resolve(null)), [orgId, page, from, to]);
  useEffect(() => { setPage(1); setEditRate(false); setRate(account?.commissionRate ?? ""); }, [account]);
  const a = data ?? account;

  return (
    <Drawer open={!!account} onClose={onClose} width="max-w-3xl" title={account?.organizationName ?? ""} description="Conta-corrente e extracto de movimentos"
      footer={account && canSettle && <Button icon={<Plus className="h-4 w-4" />} onClick={() => onSettle(account)}>Registar repasse</Button>}>
      {a && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Cobrado", a.collected], ["Comissão", a.commission], ["Repassado", a.settled], ["A repassar", a.pendingToCreditor]].map(([l, v]) => (
              <Card key={l} className="bg-subtle p-4"><p className="text-xs text-muted">{l}</p><p className="tabular mt-1 font-semibold">{formatMoney(v)}</p></Card>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
            <Percent className="h-4 w-4 text-muted" />
            <span className="text-sm">Taxa de comissão da agência</span>
            {editRate ? <>
              <Input type="number" min={0} max={100} step={0.01} value={rate} onChange={(e) => setRate(e.target.value)} className="h-8 w-24" trailing="%" />
              <Button size="sm" loading={savingRate} onClick={async () => {
                setSavingRate(true);
                try {
                  let msg = "";
                  const ok = await confirm({
                    title: `Alterar a comissão para ${Number(rate).toLocaleString("pt-PT")}%?`, tone: "primary", confirmLabel: "Alterar comissão",
                    description: "A nova taxa aplica-se a todos os pagamentos deste credor confirmados a partir de agora. Os pagamentos já confirmados mantêm a taxa antiga.",
                    onConfirm: async () => { msg = (await creditorService.setCommissionRate(orgId, String(Number(rate)))).message; },
                  });
                  if (ok) { toast("success", msg); setEditRate(false); reload(); onChanged(); }
                } catch (e) { toast("error", "Não foi possível alterar a taxa", errorMessage(e)); } finally { setSavingRate(false); }
              }}>Guardar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditRate(false)}>Cancelar</Button>
            </> : <>
              <Badge tone="brand">{pct(a.commissionRate)}</Badge>
              {canRate && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditRate(true)}>Alterar</Button>}
            </>}
            <p className="w-full text-xs text-muted">A nova taxa aplica-se só a pagamentos confirmados depois da alteração.</p>
          </div>
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Extracto</h3>
              <div className="flex items-center gap-1.5 text-sm"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-38" /><span className="text-muted">–</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-38" /></div>
            </div>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-subtle text-xs text-muted"><th className="px-4 py-2 text-left font-medium">Data</th><th className="px-4 py-2 text-left font-medium">Movimento</th><th className="px-4 py-2 text-left font-medium">Descrição</th><th className="px-4 py-2 text-right font-medium">Valor</th></tr></thead>
                <tbody>
                  {data?.entries.data.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="px-4 py-2 whitespace-nowrap text-muted">{formatDate(l.createdAt)}</td>
                      <td className="px-4 py-2">{kindLabel[l.kind]}{l.reversalOfId && <Badge tone="danger" className="ml-2">estorno</Badge>}</td>
                      <td className="max-w-[280px] truncate px-4 py-2 text-muted" title={l.description}>{l.description}</td>
                      <td className={cn("tabular px-4 py-2 text-right font-medium", Number(l.amount) < 0 ? "text-danger-600" : "text-success-700")}>{formatMoney(l.amount)}</td>
                    </tr>
                  ))}
                  {data && !data.entries.data.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">Sem movimentos no período.</td></tr>}
                </tbody>
              </table>
            </div>
            {data && data.entries.meta.lastPage > 1 && (
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
                <Button size="sm" variant="secondary" disabled={page >= data.entries.meta.lastPage} onClick={() => setPage(page + 1)}>Seguinte</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function SettlementModal({ account, onClose, onDone }: { account: CreditorBalance | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const idem = useRef(newIdempotencyKey());
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [f, setF] = useState({ direction: "TO_CREDITOR" as SettlementDirection, amount: "", settledOn: todayIso(), paymentMethodId: "", reference: "", notes: "" });
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!account) return;
    idem.current = newIdempotencyKey();
    setProof(null);
    paymentService.methods().then((m) => { setMethods(m); setF((x) => ({ ...x, paymentMethodId: String(m[0]?.id ?? ""), amount: Number(account.pendingToCreditor) > 0 ? Number(account.pendingToCreditor).toFixed(2) : "" })); });
  }, [account]);
  const ok = Number(f.amount) > 0 && !!f.paymentMethodId && !!proof && f.settledOn <= todayIso();
  return (
    <Modal open={!!account} onClose={onClose} title="Registar repasse" icon={<ArrowUpRight className="h-5 w-5" />} description={account && <>Credor: <b>{account.organizationName}</b> · a repassar {formatMoney(account.pendingToCreditor)}</>}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!ok} loading={busy} onClick={async () => {
        if (!account || !proof) return;
        setBusy(true);
        try {
          const r = await creditorService.registerSettlement(account.organizationId, { direction: f.direction, amount: Number(f.amount).toFixed(2), settledOn: f.settledOn, paymentMethodId: Number(f.paymentMethodId), reference: f.reference || undefined, notes: f.notes || undefined, proof }, idem.current);
          toast("success", r.message, "Fica pendente até ser confirmado."); onDone(); onClose();
        } catch (e) { toast("error", "Não foi possível registar", errorMessage(e)); } finally { setBusy(false); }
      }}>Registar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" className="sm:col-span-2"><SegmentedControl value={f.direction} onChange={(v) => setF({ ...f, direction: v })} options={[{ value: "TO_CREDITOR", label: "Agência paga ao credor" }, { value: "FROM_CREDITOR", label: "Credor paga à agência" }]} /></Field>
        <Field label="Valor" required><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className="tabular" trailing="Kz" /></Field>
        <Field label="Data" required><Input type="date" max={todayIso()} value={f.settledOn} onChange={(e) => setF({ ...f, settledOn: e.target.value })} /></Field>
        <Field label="Meio" required><Select value={f.paymentMethodId} onChange={(e) => setF({ ...f, paymentMethodId: e.target.value })}>{methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
        <Field label="Referência"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} className="font-mono" /></Field>
        <Field label="Comprovativo" required className="sm:col-span-2"><FileDrop accept=".pdf,.png,.jpg,.jpeg" file={proof} onFile={setProof} hint="PDF, PNG ou JPG" /></Field>
        <Field label="Observações" className="sm:col-span-2"><Textarea rows={2} className="min-h-[60px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function SettlementDrawer({ id, onClose, onChanged, canSettle }: { id: string | null; onClose: () => void; onChanged: () => void; canSettle: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data: s, reload } = useQuery(() => (id ? creditorService.settlement(id) : Promise.resolve(null)), [id]);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const done = () => { reload(); onChanged(); };
  return (
    <Drawer open={!!id} onClose={onClose} title={s ? dirLabel[s.direction] : "Repasse"} description={s && <SettlementStatusBadge value={s.status} />}
      footer={s && <>
        <Button variant="secondary" icon={<FileDown className="h-4 w-4" />} className="mr-auto" onClick={() => creditorService.settlementProof(s.id).catch((e) => toast("error", errorMessage(e)))}>Comprovativo</Button>
        {s.status === "PENDING" && canSettle && <>
          <Button variant="outline-danger" icon={<XCircle className="h-4 w-4" />} onClick={() => setCancelling(true)}>Anular</Button>
          <Button icon={<CheckCircle2 className="h-4 w-4" />} loading={busy} onClick={async () => {
            setBusy(true);
            try {
              let msg = "";
              const ok = await confirm({
                title: "Confirmar este repasse?", tone: "primary", confirmLabel: "Confirmar repasse",
                description: <>O movimento de <b>{formatMoney(s.amount)}</b> é lançado na conta-corrente do credor. Depois de confirmado não pode ser anulado.</>,
                onConfirm: async () => { msg = (await creditorService.confirmSettlement(s.id)).message; },
              });
              if (ok) { toast("success", msg); done(); }
            } catch (e) { toast("error", errorMessage(e)); } finally { setBusy(false); }
          }}>Confirmar</Button>
        </>}
      </>}>
      {s && (
        <div className="space-y-4 text-sm">
          <Card className="bg-subtle"><p className="text-xs text-muted">Valor</p><p className="tabular mt-1 text-3xl font-semibold">{formatMoney(s.amount)}</p></Card>
          {[["Credor", s.organizationName ?? `#${s.organizationId}`], ["Data", formatDate(s.settledOn)], ["Meio", s.paymentMethodName ?? "—"], ["Referência", s.reference ?? "—"], ["Registado em", formatDate(s.createdAt)], ["Confirmado em", s.confirmedAt ? formatDate(s.confirmedAt) : "—"]].map(([l, v]) => (
            <div key={l} className="flex justify-between border-b pb-2"><span className="text-muted">{l}</span><span className="font-medium">{v}</span></div>
          ))}
          {s.notes && <p className="rounded-lg bg-subtle p-3">{s.notes}</p>}
          {s.cancelReason && <p className="rounded-lg bg-danger-50 p-3 text-danger-700 dark:bg-danger-500/10"><b>Anulado:</b> {s.cancelReason}</p>}
        </div>
      )}
      <Modal open={cancelling} onClose={() => setCancelling(false)} size="sm" title="Anular repasse?" footer={<><Button variant="secondary" onClick={() => setCancelling(false)}>Voltar</Button>
        <Button variant="danger" disabled={reason.trim().length < 5} loading={busy} onClick={async () => {
          if (!s) return;
          setBusy(true);
          try { const r = await creditorService.cancelSettlement(s.id, reason.trim()); toast("success", r.message); setCancelling(false); setReason(""); done(); } catch (e) { toast("error", errorMessage(e)); } finally { setBusy(false); }
        }}>Anular</Button></>}>
        <Field label="Motivo" required><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} /></Field>
      </Modal>
    </Drawer>
  );
}

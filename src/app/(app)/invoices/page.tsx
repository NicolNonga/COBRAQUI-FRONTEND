"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Eye, FileText, FileUp, Handshake, MoreHorizontal, Paperclip, Pencil, Plus, Scale, Upload } from "lucide-react";
import { Avatar, Card, DescriptionList, PageHeader, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, FileDrop, Input, SearchInput, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer, Dropdown, MenuItem, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { InvoiceStatusBadge, invoiceStateMeta } from "@/components/shared/status";
import { DebtorPicker } from "@/components/shared/debtor-picker";
import { ImportModal } from "@/components/shared/import-modal";
import { ErrorBanner } from "@/components/shared/process-list";
import { DisputeModal } from "@/components/shared/dispute-modal";
import { canDispute, canEditInvoice, InvoiceDrawer } from "@/components/shared/invoice-drawer";
import { useAuth } from "@/components/shared/auth-provider";
import { P } from "@/lib/permissions";
import { useListState, useQuery } from "@/hooks/use-query";
import { ExportPdfButton } from "@/components/shared/export-pdf-button";
import { catalogService, importService, invoiceService, type PdfMatch } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { Currency, Debtor, Invoice, InvoiceStateCode } from "@/types/models";
import { cn, downloadFile, formatDate, formatMoney, toCsv, todayIso } from "@/lib/utils";

type TabKey = "all" | InvoiceStateCode;
const TABS: TabKey[] = ["all", "PENDING", "OVERDUE", "IN_PROGRESS", "IN_DISPUTE", "PARTIALLY_PAID", "PAID", "CANCELLED"];
/** compatibilidade com os links antigos do menu (?status=pending) */
const legacy: Record<string, InvoiceStateCode> = { pending: "PENDING", overdue: "OVERDUE", paid: "PAID", negotiation: "IN_PROGRESS" };

export default function InvoicesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("status") ?? "all";
  const status = (legacy[raw] ?? (TABS.includes(raw as TabKey) ? raw : "all")) as TabKey;
  const list = useListState();
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [inProcess, setInProcess] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const { can } = useAuth();
  const [disputing, setDisputing] = useState<Invoice | null>(null);

  useEffect(() => { list.setPage(1); }, [status, dueFrom, dueTo, inProcess]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (params.get("new")) setCreateOpen(true); }, [params]);

  const query = {
    page: list.page, perPage: list.perPage, search: list.debounced || undefined, state: status === "all" ? undefined : status,
    dueDateFrom: dueFrom || undefined, dueDateTo: dueTo || undefined, inProcess: inProcess === "" ? undefined : inProcess === "yes",
  };
  const { data, loading, error, reload } = useQuery(() => invoiceService.list(query), [JSON.stringify(query)]);
  const { data: counts, reload: reloadCounts } = useQuery(() => invoiceService.countsByState(TABS.filter((t) => t !== "all")));
  const refresh = () => { reload(); reloadCounts(); };

  const setTab = (t: TabKey) => router.push(t === "all" ? "/invoices" : `/invoices?status=${t}`);
  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : undefined;

  const columns: Column<Invoice>[] = [
    { key: "ref", header: "Número", cell: (i) => <span className="flex items-center gap-2 font-mono text-xs font-medium">{i.referenceNumber}{i.documentPath && <Paperclip className="h-3 w-3 text-muted" />}</span> },
    { key: "debtor", header: "Devedor", cell: (i) => <div className="flex items-center gap-2.5"><Avatar name={i.debtor?.name ?? "?"} size="xs" /><span className="max-w-[220px] truncate">{i.debtor?.name}</span></div> },
    { key: "amount", header: "Valor", align: "right", cell: (i) => <span className="tabular font-medium">{formatMoney(i.amount, i.currency?.code)}</span> },
    { key: "issue", header: "Emissão", cell: (i) => <span className="text-muted">{formatDate(i.issueDate)}</span>, hideOnMobile: true },
    { key: "due", header: "Vencimento", cell: (i) => <span className="text-muted">{formatDate(i.dueDate)}</span> },
    { key: "late", header: "Atraso", align: "right", cell: (i) => (i.overdueDays ?? 0) > 0 ? <span className={cn("tabular font-medium", (i.overdueDays ?? 0) > 90 ? "text-danger-700" : "text-danger-600")}>{i.overdueDays} d</span> : <span className="text-muted">—</span> },
    { key: "state", header: "Estado", cell: (i) => <InvoiceStatusBadge code={i.invoiceState?.code} name={i.invoiceState?.name} /> },
    { key: "proc", header: "Em processo", cell: (i) => <span className="text-muted">{i.inProcess ? "Sim" : "Não"}</span>, hideOnMobile: true },
    {
      key: "a", header: "", align: "right", cell: (i) => (
        <Dropdown trigger={<Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>}>
          <MenuItem icon={<Eye />} onClick={() => setViewing(i)}>Ver detalhes</MenuItem>
          {can(P.INVOICE_UPDATE) && <MenuItem icon={<Pencil />} disabled={!canEditInvoice(i)} onClick={() => setEditing(i)}>Editar</MenuItem>}
          <MenuItem icon={<Scale />} disabled={!canDispute(i)} onClick={() => setDisputing(i)}>Abrir disputa</MenuItem>
          <MenuItem icon={<Handshake />} disabled={i.invoiceState?.code === "PAID" || i.invoiceState?.code === "CANCELLED"} onClick={() => router.push(`/negotiations/new?debtorId=${i.debtorId}`)}>Negociar</MenuItem>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Facturas" description="Facturas emitidas pelos credores e respectivo estado de cobrança."
        actions={<>
          <ExportPdfButton path="invoices/export/pdf" name="facturas" params={query} disabled={!data?.data.length} />
          <Dropdown trigger={<Button variant="secondary" icon={<Upload className="h-4 w-4" />}>Importar</Button>}>
            <MenuItem icon={<FileText />} onClick={() => setImportOpen(true)}>Facturas em Excel</MenuItem>
            <MenuItem icon={<FileUp />} onClick={() => setPdfOpen(true)}>Anexar PDFs às facturas</MenuItem>
          </Dropdown>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Nova factura</Button>
        </>} />

      <div className="mb-4">
        <Tabs value={status} onChange={setTab} items={TABS.map((t) => ({ value: t, label: t === "all" ? "Todas" : invoiceStateMeta[t].label, count: t === "all" ? total : counts?.[t] }))} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Vencimento:</span>
        <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} className="h-8 w-40" aria-label="Vencimento desde" />
        <span className="text-muted">–</span>
        <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} className="h-8 w-40" aria-label="Vencimento até" />
        <Select value={inProcess} onChange={(e) => setInProcess(e.target.value)} className="h-8 w-44">
          <option value="">Com ou sem processo</option><option value="yes">Em processo</option><option value="no">Fora de processo</option>
        </Select>
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      <DataTable columns={columns} rows={data?.data} meta={data?.meta} loading={loading} onRefresh={reload} onPage={list.setPage} onRowClick={setViewing}
        toolbar={<>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Nº da factura, devedor ou NIF…" />
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} disabled={!data?.data.length}
            onClick={() => data && downloadFile("facturas.csv", toCsv(data.data.map((i) => ({ Numero: i.referenceNumber, Devedor: i.debtor?.name ?? "", Valor: i.amount, Moeda: i.currency?.code ?? "", Emissao: i.issueDate, Vencimento: i.dueDate, Estado: i.invoiceState?.name ?? "" }))))}>Exportar CSV</Button>
        </>}
        empty={{ title: "Nenhuma factura", description: "Não há facturas com estes filtros.", icon: <FileText /> }} />

      <InvoiceFormDrawer open={createOpen || !!editing} invoice={editing} onClose={() => { setCreateOpen(false); setEditing(null); if (params.get("new")) router.replace("/invoices"); }} onSaved={refresh} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} title="Importar facturas" description="Carregue o ficheiro Excel com as facturas a importar."
        columnsHint="Colunas esperadas: NIF do devedor, número da factura, valor, moeda, data de emissão e prazo (dias)." onImport={importService.invoices} onDone={refresh} />
      <PdfImportModal open={pdfOpen} onClose={() => setPdfOpen(false)} onDone={refresh} />
      <DisputeModal invoice={disputing} onClose={() => setDisputing(null)} onDone={refresh} />
      <InvoiceDrawer invoice={viewing} onClose={() => setViewing(null)} onChanged={refresh} onEdit={(i) => { setViewing(null); setEditing(i); }} onDispute={(i) => { setViewing(null); setDisputing(i); }} />
    </>
  );
}

function InvoiceFormDrawer({ open, invoice, onClose, onSaved }: { open: boolean; invoice: Invoice | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!invoice;
  /** factura já num processo de cobrança: tudo editável; mudar o devedor tira-a desse processo */
  const inProcess = !!invoice?.inProcess;
  const toast = useToast();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const blank = { ref: "", amount: "", currencyId: "", timeLimit: "30", issueDate: todayIso() };
  const [f, setF] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    catalogService.currenciesDropdown().then((c) => {
      const active = c.filter((x) => x.isActive !== false);
      setCurrencies(active);
      if (!invoice) setF({ ...blank, currencyId: String(active.find((x) => x.code === "AOA")?.id ?? active[0]?.id ?? "") });
    }).catch(() => setCurrencies([]));
    if (invoice) {
      setF({ ref: invoice.referenceNumber, amount: String(Number(invoice.amount)), currencyId: String(invoice.currencyId), timeLimit: String(invoice.timeLimitDays), issueDate: String(invoice.issueDate).slice(0, 10) });
      setDebtor((invoice.debtor ? { ...invoice.debtor, id: invoice.debtorId } : null) as Debtor | null);
    } else setDebtor(null);
    setFile(null); setErrors({});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const due = (() => { const d = new Date(f.issueDate); d.setDate(d.getDate() + Number(f.timeLimit || 0)); return d; })();
  const cur = currencies.find((c) => String(c.id) === f.currencyId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!debtor) er.debtor = "Seleccione o devedor.";
    if (!f.ref.trim()) er.ref = "Indique o número da factura.";
    if (!(Number(f.amount) > 0)) er.amount = "Indique um valor maior que zero.";
    if (!f.currencyId) er.currency = "Seleccione a moeda.";
    if (f.issueDate > todayIso()) er.issueDate = "A data de emissão não pode ser futura.";
    if (!f.issueDate) er.issueDate = "Indique a data de emissão.";
    setErrors(er);
    if (Object.keys(er).length || !debtor) return;
    setSaving(true);
    const body = {
      debtor_id: debtor.id, currency_id: Number(f.currencyId), refencence_number: f.ref.trim(), amount: Number(f.amount).toFixed(2),
      time_limit: Number(f.timeLimit), issue_date: f.issueDate,
    };
    try {
      const r = invoice ? await invoiceService.update(invoice.id, body) : await invoiceService.create({ ...body, file });
      toast("success", r.message ?? (invoice ? "Factura actualizada" : "Factura registada"), `${f.ref} · ${debtor.name}`);
      onSaved(); onClose();
    } catch (err) {
      toast("error", invoice ? "Não foi possível guardar as alterações" : "Não foi possível registar a factura", errorMessage(err));
    } finally { setSaving(false); }
  }

  return (
    <Drawer open={open} onClose={onClose} title={isEdit ? `Editar factura ${invoice?.referenceNumber}` : "Nova factura"}
      description={isEdit ? "As alterações ficam registadas na auditoria (antes e depois)." : "Registe uma factura para acompanhamento de cobrança."}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="invoice-form" loading={saving}>{isEdit ? "Guardar alterações" : "Registar factura"}</Button></>}>
      <form id="invoice-form" onSubmit={submit} className="space-y-5">
        {inProcess && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
            Esta factura está num processo de cobrança. O total do processo acompanha as alterações; se mudar o devedor, a factura sai deste processo e passa para o do novo devedor.
            Se o processo tiver uma negociação activa, só o número pode ser alterado.
          </div>
        )}
        <Field label="Devedor" required error={errors.debtor}>
          <DebtorPicker value={debtor} onChange={setDebtor} invalid={!!errors.debtor} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número da factura" required error={errors.ref}>
            <Input placeholder="FT 2026/00001" value={f.ref} invalid={!!errors.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} className="font-mono" />
          </Field>
          <Field label="Data de emissão" required error={errors.issueDate}>
            <Input type="date" max={todayIso()} value={f.issueDate} invalid={!!errors.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} />
          </Field>
          <Field label="Valor" required error={errors.amount}>
            <Input type="number" min="0" step="0.01" placeholder="0,00" value={f.amount} invalid={!!errors.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} trailing={cur?.symbol} className="tabular" />
          </Field>
          <Field label="Moeda" required error={errors.currency}>
            <Select value={f.currencyId} invalid={!!errors.currency} placeholder="Seleccione" onChange={(e) => setF({ ...f, currencyId: e.target.value })}>
              {currencies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </Select>
          </Field>
          <Field label="Prazo de pagamento" hint={`Vence a ${formatDate(due)}`}>
            <Select value={f.timeLimit} onChange={(e) => setF({ ...f, timeLimit: e.target.value })}>
              {[...new Set([0, 15, 30, 45, 60, 90, 120, Number(f.timeLimit) || 0])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{d === 0 ? "A pronto" : `${d} dias`}</option>)}
            </Select>
          </Field>
        </div>
        {!isEdit && <Field label="Documento (opcional)"><FileDrop accept=".pdf" file={file} onFile={setFile} hint="PDF da factura" /></Field>}
      </form>
    </Drawer>
  );
}

function PdfImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PdfMatch[] | null>(null);
  const close = () => { setFiles([]); setResult(null); onClose(); };
  return (
    <Modal open={open} onClose={close} size="lg" title="Anexar PDFs às facturas" icon={<FileUp className="h-5 w-5" />}
      description="O nome de cada ficheiro deve ser o número da factura (ex: FT 2026-00001.pdf). Os PDFs são associados automaticamente."
      footer={result ? <Button onClick={close}>Concluir</Button> : <>
        <Button variant="secondary" onClick={close}>Cancelar</Button>
        <Button disabled={!files.length} loading={busy} onClick={async () => {
          setBusy(true);
          try { const r = await importService.invoicePdfs(files); setResult(r.data); toast("success", r.message); onDone(); }
          catch (e) { toast("error", "Falha no envio", errorMessage(e)); } finally { setBusy(false); }
        }}>Enviar {files.length > 0 && `(${files.length})`}</Button>
      </>}>
      {result ? (
        <ul className="divide-y rounded-xl border">
          {result.map((m) => (
            <li key={m.file} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="truncate font-mono text-xs">{m.file}</span>
              {m.matched ? <span className="text-success-600">Associado a {m.reference}</span> : <span className="text-danger-600">{m.reason ?? "Sem correspondência"}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center hover:bg-subtle">
            <FileUp className="h-6 w-6 text-muted" />
            <span className="text-sm"><b className="text-brand-600">Seleccione os PDFs</b> (vários de uma vez)</span>
            <input type="file" accept=".pdf" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </label>
          {files.length > 0 && <p className="text-sm text-muted">{files.length} ficheiro(s): {files.slice(0, 4).map((f) => f.name).join(", ")}{files.length > 4 && "…"}</p>}
        </div>
      )}
    </Modal>
  );
}


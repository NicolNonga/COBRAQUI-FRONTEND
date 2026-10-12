"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Download, FileText, FolderKanban, Handshake, Mail, MapPin, Pencil, Phone, UploadCloud, User, Wallet } from "lucide-react";
import { Avatar, Badge, Card, CardHeader, DescriptionList, EmptyState, PageHeader, Skeleton, StatCard, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast";
import { ActiveBadge, InvoiceStatusBadge, NegotiationStatusBadge, PaymentStatusBadge, ProcessStateBadge } from "@/components/shared/status";
import { DebtorFormDrawer } from "@/components/shared/debtor-form";
import { ActivityTimeline, AuditDetailDrawer } from "@/components/shared/audit";
import { DocumentCollection, DocumentDrawer, UploadModal } from "@/components/shared/documents";
import { ErrorBanner } from "@/components/shared/process-list";
import { InvoiceDrawer } from "@/components/shared/invoice-drawer";
import { useQuery } from "@/hooks/use-query";
import { debtorService, documentService, invoiceService, negotiationService, paymentService, processService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { AuditLog, DocumentFile, Invoice, NegotiationListItem, Process } from "@/types/models";
import { formatDate, formatMoney, formatNumber, timeAgo } from "@/lib/utils";

type Tab = "invoices" | "processes" | "negotiations" | "payments" | "credit" | "documents" | "history" | "info";

export default function DebtorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const debtorId = Number(id);
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("invoices");
  const [edit, setEdit] = useState(false);
  const [page, setPage] = useState({ invoices: 1, processes: 1, negotiations: 1, payments: 1 });

  const { data: d, error, reload } = useQuery(() => debtorService.get(debtorId), [debtorId]);
  const invoices = useQuery(() => invoiceService.list({ debtorId, page: page.invoices, perPage: 10 }), [debtorId, page.invoices]);
  const open = useQuery(() => invoiceService.list({ debtorId, state: "OVERDUE", perPage: 1 }), [debtorId]);
  const processes = useQuery(() => processService.list({ debtorId, page: page.processes, perPage: 10 }), [debtorId, page.processes]);
  const negotiations = useQuery(() => negotiationService.list({ debtorId, page: page.negotiations, perPage: 10 }), [debtorId, page.negotiations]);
  const payments = useQuery(() => paymentService.list({ debtorId, page: page.payments, perPage: 10 }), [debtorId, page.payments]);
  const credit = useQuery(() => paymentService.debtorCredit(debtorId).catch(() => null), [debtorId]);
  const debt = useQuery(() => debtorService.debt(debtorId).catch(() => null), [debtorId]);
  const docs = useQuery(() => documentService.list({ debtorId, perPage: 200 }), [debtorId]);
  const [docSel, setDocSel] = useState<number[]>([]);
  const [docOpen, setDocOpen] = useState<DocumentFile | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [logOpen, setLogOpen] = useState<AuditLog | null>(null);
  const [invOpen, setInvOpen] = useState<Invoice | null>(null);

  if (error) return <EmptyState title="Devedor não encontrado" description={error} action={<Link href="/debtors"><Button variant="secondary">Voltar</Button></Link>} />;
  if (!d) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-32" /><Skeleton className="h-80" /></div>;

  const invCols: Column<Invoice>[] = [
    { key: "ref", header: "Factura", cell: (i) => <span className="font-mono text-xs font-medium">{i.referenceNumber}</span> },
    { key: "issue", header: "Emissão", cell: (i) => <span className="text-muted">{formatDate(i.issueDate)}</span> },
    { key: "due", header: "Vencimento", cell: (i) => <span className="text-muted">{formatDate(i.dueDate)}{(i.overdueDays ?? 0) > 0 && <span className="ml-2 text-xs text-danger-600">+{i.overdueDays}d</span>}</span> },
    { key: "amount", header: "Valor", align: "right", cell: (i) => <span className="tabular font-medium">{formatMoney(i.amount, i.currency?.code)}</span> },
    { key: "state", header: "Estado", cell: (i) => <InvoiceStatusBadge code={i.invoiceState?.code} name={i.invoiceState?.name} /> },
  ];
  const procCols: Column<Process>[] = [
    { key: "id", header: "Processo", cell: (p) => <span className="font-mono text-xs font-medium">PRC-{String(p.id).padStart(5, "0")}</span> },
    { key: "amount", header: "Em dívida", align: "right", cell: (p) => <span className="tabular font-medium">{formatMoney(p.totalAmount)}</span> },
    { key: "state", header: "Estado", cell: (p) => <ProcessStateBadge code={p.processState?.code} name={p.processState?.name} /> },
    { key: "agent", header: "Agente", cell: (p) => <span className="text-muted">{p.assignment?.user?.fullName ?? "Sem responsável"}</span> },
    { key: "contact", header: "Último contacto", cell: (p) => <span className="text-muted">{p.lastContactAt ? timeAgo(p.lastContactAt) : "Nunca"}</span> },
  ];
  const negCols: Column<NegotiationListItem>[] = [
    { key: "id", header: "Acordo", cell: (n) => <span className="font-mono text-xs font-medium">ACD-{String(n.id).padStart(5, "0")}</span> },
    { key: "final", header: "Valor acordado", align: "right", cell: (n) => <span className="tabular font-semibold">{formatMoney(n.finalAmount)}</span> },
    { key: "inst", header: "Prestações", cell: (n) => <span className="text-muted">{n.isInstallment ? `${n.totalInstallments}x` : "Único"}</span> },
    { key: "period", header: "Vigência", cell: (n) => <span className="text-muted">{formatDate(n.startDate)} – {formatDate(n.endDate)}</span> },
    { key: "status", header: "Estado", cell: (n) => <NegotiationStatusBadge status={n.status} /> },
  ];

  return (
    <>
      <Link href="/debtors" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--text)]"><ArrowLeft className="h-4 w-4" /> Devedores</Link>
      <PageHeader
        title={<span className="flex items-center gap-4"><Avatar name={d.name} size="lg" /><span>{d.name}
          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm font-normal">
            <ActiveBadge active={d.isActive} />
            <Badge tone="info">{d.isCompany ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}{d.debtorType?.name ?? (d.isCompany ? "Empresa" : "Particular")}</Badge>
            {d.nif && <span className="font-mono text-xs text-muted">NIF {d.nif}</span>}
          </span></span></span>}
        actions={<>
          {d.logoPath && <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => debtorService.downloadLogo(d.id).catch((e) => toast("error", errorMessage(e)))}>Logótipo</Button>}
          <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEdit(true)}>Editar</Button>
          <Link href={`/negotiations/new?debtorId=${d.id}`}><Button icon={<Handshake className="h-4 w-4" />}>Negociar dívida</Button></Link>
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Facturas" value={formatNumber(invoices.data?.meta.total ?? 0)} icon={<FileText />} />
        <StatCard label="Facturas vencidas" value={formatNumber(open.data?.meta.total ?? 0)} icon={<FileText />} tone="danger" />
        <StatCard label="Processos" value={formatNumber(processes.data?.meta.total ?? 0)} icon={<FolderKanban />} tone="info" />
        {/* sem dados não mostramos 0,00 (seria confundido com "não deve nada"): mostramos "—" */}
        <StatCard label="Dívida total" value={debt.data ? formatMoney(debt.data.totalDebt) : "—"} icon={<Wallet />} tone="warning"
          footer={debt.data
            ? <span className="text-muted">{formatMoney(debt.data.overdueDebt)} vencida · {formatNumber(debt.data.openInvoices)} factura(s) em aberto{Number(credit.data?.balance ?? 0) > 0 ? ` · ${formatMoney(credit.data?.balance ?? 0)} de crédito` : ""}</span>
            : <span className="text-muted">{debt.loading ? "A calcular…" : "Não foi possível calcular a dívida."}</span>} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card padded={false} className="min-w-0">
          <div className="px-5 pt-4">
            <Tabs value={tab} onChange={setTab} items={[
              { value: "invoices", label: "Facturas", count: invoices.data?.meta.total },
              { value: "processes", label: "Processos", count: processes.data?.meta.total },
              { value: "negotiations", label: "Negociações", count: negotiations.data?.meta.total },
              { value: "payments", label: "Pagamentos", count: payments.data?.meta.total },
              { value: "credit", label: "Crédito" },
              { value: "documents", label: "Documentos", count: docs.data?.meta.total },
              { value: "history", label: "Histórico" },
              { value: "info", label: "Informação" },
            ]} />
          </div>
          <div className="p-4">
            {tab === "invoices" && <>{invoices.error && <ErrorBanner message={invoices.error} />}<DataTable dense columns={invCols} rows={invoices.data?.data} meta={invoices.data?.meta} loading={invoices.loading} onRefresh={invoices.reload} onPage={(n) => setPage({ ...page, invoices: n })} onRowClick={setInvOpen} empty={{ title: "Sem facturas" }} /></>}
            {tab === "processes" && <DataTable dense columns={procCols} rows={processes.data?.data} meta={processes.data?.meta} loading={processes.loading} onRefresh={processes.reload} onPage={(n) => setPage({ ...page, processes: n })} onRowClick={() => router.push("/processes")} empty={{ title: "Sem processos" }} />}
            {tab === "negotiations" && <DataTable dense columns={negCols} rows={negotiations.data?.data} meta={negotiations.data?.meta} loading={negotiations.loading} onRefresh={negotiations.reload} onPage={(n) => setPage({ ...page, negotiations: n })} onRowClick={(n) => router.push(`/negotiations/${n.id}`)} empty={{ title: "Sem negociações" }} />}
            {tab === "payments" && (
              <div className="overflow-hidden rounded-2xl border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-subtle text-xs text-muted">
                    <th className="px-4 py-2.5 text-left font-medium">Data</th><th className="px-4 py-2.5 text-left font-medium">Acordo</th>
                    <th className="px-4 py-2.5 text-left font-medium">Método</th><th className="px-4 py-2.5 text-right font-medium">Valor</th><th className="px-4 py-2.5 text-left font-medium">Estado</th>
                  </tr></thead>
                  <tbody>
                    {payments.data?.data.map((p) => (
                      <tr key={p.id} onClick={() => router.push(`/payments?id=${p.id}`)} className="cursor-pointer border-b last:border-0 hover:bg-subtle">
                        <td className="px-4 py-2.5">{formatDate(p.paidOn)}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">ACD-{String(p.negotiationId).padStart(5, "0")}</td>
                        <td className="px-4 py-2.5 text-muted">{p.paymentMethod?.name ?? "—"}</td>
                        <td className="tabular px-4 py-2.5 text-right font-medium">{formatMoney(p.amount, p.currency?.code)}</td>
                        <td className="px-4 py-2.5"><PaymentStatusBadge value={p.status} /></td>
                      </tr>
                    ))}
                    {!payments.loading && !payments.data?.data.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Sem pagamentos registados.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {tab === "credit" && (
              credit.data ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-subtle p-4"><p className="text-xs text-muted">Saldo de crédito do devedor</p><p className="tabular mt-1 text-2xl font-semibold">{formatMoney(credit.data.balance)}</p>
                    <p className="mt-1 text-xs text-muted">Gerado por pagamentos acima do valor devido ou estornos; é abatido automaticamente em próximos acordos.</p></div>
                  <ul className="divide-y rounded-xl border">
                    {credit.data.data.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                        <div><p className="font-medium">{c.description}</p><p className="text-xs text-muted">{formatDate(c.createdAt)} · {c.kind === "OVERPAYMENT" ? "Pagamento em excesso" : c.kind === "REVERSAL" ? "Estorno" : "Aplicado"}</p></div>
                        <span className={`tabular font-medium ${c.kind === "APPLIED" ? "text-danger-600" : "text-success-600"}`}>{c.kind === "APPLIED" ? "−" : "+"}{formatMoney(c.amount)}</span>
                      </li>
                    ))}
                    {!credit.data.data.length && <li className="px-4 py-8 text-center text-sm text-muted">Sem movimentos de crédito.</li>}
                  </ul>
                </div>
              ) : <EmptyState title="Sem informação de crédito" />
            )}
            {tab === "documents" && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-muted">Documentos associados a este devedor</p>
                  <Button size="sm" icon={<UploadCloud className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>Carregar</Button>
                </div>
                <div className="overflow-hidden rounded-2xl border">
                  <DocumentCollection docs={docs.data?.data ?? []} view="list" selected={docSel} onSelect={setDocSel} onOpen={setDocOpen} onChanged={docs.reload}
                    empty={<EmptyState title="Sem documentos" description="Carregue contratos, facturas e comprovativos deste devedor." action={<Button size="sm" onClick={() => setUploadOpen(true)}>Carregar documento</Button>} />} />
                </div>
              </div>
            )}
            {tab === "history" && <ActivityTimeline entity="debtor" entityId={debtorId} onOpen={setLogOpen} />}
            {tab === "info" && (
              <DescriptionList items={[
                { label: "Razão social", value: d.socialReason ?? "—" }, { label: "Credor", value: d.organization?.name ?? "—" },
                { label: "Email", value: d.email }, { label: "Telefone", value: d.phoneNumber },
                { label: "Endereço", value: d.address }, { label: "Registado em", value: formatDate(d.createdAt) },
              ]} />
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Contactos" />
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted" /><a href={`mailto:${d.email}`} className="truncate hover:text-brand-600">{d.email}</a></li>
              <li className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted" /><a href={`tel:${d.phoneNumber}`} className="hover:text-brand-600">{d.phoneNumber}</a></li>
              <li className="flex items-center gap-3"><MapPin className="h-4 w-4 text-muted" />{d.address}</li>
            </ul>
          </Card>
          {d.contactPerson && (
            <Card>
              <CardHeader title="Pessoa de contacto" />
              <div className="mt-4 flex items-center gap-3"><Avatar name={d.contactPerson.name} /><div><p className="text-sm font-medium">{d.contactPerson.name}</p><p className="text-xs text-muted">{d.contactPerson.position}</p></div></div>
              <div className="mt-4 space-y-2 text-sm text-muted">
                <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{d.contactPerson.email}</p>
                <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{d.contactPerson.contact}</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onDone={docs.reload} defaultDebtor={d} />
      <DocumentDrawer doc={docOpen} onClose={() => setDocOpen(null)} onChanged={docs.reload} />
      <AuditDetailDrawer log={logOpen} onClose={() => setLogOpen(null)} />
      <InvoiceDrawer invoice={invOpen} onClose={() => setInvOpen(null)} onChanged={invoices.reload} />
      <DebtorFormDrawer open={edit} onClose={() => setEdit(false)} debtor={d} onSaved={reload} />
    </>
  );
}

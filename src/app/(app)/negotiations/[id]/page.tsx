"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Ban, Banknote, CheckCircle2, CircleSlash, History, RefreshCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge, Card, CardHeader, DescriptionList, EmptyState, PageHeader, Progress, Skeleton, StatCard, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { InstallmentStateBadge, NegotiationStatusBadge, PaymentStatusBadge } from "@/components/shared/status";
import { PaymentDrawer, RegisterPaymentModal, paymentCode, receiverLabel } from "@/components/shared/payments";
import { ActivityTimeline, AuditDetailDrawer } from "@/components/shared/audit";
import { useAuth } from "@/components/shared/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { negotiationService, paymentService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { AuditLog } from "@/types/models";
import { cn, formatDate, formatMoney, pct, todayIso } from "@/lib/utils";

type Action = "reject" | "cancel" | "break";
const actionMeta: Record<Action, { title: string; desc: string; cta: string }> = {
  reject: { title: "Rejeitar acordo", desc: "O acordo não entra em vigor e os processos ficam livres para nova negociação.", cta: "Rejeitar" },
  cancel: { title: "Cancelar acordo", desc: "O acordo é cancelado. Pagamentos já confirmados mantêm-se.", cta: "Cancelar acordo" },
  break: { title: "Marcar como quebrado", desc: "Use quando o devedor deixou de cumprir. Depois poderá renegociar o saldo em dívida.", cta: "Quebrar acordo" },
};

export default function NegotiationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const nid = Number(id);
  const router = useRouter();
  const toast = useToast();
  const { can, isManager } = useAuth();
  const { data: n, error, reload } = useQuery(() => negotiationService.get(nid), [nid]);
  const payments = useQuery(() => paymentService.list({ negotiationId: nid, perPage: 50 }), [nid]);
  const [tab, setTab] = useState<"installments" | "payments" | "processes" | "history">("installments");
  const [payOpen, setPayOpen] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<AuditLog | null>(null);
  const confirm = useConfirm();
  const refresh = () => { reload(); payments.reload(); };

  if (error) return <EmptyState title="Acordo não encontrado" description={error} action={<Link href="/negotiations"><Button variant="secondary">Voltar</Button></Link>} />;
  if (!n) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-32" /><Skeleton className="h-80" /></div>;

  const debtor = n.processes?.[0]?.process?.debtor;
  const t = n.paymentTotals;
  const canApprove = isManager || can("negotiation_approve_permission");
  const today = todayIso();

  async function approve() {
    setBusy(true);
    try {
      let msg = "";
      const ok = await confirm({
        title: "Aprovar este acordo?", tone: "primary", confirmLabel: "Aprovar acordo",
        description: <>O acordo de <b>{formatMoney(n!.finalAmount)}</b> entra em vigor de imediato e as prestações começam a contar. A aprovação fica registada em seu nome.</>,
        onConfirm: async () => { msg = (await negotiationService.approve(nid)).message; },
      });
      if (ok) { toast("success", msg); refresh(); }
    } catch (e) { toast("error", "Não foi possível aprovar", errorMessage(e)); } finally { setBusy(false); }
  }
  async function runAction() {
    if (!action) return;
    setBusy(true);
    try {
      const r = action === "reject" ? await negotiationService.reject(nid, reason.trim())
        : action === "cancel" ? await negotiationService.cancel(nid, reason.trim()) : await negotiationService.breakAgreement(nid, reason.trim());
      toast("success", r.message); setAction(null); setReason(""); refresh();
    } catch (e) { toast("error", "Operação recusada", errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <Link href="/negotiations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--text)]"><ArrowLeft className="h-4 w-4" /> Negociações</Link>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">Acordo ACD-{String(n.id).padStart(5, "0")} <NegotiationStatusBadge status={n.status} /></span>}
        description={debtor ? <>Devedor: <Link href={`/debtors/${debtor.id}`} className="font-medium text-brand-600 hover:underline">{debtor.name}</Link></> : undefined}
        actions={<>
          {n.status === "PENDING_APPROVAL" && canApprove && <>
            <Button variant="outline-danger" icon={<ThumbsDown className="h-4 w-4" />} onClick={() => setAction("reject")}>Rejeitar</Button>
            <Button icon={<ThumbsUp className="h-4 w-4" />} loading={busy && !action} onClick={approve}>Aprovar</Button>
          </>}
          {(n.status === "ACTIVE" || n.status === "PENDING_APPROVAL") && <Button variant="secondary" icon={<Ban className="h-4 w-4" />} onClick={() => setAction("cancel")}>Cancelar</Button>}
          {n.status === "ACTIVE" && (isManager || can("negotiation_break_permission")) && <Button variant="secondary" icon={<CircleSlash className="h-4 w-4" />} onClick={() => setAction("break")}>Quebrar</Button>}
          {(n.status === "ACTIVE" || n.status === "BROKEN") && <Button variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => router.push(`/negotiations/${n.id}/renegotiate`)}>Renegociar</Button>}
          {n.status === "ACTIVE" && <Button icon={<Banknote className="h-4 w-4" />} onClick={() => setPayOpen(true)}>Registar pagamento</Button>}
        </>} />

      {n.status === "PENDING_APPROVAL" && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning-500/30 bg-warning-50 p-4 text-sm text-warning-700 dark:bg-warning-500/10">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>O desconto de <b>{pct(n.discountRate)}</b> excede o limite autorizado. O acordo só entra em vigor depois de aprovado por um gestor.</span>
        </div>
      )}
      {(n.rejectionReason || n.breakReason) && (
        <div className="mb-6 rounded-xl border border-danger-500/30 bg-danger-50 p-4 text-sm text-danger-700 dark:bg-danger-500/10">
          <b>{n.status === "REJECTED" ? "Motivo da rejeição" : "Motivo da quebra"}:</b> {n.rejectionReason ?? n.breakReason}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Valor acordado" value={formatMoney(n.finalAmount)} icon={<Banknote />} footer={<span className="text-muted">dívida {formatMoney(n.debtAmount)} · desconto {pct(n.discountRate)}</span>} />
        <StatCard label="Pago (confirmado)" value={formatMoney(t.paidAmount)} icon={<CheckCircle2 />} tone="success" footer={<Progress value={Number(t.progressPercent) / 100} tone="success" />} />
        <StatCard label="Pendente de confirmação" value={formatMoney(t.pendingAmount)} icon={<History />} tone="warning" footer={<span className="text-muted">{t.pendingPayments} pagamento(s)</span>} />
        <StatCard label="Em falta" value={formatMoney(t.remainingAmount)} icon={<AlertTriangle />} tone="danger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card padded={false} className="min-w-0">
          <div className="px-5 pt-4">
            <Tabs value={tab} onChange={setTab} items={[
              { value: "installments", label: "Prestações", count: n.installments?.length },
              { value: "payments", label: "Pagamentos", count: payments.data?.meta.total },
              { value: "processes", label: "Processos", count: n.processes?.length },
              { value: "history", label: "Histórico" },
            ]} />
          </div>

          {tab === "installments" && (
            n.installments?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-subtle text-xs text-muted">
                    {["Nº", "Vencimento", "Valor", "Pago", "Em falta", "Multa", "Estado"].map((h, i) => <th key={h} className={cn("px-4 py-2.5 font-medium", i >= 2 && i <= 4 ? "text-right" : "text-left")}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {n.installments.map((i) => {
                      const late = i.paymentState !== "PAID" && i.paymentState !== "CANCELLED" && i.dueDate < today;
                      return (
                        <tr key={i.id} className="border-b last:border-0">
                          <td className="px-4 py-2.5 font-medium">{i.installmentNumber}</td>
                          <td className={cn("px-4 py-2.5", late && "text-danger-600")}>{formatDate(i.dueDate)}{late && <span className="ml-1.5 text-xs">(em atraso)</span>}</td>
                          <td className="tabular px-4 py-2.5 text-right">{formatMoney(i.amount)}</td>
                          <td className="tabular px-4 py-2.5 text-right text-success-600">{formatMoney(i.paidAmount)}</td>
                          <td className="tabular px-4 py-2.5 text-right font-medium">{formatMoney(i.remainingAmount)}</td>
                          <td className="px-4 py-2.5 text-muted">{pct(i.penaltyPercentage)}</td>
                          <td className="px-4 py-2.5"><InstallmentStateBadge value={i.paymentState} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="p-5"><p className="rounded-xl bg-subtle p-4 text-sm text-muted">Pagamento único de <b className="text-[var(--text)]">{formatMoney(n.finalAmount)}</b> até {formatDate(n.endDate)}.</p></div>
          )}

          {tab === "payments" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-subtle text-xs text-muted">
                  {["Pagamento", "Data", "Recebido por", "Meio", "Valor", "Estado"].map((h) => <th key={h} className={cn("px-4 py-2.5 font-medium", h === "Valor" ? "text-right" : "text-left")}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {payments.data?.data.map((p) => (
                    <tr key={p.id} onClick={() => setPaymentId(p.id)} className="cursor-pointer border-b last:border-0 hover:bg-subtle">
                      <td className="px-4 py-2.5 font-mono text-xs">{paymentCode(p.id)}</td>
                      <td className="px-4 py-2.5">{formatDate(p.paidOn)}</td>
                      <td className="px-4 py-2.5 text-muted">{receiverLabel[p.receiver]}</td>
                      <td className="px-4 py-2.5 text-muted">{p.paymentMethod?.name ?? "—"}</td>
                      <td className="tabular px-4 py-2.5 text-right font-medium">{formatMoney(p.amount, p.currency?.code)}</td>
                      <td className="px-4 py-2.5"><PaymentStatusBadge value={p.status} /></td>
                    </tr>
                  ))}
                  {!payments.loading && !payments.data?.data.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">Ainda não há pagamentos neste acordo.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === "processes" && (
            <ul className="divide-y">
              {n.processes?.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-mono text-xs">PRC-{String(p.processId).padStart(5, "0")}</span>
                  <span className="tabular font-medium">{formatMoney(p.process?.totalAmount)}</span>
                  <Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Activo no acordo" : "Inactivo"}</Badge>
                </li>
              ))}
            </ul>
          )}

          {tab === "history" && <ActivityTimeline entity="negotiation" entityId={nid} onOpen={setLog} />}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Condições" />
          <div className="mt-4">
            <DescriptionList cols={1} items={[
              { label: "Dívida original", value: formatMoney(n.debtAmount) },
              { label: "Desconto", value: `${formatMoney(n.discountAmount)} (${pct(n.discountRate)})` },
              { label: "Valor acordado", value: formatMoney(n.finalAmount) },
              { label: "Modalidade", value: n.isInstallment ? `${n.totalInstallments} prestações${n.isEqualInstallments ? " iguais" : ""}` : "Pagamento único" },
              { label: "Data efectiva", value: formatDate(n.effectiveDate) },
              { label: "Vigência", value: `${formatDate(n.startDate)} – ${formatDate(n.endDate)}` },
              ...(Number(t.creditGenerated) > 0 ? [{ label: "Crédito gerado ao devedor", value: formatMoney(t.creditGenerated) }] : []),
              ...(n.previousNegotiationId ? [{ label: "Renegociação de", value: <Link href={`/negotiations/${n.previousNegotiationId}`} className="text-brand-600 hover:underline">ACD-{String(n.previousNegotiationId).padStart(5, "0")}</Link> }] : []),
              { label: "Criado em", value: formatDate(n.createdAt) },
            ]} />
            {n.notes && <p className="mt-4 rounded-lg bg-subtle p-3 text-sm">{n.notes}</p>}
          </div>
        </Card>
      </div>

      <RegisterPaymentModal open={payOpen} onClose={() => setPayOpen(false)} onDone={refresh} negotiationId={nid} installments={n.installments} debtorName={debtor?.name} />
      <PaymentDrawer id={paymentId} onClose={() => setPaymentId(null)} onChanged={refresh} />
      <AuditDetailDrawer log={log} onClose={() => setLog(null)} />
      <Modal open={!!action} onClose={() => setAction(null)} size="sm" title={action ? actionMeta[action].title : ""} description={action ? actionMeta[action].desc : ""}
        footer={<><Button variant="secondary" onClick={() => setAction(null)}>Voltar</Button>
          <Button variant="danger" disabled={reason.trim().length < 5} loading={busy && !!action} onClick={runAction}>{action ? actionMeta[action].cta : ""}</Button></>}>
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700 dark:bg-danger-500/10 dark:text-danger-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Esta acção não pode ser desfeita.
        </p>
        <Field label="Motivo" required hint="Mínimo 5 caracteres; fica registado na auditoria."><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} /></Field>
      </Modal>
    </>
  );
}

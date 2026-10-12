import { Badge, type Tone } from "@/components/ui/display";
import type {
  ContactStatus, DisputeOutcome, DisputeStatus, InstallmentPaymentState, InvoiceStateCode, LadderTaskStatus, NegotiationStatus,
  OutboxStatus, PaymentStatus, ProcessStateCode, SettlementStatus,
} from "@/types/models";

type Meta = { label: string; tone: Tone };
function make<K extends string>(m: Record<K, Meta>) {
  return function StatusBadge({ value, fallback }: { value?: K | null; fallback?: string }) {
    return value && m[value] ? <Badge tone={m[value].tone} dot>{m[value].label}</Badge> : <Badge>{fallback ?? value ?? "—"}</Badge>;
  };
}

export const invoiceStateMeta: Record<InvoiceStateCode, Meta> = {
  PENDING: { label: "Pendente", tone: "brand" },
  IN_PROGRESS: { label: "Em cobrança", tone: "info" },
  OVERDUE: { label: "Vencida", tone: "danger" },
  IN_DISPUTE: { label: "Em disputa", tone: "warning" },
  PARTIALLY_PAID: { label: "Paga parcialmente", tone: "warning" },
  PAID: { label: "Paga", tone: "success" },
  CANCELLED: { label: "Anulada", tone: "neutral" },
};
const InvoiceBadge = make(invoiceStateMeta);
export const InvoiceStatusBadge = ({ code, name }: { code?: InvoiceStateCode | null; name?: string }) => <InvoiceBadge value={code} fallback={name} />;

export const processStateMeta: Record<ProcessStateCode, Meta> = {
  REGISTERED: { label: "Registado", tone: "neutral" },
  PENDING: { label: "Pendente", tone: "neutral" },
  ASSIGNED: { label: "Atribuído", tone: "info" },
  IN_PROGRESS: { label: "Em cobrança", tone: "brand" },
  FINISHED: { label: "Concluído", tone: "success" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
};
const ProcessBadge = make(processStateMeta);
export const ProcessStateBadge = ({ code, name }: { code?: ProcessStateCode | null; name?: string }) => <ProcessBadge value={code} fallback={name} />;

export const negotiationStatusMeta: Record<NegotiationStatus, Meta> = {
  PENDING_APPROVAL: { label: "Aguarda aprovação", tone: "warning" },
  ACTIVE: { label: "Em vigor", tone: "brand" },
  COMPLETED: { label: "Liquidado", tone: "success" },
  BROKEN: { label: "Quebrado", tone: "danger" },
  REJECTED: { label: "Rejeitado", tone: "neutral" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
  RENEGOTIATED: { label: "Renegociado", tone: "info" },
};
const NegBadge = make(negotiationStatusMeta);
export const NegotiationStatusBadge = ({ status }: { status: NegotiationStatus }) => <NegBadge value={status} />;

export const installmentStateMeta: Record<InstallmentPaymentState, Meta> = {
  PAID: { label: "Paga", tone: "success" },
  PARTIALLY_PAID: { label: "Parcial", tone: "warning" },
  UNPAID: { label: "Em aberto", tone: "neutral" },
  CANCELLED: { label: "Cancelada", tone: "neutral" },
};
export const InstallmentStateBadge = make(installmentStateMeta);

export const paymentStatusMeta: Record<PaymentStatus, Meta> = {
  PENDING: { label: "Aguarda confirmação", tone: "warning" },
  CONFIRMED: { label: "Confirmado", tone: "success" },
  CANCELLED: { label: "Anulado", tone: "neutral" },
  REVERSED: { label: "Estornado", tone: "danger" },
};
export const PaymentStatusBadge = make(paymentStatusMeta);

export const settlementStatusMeta: Record<SettlementStatus, Meta> = {
  PENDING: { label: "Aguarda confirmação", tone: "warning" },
  CONFIRMED: { label: "Confirmado", tone: "success" },
  CANCELLED: { label: "Anulado", tone: "neutral" },
};
export const SettlementStatusBadge = make(settlementStatusMeta);

export const disputeStatusMeta: Record<DisputeStatus, Meta> = {
  OPEN: { label: "Em aberto", tone: "warning" },
  RESOLVED: { label: "Resolvida", tone: "success" },
};
export const DisputeStatusBadge = make(disputeStatusMeta);
export const disputeOutcomeMeta: Record<DisputeOutcome, Meta & { help: string }> = {
  UPHELD: { label: "Procedente (credor)", tone: "brand", help: "A factura é devida e volta à cobrança." },
  CANCELLED: { label: "Factura anulada", tone: "neutral", help: "O devedor tinha razão: a factura sai da dívida." },
  ADJUSTED: { label: "Valor corrigido", tone: "info", help: "Novo valor e a factura volta à cobrança." },
};
export const DisputeOutcomeBadge = make(disputeOutcomeMeta);

export const ladderTaskMeta: Record<LadderTaskStatus, Meta> = {
  PENDING: { label: "Pendente", tone: "brand" },
  OVERDUE: { label: "Em atraso", tone: "danger" },
  FULFILLED: { label: "Cumprida", tone: "success" },
  VOID: { label: "Sem efeito", tone: "neutral" },
};
export const LadderTaskBadge = make(ladderTaskMeta);

export const contactStatusMeta: Record<ContactStatus, Meta> = {
  attempted: { label: "Tentativa", tone: "neutral" },
  answered: { label: "Atendeu", tone: "success" },
  negotiation_started: { label: "Negociação iniciada", tone: "brand" },
  no_answer: { label: "Não atendeu", tone: "warning" },
  failed: { label: "Falhou", tone: "danger" },
  pending: { label: "Pendente", tone: "neutral" },
};
export const ContactStatusBadge = make(contactStatusMeta);

export const outboxStatusMeta: Record<OutboxStatus, Meta> = {
  PENDING: { label: "Pendente", tone: "neutral" },
  PROCESSING: { label: "A processar", tone: "brand" },
  SENT: { label: "Enviada", tone: "success" },
  DEAD: { label: "Falhou definitivamente", tone: "danger" },
};
export const OutboxStatusBadge = make(outboxStatusMeta);

export const ActiveBadge = ({ active, on = "Activo", off = "Inactivo" }: { active: boolean; on?: string; off?: string }) => (
  <Badge tone={active ? "success" : "neutral"} dot>{active ? on : off}</Badge>
);

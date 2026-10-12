"use client";
import {
  ArrowRight, ArrowRightLeft, Banknote, CheckCircle2, Clock, FileDown, FileUp, KeyRound, LogIn, LogOut, MapPin, Pencil, Plus, Power,
  ShieldAlert, Trash2, Undo2, XCircle, type LucideIcon,
} from "lucide-react";
import { Avatar, Badge, EmptyState, Skeleton, type Tone } from "@/components/ui/display";
import { Drawer } from "@/components/ui/overlay";
import { useQuery } from "@/hooks/use-query";
import { auditService } from "@/lib/api/services";
import type { AuditLog } from "@/types/models";
import { cn, formatDate, formatMoney } from "@/lib/utils";

/* ───────── Tradução das acções e entidades do backend ───────── */
const ACTION_LABELS: Record<string, string> = {
  USER_LOGIN: "Início de sessão", USER_LOGOUT: "Fim de sessão", USER_LOGIN_FAILED: "Início de sessão falhado", USER_PASSWORD_RESET: "Reposição de palavra-passe",
  USER_CREATED: "Utilizador criado", USER_UPDATED: "Utilizador alterado", USER_ENABLED: "Utilizador activado", USER_DISABLED: "Utilizador desactivado",
  ORGANIZATION_CREATED: "Credor criado", ORGANIZATION_ENABLED: "Credor activado", ORGANIZATION_DISABLED: "Credor desactivado",
  DEBTOR_CREATED: "Devedor criado", DEBTOR_UPDATED: "Devedor alterado", DEBTOR_ENABLED: "Devedor activado", DEBTOR_DISABLED: "Devedor desactivado",
  INVOICE_CREATED: "Factura registada", INVOICES_MARKED_OVERDUE: "Facturas vencidas (automático)",
  COLLECTION_PROCESSES_GENERATED: "Processos gerados", PROCESS_ASSIGNED: "Processo atribuído", PROCESSES_AUTO_ASSIGNED: "Atribuição automática",
  PROCESSES_ASSIGNED_FROM_WALLETS: "Atribuição pelas carteiras", PROCESSES_TRANSFERRED: "Processos transferidos", TEMPORARY_TRANSFERS_RETURNED: "Transferências temporárias devolvidas",
  INVOICES_REMOVED_FROM_PROCESS: "Facturas retiradas do processo", CONTACT_CREATED: "Contacto registado",
  NEGOTIATION_CREATED: "Negociação criada", NEGOTIATION_APPROVED: "Negociação aprovada", NEGOTIATION_REJECTED: "Negociação rejeitada",
  NEGOTIATION_CANCELLED: "Negociação cancelada", NEGOTIATION_BROKEN: "Acordo quebrado", NEGOTIATIONS_AUTO_BROKEN: "Acordos quebrados (automático)",
  NEGOTIATION_RENEGOTIATED: "Renegociação",
  PAYMENT_REGISTERED: "Pagamento registado", PAYMENT_CONFIRMED: "Pagamento confirmado", PAYMENT_CANCELLED: "Pagamento anulado", PAYMENT_REVERSED: "Pagamento estornado",
  PAYMENT_METHOD_CREATED: "Método de pagamento criado", PAYMENT_METHOD_UPDATED: "Método de pagamento alterado",
  CURRENCY_CREATED: "Moeda criada", CURRENCY_UPDATED: "Moeda alterada",
  USER_PASSWORD_CHANGED: "Palavra-passe alterada", USER_PASSWORD_RESET_BY_ADMIN: "Palavra-passe reposta pelo administrador",
  ORGANIZATIONS_IMPORTED: "Credores importados", DEBTORS_IMPORTED: "Devedores importados", INVOICES_IMPORTED: "Facturas importadas",
  INVOICE_DOCUMENT_ATTACHED: "PDF anexado à factura", INVOICE_UPDATED: "Factura alterada", ORGANIZATION_UPDATED: "Credor alterado", INVOICE_DISPUTE_OPENED: "Disputa aberta", INVOICE_DISPUTE_RESOLVED: "Disputa resolvida",
  CONTACT_TYPE_CREATED: "Tipo de contacto criado",
  WALLET_DEBTOR_ADDED: "Devedor adicionado à carteira", WALLET_DEBTORS_REMOVED: "Devedores retirados da carteira", WALLET_DEBTORS_TRANSFERRED: "Devedores transferidos de carteira",
  ROLE_CREATED: "Perfil criado", ROLE_UPDATED: "Perfil alterado", ROLE_ENABLED: "Perfil activado", ROLE_DISABLED: "Perfil desactivado",
  ROLE_PERMISSION_ATTACHED: "Permissão dada ao perfil", ROLE_PERMISSION_DETACHED: "Permissão retirada ao perfil",
  LADDER_CREATED: "Régua criada", LADDER_UPDATED: "Régua alterada", LADDER_ACTIVATED: "Régua activada", LADDER_DEACTIVATED: "Régua desactivada",
  LADDER_ARCHIVED: "Régua arquivada", LADDER_STEPS_EXECUTED: "Etapas da régua executadas", LADDER_TASKS_OVERDUE: "Tarefas da régua em atraso",
  CREDITOR_COMMISSION_RATE_CHANGED: "Comissão do credor alterada", CREDITOR_SETTLEMENT_REGISTERED: "Liquidação ao credor registada",
  CREDITOR_SETTLEMENT_CONFIRMED: "Liquidação ao credor confirmada", CREDITOR_SETTLEMENT_CANCELLED: "Liquidação ao credor cancelada",
  OUTBOX_RETRY: "Reenvio de mensagens",
  COLLECTION_COST_CREATED: "Custo de cobrança lançado", COLLECTION_COST_UPDATED: "Custo de cobrança alterado", COLLECTION_COST_DELETED: "Custo de cobrança removido",
};
const ENTITY_LABELS: Record<string, string> = {
  user: "Utilizador", organization: "Credor", debtor: "Devedor", invoice: "Factura", process: "Processo", contact: "Contacto",
  negotiation: "Negociação", payment: "Pagamento", payment_method: "Método de pagamento", currency: "Moeda", creditor_settlement: "Repasse",
  creditor_account: "Conta-corrente", invoice_dispute: "Disputa", collection_ladder: "Régua de cobrança", role: "Perfil", permission: "Permissão", wallet: "Carteira",
  contact_type: "Tipo de contacto", outbox: "Fila de envios", import: "Importação", collection_cost: "Custo de cobrança",
};
const FIELD_LABELS: Record<string, string> = {
  reason: "Motivo", amount: "Valor", costDate: "Data do custo", category: "Categoria", categoryLabel: "Categoria", amountBase: "Valor em kwanzas", count: "Quantidade", ids: "Registos", status: "Estado", email: "Email",
  name: "Nome", fullName: "Nome", phoneNumber: "Telefone", address: "Morada", nif: "NIF", rate: "Taxa", commissionRate: "Comissão (%)",
  commissionAmount: "Comissão", previous: "Valor anterior", direction: "Sentido", balanceAfter: "Saldo depois",
  userId: "Utilizador", toUserId: "Para", fromUserId: "De", assignedUserId: "Atribuído a", managerId: "Gestor", createdById: "Registado por",
  registeredById: "Registado por", confirmedById: "Confirmado por", cancelledById: "Cancelado por", performedById: "Feito por",
  debtorId: "Devedor", debtor_id: "Devedor", debtorIds: "Devedores", organizationId: "Credor", organization_id: "Credor",
  currencyId: "Moeda", currency_id: "Moeda", roleId: "Perfil", role_id: "Perfil", permissionId: "Permissão",
  processId: "Processo", processe_id: "Processo", processIds: "Processos", invoiceId: "Factura", invoiceIds: "Facturas",
  negotiationId: "Negociação", installmentId: "Prestação", paymentMethodId: "Meio de pagamento", payment_method_id: "Meio de pagamento",
  debtorTypeId: "Tipo de devedor", typeDebtor_id: "Tipo de devedor", categoryId: "Categoria", contactTypeId: "Tipo de contacto",
  invoiceStateId: "Estado da factura", processStateId: "Estado do processo", ladderId: "Régua",
  referenceNumber: "Número da factura", reference: "Referência", dueDate: "Vencimento", issueDate: "Data de emissão",
  timeLimitDays: "Prazo de pagamento (dias)", documentPath: "Documento", proofPath: "Comprovativo", proof: "Comprovativo", fileName: "Ficheiro",
  finalAmount: "Valor acordado", totalAmount: "Valor total", discountRate: "Desconto (%)", exchangeRate: "Câmbio", receiver: "Recebido por",
  paidOn: "Pago em", settledOn: "Liquidado em", returnAt: "Devolver em", isPermanent: "Definitiva", permanent: "Definitiva",
  manual: "Manual", today: "Data", isActive: "Activo", isManager: "Perfil de gestão", requiresReference: "Exige referência",
  code: "Código", symbol: "Símbolo", description: "Descrição", notes: "Observações", moved: "Movidos", removed: "Removidos",
  imported: "Importados", failed: "Com erro", executed: "Executadas", notifications: "Notificações", executions: "Execuções",
  steps: "Etapas", fromVersion: "Versão anterior", version: "Versão", previousState: "Estado anterior", processesCreated: "Processos criados",
  invoicesLinked: "Facturas associadas", priority: "Prioridade", type: "Tipo", title: "Título", message: "Mensagem",
  socialReason: "Razão social", isCompany: "É empresa", logoPath: "Logótipo", contactName: "Pessoa de contacto",
  contactEmail: "Email da pessoa de contacto", contactContact: "Telefone da pessoa de contacto", contactPosition: "Cargo da pessoa de contacto",
  firstAccess: "Primeiro acesso", removedFromProcessId: "Retirada do processo", inProcess: "Em processo de cobrança", archivedAt: "Arquivada em", ownerUserId: "Responsável",
};
/** valores técnicos (enums) → português */
const VALUE_LABELS: Record<string, string> = {
  PENDING: "Pendente", PENDING_APPROVAL: "A aguardar aprovação", ACTIVE: "Activo", COMPLETED: "Concluído", CANCELLED: "Cancelado",
  REJECTED: "Rejeitado", BROKEN: "Quebrado", RENEGOTIATED: "Renegociado", CONFIRMED: "Confirmado", REVERSED: "Estornado",
  PAID: "Pago", PARTIALLY_PAID: "Pago parcialmente", OVERDUE: "Vencido", IN_PROGRESS: "Em curso", IN_DISPUTE: "Em disputa",
  STAFF: "Pessoal", COMMUNICATIONS: "Comunicações", TECHNOLOGY: "Tecnologia e sistemas", TRAVEL: "Deslocações", LEGAL: "Jurídico", OFFICE: "Instalações", OTHER: "Outros",
  AGENCY: "Agência", CREDITOR: "Credor", IN: "Entrada", OUT: "Saída", DEBTOR_RIGHT: "Razão ao devedor", CREDITOR_RIGHT: "Mantém-se a cobrança",
};
/** campos internos que não interessam a quem lê a auditoria */
const HIDDEN_FIELDS = new Set(["passwordHash", "tokenVersion", "id", "roleActive", "actionUrl", "data", "changedFields", "slug", "createdAt", "updatedAt"]);

const humanize = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const actionLabel = (a: string) => ACTION_LABELS[a] ?? humanize(a);
export const entityLabel = (e: string) => ENTITY_LABELS[e] ?? humanize(e);
export const actionOptions = (actions: string[]) => actions.map((a) => ({ value: a, label: actionLabel(a) })).sort((x, y) => x.label.localeCompare(y.label));
export const entityOptions = (entities: string[]) => entities.map((e) => ({ value: e, label: entityLabel(e) })).sort((x, y) => x.label.localeCompare(y.label));

export function actionStyle(a: string): { icon: LucideIcon; tone: Tone } {
  if (/FAILED/.test(a)) return { icon: ShieldAlert, tone: "danger" };
  if (/LOGIN/.test(a)) return { icon: LogIn, tone: "neutral" };
  if (/LOGOUT/.test(a)) return { icon: LogOut, tone: "neutral" };
  if (/REVERSED/.test(a)) return { icon: Undo2, tone: "danger" };
  if (/CANCELLED|REJECTED|BROKEN|DELETED|REMOVED/.test(a)) return { icon: XCircle, tone: "danger" };
  if (/DISABLED/.test(a)) return { icon: Power, tone: "warning" };
  if (/CONFIRMED|APPROVED|ENABLED|RESOLVED/.test(a)) return { icon: CheckCircle2, tone: "success" };
  if (/PAYMENT|SETTLEMENT/.test(a)) return { icon: Banknote, tone: "success" };
  if (/TRANSFER|ASSIGN|RETURNED/.test(a)) return { icon: ArrowRightLeft, tone: "info" };
  if (/PERMISSION|PASSWORD|ROLE/.test(a)) return { icon: KeyRound, tone: "warning" };
  if (/IMPORT/.test(a)) return { icon: FileUp, tone: "info" };
  if (/EXPORT/.test(a)) return { icon: FileDown, tone: "neutral" };
  if (/CREATED|REGISTERED|GENERATED/.test(a)) return { icon: Plus, tone: "success" };
  if (/DELETE/.test(a)) return { icon: Trash2, tone: "danger" };
  return { icon: Pencil, tone: "brand" };
}

/** Eventos sensíveis destacados na tabela. */
export const isSensitive = (a: string) => /REVERSED|CANCELLED|BROKEN|FAILED|DISABLED|PERMISSION|PASSWORD|REJECTED/.test(a);

export const fullDateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));

const toneCls: Record<Tone, string> = {
  neutral: "bg-soft text-muted", brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15", success: "bg-success-50 text-success-600 dark:bg-success-500/15",
  warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/15", danger: "bg-danger-50 text-danger-600 dark:bg-danger-500/15", info: "bg-sky-50 text-sky-600 dark:bg-sky-500/15",
};
export function ActionIcon({ action, size = "md" }: { action: string; size?: "sm" | "md" }) {
  const s = actionStyle(action);
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full ring-4 ring-[var(--surface)]", size === "sm" ? "h-7 w-7" : "h-8 w-8", toneCls[s.tone])}>
      <s.icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </span>
  );
}
export function ActionBadge({ action }: { action: string }) {
  const s = actionStyle(action);
  return <Badge tone={s.tone}><s.icon className="h-3 w-3" />{actionLabel(action)}</Badge>;
}

/* ───────── Valores do payload ───────── */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;
function fmt(key: string, v: unknown, ref?: string) {
  if (ref) return ref;
  if (v === null || v === undefined || v === "") return <span className="italic text-muted">vazio</span>;
  if (key === "documentPath" || key === "proofPath" || key === "proof" || key === "logoPath") return v ? "Anexado" : "Sem ficheiro";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (/amount|valor|total|credit|commissionAmount|balance|previous/i.test(key) && !isNaN(Number(v))) return formatMoney(v as string);
  if (typeof v === "string" && ISO_DATE.test(v)) return v.length > 10 ? fullDateTime(v) : formatDate(v);
  if (typeof v === "string" && VALUE_LABELS[v]) return VALUE_LABELS[v];
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "string") && (key === "steps" || v.length > 4)) return <span className="block space-y-0.5">{v.map((x, i) => <span key={i} className="block">{String(x)}</span>)}</span>;
    if (v.every((x) => typeof x !== "object")) { const t = v.map((x) => VALUE_LABELS[String(x)] ?? String(x)); return t.length > 8 ? `${t.slice(0, 8).join(", ")} … (+${t.length - 8})` : t.join(", "); }
    return `${v.length} registo(s)`;
  }
  if (typeof v === "object") return <SubList obj={v as Record<string, unknown>} />;
  return String(v);
}
function SubList({ obj }: { obj: Record<string, unknown> }) {
  const e = Object.entries(obj).filter(([k]) => !HIDDEN_FIELDS.has(k));
  return <span className="block space-y-0.5">{e.map(([k, x]) => <span key={k} className="block"><span className="text-muted">{label(k)}:</span> {fmt(k, x)}</span>)}</span>;
}
/** nome do campo em português; campos desconhecidos perdem o sufixo "Id" e são separados por espaços */
const label = (k: string) => FIELD_LABELS[k] ?? humanize(k.replace(/_?[Ii]ds?$/, "").replace(/([a-z])([A-Z])/g, "$1_$2"));

type Diff = { field: string; before: unknown; after: unknown };
/** Extrai alterações quando o payload traz { before, after } ou { changes: [...] }. */
export function payloadChanges(p: Record<string, unknown> | null): Diff[] {
  if (!p) return [];
  if (Array.isArray(p.changes)) return (p.changes as Diff[]).filter((c) => c && typeof c === "object" && "field" in c);
  const b = p.before as Record<string, unknown> | undefined, a = p.after as Record<string, unknown> | undefined;
  if (b && a && typeof b === "object" && typeof a === "object") {
    return [...new Set([...Object.keys(b), ...Object.keys(a)])]
      .filter((k) => !HIDDEN_FIELDS.has(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k]))
      .map((k) => ({ field: k, before: b[k], after: a[k] }));
  }
  return [];
}
const plainEntries = (p: Record<string, unknown> | null) =>
  Object.entries(p ?? {}).filter(([k]) => !["before", "after", "changes"].includes(k) && !HIDDEN_FIELDS.has(k));

export function ChangeTable({ changes, refs = {} }: { changes: Diff[]; refs?: Record<string, string> }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="grid grid-cols-3 gap-3 border-b bg-subtle px-4 py-2 text-xs font-medium text-muted"><span>Campo</span><span>Valor anterior</span><span>Novo valor</span></div>
      {changes.map((c) => (
        <div key={c.field} className="grid grid-cols-3 items-start gap-3 border-b px-4 py-2.5 text-sm last:border-0">
          <span className="font-medium">{label(c.field)}</span>
          <span className="min-w-0 break-words rounded bg-danger-50/70 px-2 py-0.5 text-danger-700 dark:bg-danger-500/10">{fmt(c.field, c.before, refs[`before.${c.field}`])}</span>
          <span className="min-w-0 break-words rounded bg-success-50/70 px-2 py-0.5 text-success-700 dark:bg-success-500/10">{fmt(c.field, c.after, refs[`after.${c.field}`])}</span>
        </div>
      ))}
    </div>
  );
}

export const changeCount = (l: AuditLog) => payloadChanges(l.payload).length || plainEntries(l.payload).length;
/** texto curto para a tabela: "3 alterações" quando há antes/depois, senão "2 campos" */
export const changeSummary = (l: AuditLog) => {
  const d = payloadChanges(l.payload).length;
  if (d) return `${d} ${d === 1 ? "alteração" : "alterações"}`;
  const n = plainEntries(l.payload).length;
  return n ? `${n} ${n === 1 ? "campo" : "campos"}` : "";
};

export function AuditDetailDrawer({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  const changes = log ? payloadChanges(log.payload) : [];
  const entries = log ? plainEntries(log.payload) : [];
  return (
    <Drawer open={!!log} onClose={onClose} width="max-w-2xl" title={log ? actionLabel(log.action) : ""}
      description={log && <span>{entityLabel(log.entity)}{log.entityLabel ? ` · ${log.entityLabel}` : ""}</span>}>
      {log && (
        <div className="space-y-6">
          <div className="flex items-start gap-3">
            <ActionIcon action={log.action} />
            <div className="min-w-0 flex-1">
              <p className="text-sm"><b>{log.actorName ?? log.actorEmail ?? "Sistema"}</b> <span className="text-muted">— {actionLabel(log.action).toLowerCase()}</span></p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ActionBadge action={log.action} />
                <Badge>{entityLabel(log.entity)}{log.entityLabel ? `: ${log.entityLabel}` : log.entityId ? ` n.º ${log.entityId}` : ""}</Badge>
                {isSensitive(log.action) && <Badge tone="danger" dot>Sensível</Badge>}
              </div>
            </div>
          </div>

          {changes.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold">O que mudou <span className="font-normal text-muted">· {changes.length} {changes.length === 1 ? "campo" : "campos"}</span></h3>
              <ChangeTable changes={changes} refs={log.references} />
            </div>
          )}
          {(entries.length > 0 || changes.length === 0) && <div>
            <h3 className="mb-3 text-sm font-semibold">{changes.length ? "Outros dados" : "Dados registados"}</h3>
            {entries.length ? (
              <div className="overflow-hidden rounded-xl border">
                {entries.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[160px_1fr] gap-3 border-b px-4 py-2.5 text-sm last:border-0">
                    <span className="text-muted">{label(k)}</span><span className="min-w-0 break-words font-medium">{fmt(k, v, log.references?.[k])}</span>
                  </div>
                ))}
              </div>
            ) : changes.length ? null : <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted">
              {Array.isArray(log.payload?.changedFields) ? "Foi guardado sem alterar nenhum campo." : "Este evento não tem dados adicionais."}
            </p>}
          </div>}

          <div>
            <h3 className="mb-3 text-sm font-semibold">Quem, quando e onde</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Tile label="Utilizador" value={log.actorName ?? "Sistema (processo automático)"} sub={log.actorName ? `${log.actorRole ?? ""} · ${log.actorEmail ?? ""}` : undefined} avatar={log.actorName ?? undefined} />
              <Tile icon={Clock} label="Data e hora" value={fullDateTime(log.createdAt)} />
              <Tile icon={MapPin} label="Endereço IP" value={log.ip ?? "—"} mono />
              <Tile icon={ArrowRight} label="Referência do pedido (suporte)" value={log.requestId ? log.requestId.slice(0, 8) : "—"} mono />
            </div>
          </div>
          <p className="text-xs text-muted">Os registos de auditoria são imutáveis: não podem ser editados nem eliminados.</p>
        </div>
      )}
    </Drawer>
  );
}

function Tile({ label, value, sub, icon: Icon, mono, avatar }: { label: string; value: string; sub?: string; icon?: LucideIcon; mono?: boolean; avatar?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-3">
      {avatar ? <Avatar name={avatar} size="sm" /> : Icon ? <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-soft text-muted"><Icon className="h-3.5 w-3.5" /></span> : null}
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className={cn("truncate text-sm font-medium", mono && "font-mono text-xs")}>{value}</p>
        {sub && <p className="truncate text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}

/** Histórico de uma entidade (ex: ficha do devedor, negociação). */
export function ActivityTimeline({ entity, entityId, onOpen }: { entity: string; entityId: number | string; onOpen?: (l: AuditLog) => void }) {
  const { data, loading, error } = useQuery(() => auditService.list({ entity, entityId: String(entityId), perPage: 50 }), [entity, entityId]);
  if (loading && !data) return <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>;
  if (error) return <EmptyState icon={<Clock />} title="Histórico indisponível" description={error} />;
  if (!data?.data.length) return <EmptyState icon={<Clock />} title="Sem histórico" description="Ainda não há eventos registados para este registo." />;
  return (
    <ol className="relative p-5 before:absolute before:top-8 before:bottom-8 before:left-[34px] before:w-px before:bg-[var(--border)]">
      {data.data.map((l) => (
        <li key={l.id} className="relative flex gap-3 pb-4 last:pb-0">
          <ActionIcon action={l.action} size="sm" />
          <button onClick={() => onOpen?.(l)} className="min-w-0 flex-1 rounded-xl px-2 py-1 text-left hover:bg-subtle">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm"><b>{actionLabel(l.action)}</b> <span className="text-muted">por {l.actorName ?? "Sistema"}</span></p>
              <span className="shrink-0 text-xs text-muted" title={fullDateTime(l.createdAt)}>{formatDate(l.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

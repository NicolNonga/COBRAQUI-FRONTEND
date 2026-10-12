// Contratos da API Cobra Aqui (NestJS). Valores monetários chegam como string decimal ("1234.50").

export interface Pagination {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  firstPage: number;
}
export interface Paginated<T> {
  meta: Pagination;
  data: T[];
}
export interface ListParams {
  page?: number;
  perPage?: number;
  search?: string;
  sort?: string;
  [key: string]: string | number | boolean | undefined | null;
}
export type Money = string;
export type ISODate = string;

/* ───────── Acesso ───────── */
export interface Permission {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  /** área funcional (ex.: "Devedores") */
  group?: string;
  createdAt?: ISODate;
}
export interface PermissionGroup { group: string; permissions: Permission[] }
export interface Role {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isManager: boolean;
  createdAt?: ISODate;
  updatedAt?: ISODate;
  permissions?: Permission[];
}
export interface Category { id: number; name: string; isActive: boolean; createdAt?: ISODate }
export interface Organization {
  id: number;
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  logoPath: string | null;
  isActive: boolean;
  createdAt: ISODate;
  updatedAt?: ISODate;
}
export interface User {
  id: number;
  fullName: string | null;
  email: string;
  phoneNumber: string | null;
  roleId: number | null;
  organizationId: number | null;
  categoryId: number | null;
  isActive: boolean;
  firstAccess: boolean;
  createdAt: ISODate;
  updatedAt?: ISODate;
  role?: Role | null;
  organization?: Organization | null;
  category?: Category | null;
  permissions?: string[];
}
export type UserRef = Pick<User, "id" | "fullName" | "email">;

/* ───────── Catálogos ───────── */
export interface Currency { id: number; name: string; code: string; symbol: string; isActive: boolean }
export interface DebtorType { id: number; name: string; description: string | null; isCompany: boolean }
export interface ContactType { id: number; name: string; description: string | null; createdAt?: ISODate }
export type InvoiceStateCode = "PENDING" | "IN_PROGRESS" | "IN_DISPUTE" | "PAID" | "PARTIALLY_PAID" | "CANCELLED" | "OVERDUE";
export type ProcessStateCode = "REGISTERED" | "ASSIGNED" | "IN_PROGRESS" | "PENDING" | "CANCELLED" | "FINISHED";
export interface StateRef<C extends string = string> { id: number; code: C; name: string }

/* ───────── Devedores ───────── */
export interface ContactPerson { id: number; debtorId: number; name: string; email: string; contact: string; position: string }
export interface Debtor {
  id: number;
  name: string;
  nif: string | null;
  email: string;
  phoneNumber: string;
  address: string;
  logoPath: string | null;
  socialReason: string | null;
  isCompany: boolean;
  isActive: boolean;
  organizationId: number;
  debtorTypeId: number;
  createdAt: ISODate;
  organization?: Organization;
  debtorType?: DebtorType;
  contactPerson?: ContactPerson | null;
}
export interface DebtorDashboard { totalDebtors: number; totalDebtorsActive: number; totalDebtorCompany: number; totalDebtorParticular: number }

/* ───────── Facturas ───────── */
export interface Invoice {
  id: number;
  referenceNumber: string;
  amount: Money;
  issueDate: ISODate;
  timeLimitDays: number;
  dueDate: ISODate;
  documentPath: string | null;
  inProcess: boolean;
  debtorId: number;
  currencyId: number;
  invoiceStateId: number;
  createdById: number;
  createdAt: ISODate;
  overdueDays?: number;
  debtor?: Debtor;
  currency?: Currency;
  invoiceState?: StateRef<InvoiceStateCode>;
  createdBy?: UserRef;
}

/* ───────── Processos e contactos ───────── */
export const CONTACT_STATUSES = ["attempted", "answered", "negotiation_started", "no_answer", "failed", "pending"] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export interface Process {
  id: number;
  debtorId: number;
  processStateId: number;
  startDate: ISODate | null;
  endDate: ISODate | null;
  closedAt: ISODate | null;
  lastContactAt: ISODate | null;
  lastContactStatus: ContactStatus | null;
  contactsCount: number;
  createdAt: ISODate;
  debtor?: Debtor;
  processState?: StateRef<ProcessStateCode>;
  assignment?: { id: number; processId: number; userId: number; user?: UserRef } | null;
  invoices?: Invoice[];
  invoicesCount?: number;
  totalAmount?: Money;
  /** já preso a um acordo activo ou à espera de aprovação: não pode entrar noutro */
  inNegotiation?: boolean;
}
export interface ProcessInvoiceLink { id: number; processId: number; invoiceId: number; createdAt: ISODate; invoice?: Invoice }
export interface Contact {
  id: number;
  processId: number;
  userId: number;
  contactTypeId: number;
  status: ContactStatus;
  contactDate: ISODate | null;
  contactedAt: ISODate;
  durationSeconds: number | null;
  notes: string | null;
  createdAt: ISODate;
  contactType?: ContactType;
  user?: UserRef;
}

/* ───────── Negociações ───────── */
export const NEGOTIATION_STATUSES = ["PENDING_APPROVAL", "ACTIVE", "REJECTED", "CANCELLED", "COMPLETED", "BROKEN", "RENEGOTIATED"] as const;
export type NegotiationStatus = (typeof NEGOTIATION_STATUSES)[number];
export type InstallmentStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
export type InstallmentPaymentState = "PAID" | "PARTIALLY_PAID" | "UNPAID" | "CANCELLED";

export interface NegotiationListItem {
  id: number;
  status: NegotiationStatus;
  /** valor original da dívida (antes do desconto) */
  debtAmount: Money;
  totalAmount: Money;
  finalAmount: Money;
  discountRate: string;
  isInstallment: boolean;
  totalInstallments: number | null;
  effectiveDate: ISODate;
  startDate: ISODate;
  endDate: ISODate;
  createdAt: ISODate;
  processesCount: number;
  debtor: { name: string; nif: string | null } | null;
}
export interface Installment {
  id: number;
  negotiationId: number;
  installmentNumber: number;
  amount: Money;
  percentage: string;
  dueDate: ISODate;
  penaltyPercentage: string;
  status: InstallmentStatus;
  paidAt: ISODate | null;
  paidAmount: Money;
  pendingAmount: Money;
  remainingAmount: Money;
  paymentState: InstallmentPaymentState;
}
export interface NegotiationDetail {
  id: number;
  debtAmount: Money;
  discountAmount: Money;
  discountRate: string;
  totalAmount: Money;
  finalAmount: Money;
  effectiveDate: ISODate;
  startDate: ISODate;
  endDate: ISODate;
  isInstallment: boolean;
  isEqualInstallments: boolean;
  totalInstallments: number | null;
  status: NegotiationStatus;
  notes: string | null;
  createdById: number | null;
  previousNegotiationId: number | null;
  authorizedById: number | null;
  approvedAt: ISODate | null;
  rejectedAt: ISODate | null;
  rejectionReason: string | null;
  startedAt: ISODate | null;
  completedAt: ISODate | null;
  brokenAt: ISODate | null;
  breakReason: string | null;
  cancelledAt: ISODate | null;
  renegotiatedAt: ISODate | null;
  createdAt: ISODate;
  processes?: { id: number; processId: number; isActive: boolean; process?: Process }[];
  installments?: Installment[];
  paymentTotals: {
    finalAmount: Money;
    paidAmount: Money;
    pendingAmount: Money;
    remainingAmount: Money;
    creditGenerated: Money;
    progressPercent: string;
    pendingPayments: number;
    confirmedPayments: number;
  };
}
export interface InstallmentInput {
  installmentNumber: number;
  installmentAmount: Money;
  installmentPercentage: string;
  dueDate: ISODate;
  penaltyPercentage: string;
}
export interface RenegotiationBalance {
  principal: Money;
  penalty: Money;
  interest: Money;
  total: Money;
  lines: { installmentNumber: number | null; dueDate: ISODate | null; daysLate: number; principal: Money; penalty: Money; interest: Money; total: Money }[];
}

/* ───────── Pagamentos ───────── */
export type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "REVERSED";
export type PaymentReceiver = "CREDITOR" | "AGENCY";
export interface PaymentMethod { id: number; name: string; description: string | null; requiresReference: boolean; isActive: boolean }
export interface Payment {
  id: string;
  negotiationId: number;
  installmentId: number | null;
  debtorId: number;
  organizationId: number;
  receiver: PaymentReceiver;
  amount: Money;
  currencyId: number;
  exchangeRate: string;
  amountBase: Money;
  paymentMethodId: number;
  paidOn: ISODate;
  reference: string | null;
  notes: string | null;
  status: PaymentStatus;
  commissionRate: string | null;
  commissionAmount: Money | null;
  creditAmount: Money | null;
  registeredById: number;
  confirmedById: number | null;
  confirmedAt: ISODate | null;
  cancelledAt: ISODate | null;
  cancelReason: string | null;
  reversedAt: ISODate | null;
  reverseReason: string | null;
  createdAt: ISODate;
  paymentMethod?: PaymentMethod;
  currency?: Currency;
  registeredBy?: Pick<User, "id" | "fullName">;
  allocations?: { id: string; installmentId: number | null; installmentNumber: number | null; amount: Money; paidOn: ISODate; reversedAt: ISODate | null }[];
}
export interface DebtorCredit {
  debtorId: number;
  balance: Money;
  meta: Pagination;
  data: { id: string; kind: "OVERPAYMENT" | "REVERSAL" | "APPLIED"; amount: Money; description: string; negotiationId: number | null; paymentId: string | null; createdAt: ISODate }[];
}

/* ───────── Conta-corrente dos credores ───────── */
export interface CreditorBalance {
  organizationId: number;
  organizationName: string;
  commissionRate: string;
  balance: Money;
  collected: Money;
  commission: Money;
  settled: Money;
  pendingToCreditor: Money;
  pendingFromCreditor: Money;
}
export interface LedgerLine { id: string; organizationId: number; kind: "COLLECTED" | "COMMISSION" | "SETTLEMENT"; amount: Money; paymentId: string | null; settlementId: string | null; reversalOfId: string | null; description: string; createdAt: ISODate }
export type SettlementDirection = "TO_CREDITOR" | "FROM_CREDITOR";
export type SettlementStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
export interface Settlement {
  id: string;
  organizationId: number;
  organizationName?: string;
  direction: SettlementDirection;
  amount: Money;
  settledOn: ISODate;
  paymentMethodId: number;
  paymentMethodName?: string;
  reference: string | null;
  notes: string | null;
  status: SettlementStatus;
  registeredById: number;
  confirmedAt: ISODate | null;
  cancelledAt: ISODate | null;
  cancelReason: string | null;
  createdAt: ISODate;
}

/* ───────── Disputas ───────── */
export type DisputeStatus = "OPEN" | "RESOLVED";
export type DisputeOutcome = "UPHELD" | "CANCELLED" | "ADJUSTED";
export interface Dispute {
  id: string;
  invoiceId: number;
  processId: number | null;
  reason: string;
  status: DisputeStatus;
  outcome: DisputeOutcome | null;
  originalAmount: Money;
  adjustedAmount: Money | null;
  resolutionNotes: string | null;
  openedAt: ISODate;
  resolvedAt: ISODate | null;
  invoiceReference: string;
  invoiceAmount: Money;
  invoiceDueDate: ISODate;
  debtorId: number;
  debtorName: string;
  organizationId: number;
  organizationName: string;
  openedByName: string | null;
  daysOpen: number;
}

/* ───────── Régua de cobrança ───────── */
export const LADDER_ACTIONS = ["CONTACT_REMINDER", "NEGOTIATION_SUGGESTION", "ESCALATION", "CUSTOM_ALERT"] as const;
export type LadderAction = (typeof LADDER_ACTIONS)[number];
export type LadderRecipients = "AGENT" | "MANAGER" | "BOTH";
export type Priority = "low" | "medium" | "high";
export interface LadderStep {
  id?: number;
  dayOffset: number;
  actionType: LadderAction;
  recipients: LadderRecipients;
  priority: Priority;
  title: string;
  messageTemplate: string;
  fulfillmentDays: number | null;
  /** mensagem enviada ao devedor neste passo */
  debtorChannel?: DebtorChannel;
  debtorSubject?: string | null;
  debtorMessageTemplate?: string | null;
}
export type DebtorChannel = "NONE" | "EMAIL" | "SMS" | "EMAIL_SMS";
export interface Ladder {
  id: number;
  ownerUserId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
  archivedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  steps?: LadderStep[];
  executions?: number;
  /** false = deixou de cumprir a régua master: o motor ignora-a até ser corrigida */
  policyCompliant?: boolean;
  policyVersion?: number | null;
  policyViolations?: PolicyViolation[] | null;
}
export interface PolicyViolation { code: string; message: string; dayOffset?: number }
export interface PolicyRule { actionType: LadderAction; minDay: number; maxDay: number; maxFulfillmentDays: number | null; required: boolean }
/** Régua master: limites que todas as réguas têm de cumprir */
export interface CollectionPolicy {
  name: string;
  description: string | null;
  version: number;
  graceDays: number;
  maxCollectionDays: number;
  maxSteps: number;
  maxContactsPerProcess: number | null;
  allowedDebtorChannels: Array<"EMAIL" | "SMS">;
  minDaysBetweenDebtorMessages: number;
  rules: PolicyRule[];
  updatedAt: ISODate;
  skeleton?: Array<{ dayOffset: number; actionType: LadderAction; fulfillmentDays: number | null }>;
}
export interface LadderPreviewRow {
  processId: number;
  stepId: number;
  day: number;
  actionType: LadderAction;
  recipients: LadderRecipients;
  priority: Priority;
  title: string;
  debtorName: string;
  totalAmount: Money;
  invoicesCount: number;
  alreadyExecuted: boolean;
  message: string;
  debtorChannel?: DebtorChannel;
  debtorMessage?: string | null;
  debtorSubject?: string | null;
  debtorEmail?: string | null;
  debtorPhone?: string | null;
}
export type LadderTaskStatus = "PENDING" | "FULFILLED" | "OVERDUE" | "VOID";
export interface LadderTask {
  id: string;
  processId: number;
  debtorName: string;
  ladderId: number;
  stepId: number;
  title: string;
  actionType: LadderAction;
  processDay: number;
  executedAt: ISODate;
  dueOn: ISODate;
  status: LadderTaskStatus;
  fulfilledAt: ISODate | null;
  fulfilledLate: boolean | null;
  escalatedAt: ISODate | null;
  agentId: number | null;
  agentName: string | null;
}
export interface ComplianceRow {
  agentId: number | null;
  agentName: string | null;
  tracked: number;
  fulfilledOnTime: number;
  fulfilledLate: number;
  overdue: number;
  pending: number;
  voided: number;
  complianceRate: string | null;
}

/* ───────── Painel ───────── */
export interface DashboardFacts {
  inCollection: Money;
  openProcesses: number;
  placed: Money;
  placedProcesses: number;
  recovered: Money;
  recoveredPayments: number;
  pendingConfirmation: Money;
  successRate: string | null;
}
export interface DashboardSummary extends DashboardFacts {
  period: { from: ISODate; to: ISODate };
  scope: string;
  currency: string;
  monthly: { month: string; placed: Money; recovered: Money }[];
}
export interface AgentFacts extends DashboardFacts { agentId: number | null; agentName: string | null }
export interface CreditorFacts extends DashboardFacts { organizationId: number; organizationName: string; commissionRate: string }

/* ───────── Notificações ───────── */
export interface AppNotification {
  id: string;
  userId: number;
  type: string;
  title: string | null;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: ISODate | null;
  priority: Priority;
  actionUrl: string | null;
  createdAt: ISODate;
}

/* ───────── Auditoria ───────── */
export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorId: number | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  requestId: string | null;
  ip: string | null;
  payload: Record<string, unknown> | null;
  createdAt: ISODate;
  /** nome legível do registo afectado (ex.: "FT 009483"), resolvido pelo backend */
  entityLabel?: string | null;
  /** ids do payload já traduzidos em nomes: { "debtorId": "João Manuel", "before.currencyId": "Kwanza (AOA)" } */
  references?: Record<string, string>;
}
export interface AuditStats { events: number; users: number; logins: number; financial: number; actions: string[]; entities: string[] }

/* ───────── Outbox ───────── */
export type OutboxStatus = "PENDING" | "PROCESSING" | "SENT" | "DEAD";
export interface OutboxMessage {
  id: string;
  type: string;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: ISODate;
  lastError: string | null;
  requestId: string | null;
  createdAt: ISODate;
  processedAt: ISODate | null;
  encrypted: boolean;
}

/* ───────── Importações ───────── */
export interface ImportResult { imported: number; total: number; failed?: number; errorReport?: string | null; batchId?: number | null; [k: string]: unknown }

/* ───────── Histórico de importações ───────── */
export type ImportKind = "ORGANIZATIONS" | "DEBTORS" | "INVOICES" | "INVOICE_PDFS";
export type ImportStatus = "SUCCESS" | "PARTIAL" | "FAILED";
export interface ImportRowError { rowNumber: number; errors: string[]; label?: string }
export interface ImportBatch {
  id: number;
  kind: ImportKind;
  status: ImportStatus;
  fileName: string;
  fileSize: number;
  hasFile: boolean;
  hasErrorReport: boolean;
  total: number;
  imported: number;
  failed: number;
  message: string | null;
  durationMs: number | null;
  createdById: number | null;
  createdByName: string | null;
  createdAt: string;
}
export interface ImportBatchDetail extends ImportBatch { errors: ImportRowError[] }
export interface ImportStats { batches: number; imported: number; failed: number; withErrors: number }
export interface SheetPreview {
  sheetName: string;
  headers: string[];
  rows: { rowNumber: number; cells: string[] }[];
  totalRows: number;
  truncated: boolean;
  errorsByRow: Record<number, string[]>;
}

/* ───────── Documentos (módulo ainda sem backend – armazenamento local) ───────── */
export type DocumentCategory = "invoice" | "contract" | "agreement" | "receipt" | "notice" | "power_of_attorney" | "identification" | "legal" | "other";
export interface DocumentVersion { version: number; size: number; uploadedBy: string; createdAt: string; note?: string }
export interface DocumentFile {
  id: number;
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  category: DocumentCategory;
  tags: string[];
  favorite: boolean;
  link: { type: "debtor" | "invoice" | "process" | "negotiation"; id: number; label: string } | null;
  debtorId: number | null;
  uploadedBy: { id: number; fullName: string };
  version: number;
  versions: DocumentVersion[];
  url?: string | null;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** Dívida de um devedor: facturas ainda não liquidadas nem anuladas. */
export interface DebtorDebtSummary {
  totalDebt: Money;
  overdueDebt: Money;
  paidAmount: Money;
  openInvoices: number;
  overdueInvoices: number;
}

/* ───────── Integração com o ERP ───────── */
export type ErpProvider = "SAP_S4" | "SAP_B1" | "FILE" | "SANDBOX";
export type IntegrationStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ERROR";
export type IntegrationRunMode = "DELTA" | "FULL" | "DRY_RUN";
export type IntegrationRunStatus = "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
export type IntegrationReviewStatus = "OPEN" | "RESOLVED" | "IGNORED";
export interface IntegrationRun {
  id: number;
  trigger: "SCHEDULE" | "MANUAL";
  mode: IntegrationRunMode;
  provider: string;
  status: IntegrationRunStatus;
  startedAt: ISODate;
  finishedAt: ISODate | null;
  counters: Record<string, number>;
  report: { externalId?: string; action: string; message: string }[];
  error: string | null;
  triggeredByName?: string | null;
}
export interface Integration {
  provider: ErpProvider;
  status: IntegrationStatus;
  config: Record<string, unknown>;
  hasCredentials: boolean;
  autoClose: boolean;
  importDebtors: boolean;
  intervalMinutes: number;
  nextRunAt: ISODate | null;
  lastRunAt: ISODate | null;
  lastSuccessAt: ISODate | null;
  consecutiveFailures: number;
  version: number;
  companies: { companyCode: string; organizationId: number; organizationName?: string }[];
  providers: { provider: ErpProvider; label: string; available: boolean }[];
  openReviews: number;
  lastRun: IntegrationRun | null;
}
export interface IntegrationTestResult { ok: boolean; durationMs: number; companyCodes: string[]; openInvoices: number | null; details?: string; newCreditors: string[] }
export interface IntegrationReview {
  id: number;
  kind: string;
  status: IntegrationReviewStatus;
  summary: string;
  externalId: string;
  invoiceId: number | null;
  processId: number | null;
  invoiceReference?: string | null;
  debtorName?: string | null;
  resolution: string | null;
  resolvedByName?: string | null;
  createdAt: ISODate;
}

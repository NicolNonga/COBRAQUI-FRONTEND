// Serviços da API Cobra Aqui (NestJS). Um objecto por módulo; nomes de campos iguais aos DTOs do backend.
import { ApiError, blobUrlProtected, downloadProtected, http, openProtected, toFormData, type Query } from "@/lib/api/http";
import type {
  AgentFacts, AppNotification, AuditLog, AuditStats, Category, ComplianceRow, Contact, ContactStatus, ContactType, CreditorBalance,
  CreditorFacts, Currency, ImportBatch, ImportBatchDetail, ImportKind, ImportStats, ImportStatus, SheetPreview, DashboardSummary, Debtor, DebtorCredit, DebtorDashboard, DebtorType, Dispute, DisputeOutcome, ImportResult,
  CollectionPolicy, Integration, IntegrationReview, IntegrationReviewStatus, IntegrationRun, IntegrationRunMode, IntegrationTestResult, InstallmentInput, Invoice, Ladder, LadderPreviewRow, LadderStep, LadderTask, LedgerLine, ListParams, NegotiationDetail,
  DebtorDebtSummary, NegotiationListItem, Organization, OutboxMessage, OutboxStatus, Paginated, Pagination, Payment, PaymentMethod, PaymentReceiver,
  Permission, PermissionGroup, Process, ProcessInvoiceLink, RenegotiationBalance, Role, Settlement, SettlementDirection, StateRef, User, UserRef,
} from "@/types/models";

type Data<T> = { data: T };
type Msg = { message: string };
const unwrap = <T,>(r: Data<T>) => r.data;
const q = (p: object) => p as Query;

/* ───────────────────────────── Autenticação ───────────────────────────── */
export interface LoginResponse { token: { type: string; token: string; expiresIn: string }; user: User & { permissions: string[] } }
export const authService = {
  login: (email: string, password: string) => http.post<Data<LoginResponse>>("auth", { email, password }).then(unwrap),
  logout: () => http.post<Msg>("auth/logout"),
  me: () => http.get<Data<User & { permissions: string[] }>>("auth/me").then(unwrap),
  forgotPassword: (email: string) => http.post<Msg>("forget_password", { email }),
  resetPassword: (token: string, newPassword: string) => http.post<Msg>("reset_password", { token, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) => http.put<Msg>("users/new_password", { currentPassword, newPassword }),
};

/* ───────────────────────────── Utilizadores e equipa ───────────────────────────── */
export interface UserPermissions { userId: number; role: { id: number; name: string; isActive: boolean } | null; fromRole: string[]; granted: string[] }
export interface UserPayload { fullName?: string | null; email: string; phone_number?: string; roleId: number; categorie_id?: number; organizationId?: number; managerId?: number }
export const userService = {
  list: (p: ListParams & { roleId?: number; organizationId?: number; categoryId?: number; isActive?: boolean }) => http.get<Paginated<User>>("users", q(p)),
  dropdown: () => http.get<Data<UserRef[]>>("users/dropDownList").then(unwrap),
  managers: () => http.get<Data<UserRef[]>>("users/dropDownListMangers").then(unwrap),
  create: (p: UserPayload) => http.post<Msg & { id: number }>("users", p),
  update: (id: number, p: Omit<UserPayload, "managerId" | "organizationId">) => http.put<Msg>(`users/${id}`, p),
  setActive: (id: number, active: boolean) => http.put<Msg>(`users/${id}/${active ? "enable" : "desable"}`),
  adminResetPassword: (id: number) => http.put<Msg>(`users/${id}/redefinar_senha`),
  myAgents: () => http.get<User[]>("user_wallet/list_agents_by_Manger"),
  myAgentsPaged: (p: ListParams) => http.get<Paginated<User>>("user_wallet/manager", q(p)),
  /** permissões do perfil + as dadas só a este utilizador */
  permissions: (id: number) => http.get<Data<UserPermissions>>(`users/${id}/permissions`).then(unwrap),
  setPermissions: (id: number, permissions: string[]) => http.put<Msg & { data: { added: string[]; removed: string[] } }>(`users/${id}/permissions`, { permissions }),
};

/* ───────────────────────────── Perfis e permissões ───────────────────────────── */
export const roleService = {
  list: (p: ListParams = { perPage: 100 }) => http.get<Paginated<Role>>("roles", q(p)),
  dropdown: () => http.get<Data<Role[]>>("roles/list-dropdown").then(unwrap),
  create: (p: { name: string; description?: string; isManager?: boolean }) => http.post<Msg & { data: Role }>("roles", p),
  update: (id: number, p: { name: string; description?: string; isManager?: boolean }) => http.put<Msg>(`roles/${id}`, p),
  setActive: (id: number, active: boolean) => http.put<Msg>(`roles/${id}/${active ? "enable" : "desable"}`),
  attach: (roleId: number, permissionId: number) => http.post<Msg>("roles_permission", { role_id: roleId, permission_id: permissionId }),
  detach: (roleId: number, permissionId: number) => http.put<Msg>("roles_permission", { role_id: roleId, permission_id: permissionId }),
  /** aplica a diferença (associa/remove) entre as permissões actuais e as desejadas */
  async syncPermissions(roleId: number, current: number[], desired: number[]) {
    const add = desired.filter((id) => !current.includes(id));
    const remove = current.filter((id) => !desired.includes(id));
    for (const id of add) await roleService.attach(roleId, id);
    for (const id of remove) await roleService.detach(roleId, id);
    return { added: add.length, removed: remove.length };
  },
};
/** Permissões são só de leitura: vêm do catálogo do backend e associam-se a perfis. */
export const permissionService = {
  list: (p: ListParams = { perPage: 100 }) => http.get<Paginated<Permission>>("permission", q(p)),
  /** agrupadas por área; se o servidor ainda não tiver a rota, agrupa a lista simples */
  grouped: () =>
    http.get<Data<PermissionGroup[]>>("permission/grouped").then(unwrap).catch(async (e) => {
      if (!(e instanceof ApiError) || e.status !== 404) throw e;
      const all = await http.get<Permission[] | Data<Permission[]>>("permission/drop-down-list");
      const list = (Array.isArray(all) ? all : all.data).filter((p) => p.isActive);
      const map = new Map<string, Permission[]>();
      for (const p of list) map.set(p.group ?? "Permissões", [...(map.get(p.group ?? "Permissões") ?? []), p]);
      return [...map].map(([group, permissions]) => ({ group, permissions }));
    }),
};

/* ───────────────────────────── Catálogos ───────────────────────────── */
export const catalogService = {
  currencies: (p: ListParams = { perPage: 100 }) => http.get<Paginated<Currency>>("curriency", q(p)),
  currenciesDropdown: () => http.get<Data<Currency[]>>("curriency/dropdown").then(unwrap),
  categories: (p: ListParams = { perPage: 100 }) => http.get<Paginated<Category>>("category", q(p)),
  categoriesDropdown: () => http.get<Data<Category[]>>("category/dropdown").then(unwrap),
  debtorTypes: (p: ListParams = { perPage: 100 }) => http.get<Paginated<DebtorType>>("type_debtor", q(p)),
  debtorTypesDropdown: () => http.get<Data<DebtorType[]>>("type_debtor/dropdown").then(unwrap),
  contactTypes: (p: ListParams = { perPage: 100 }) => http.get<Paginated<ContactType>>("contact_type", q(p)),
  createContactType: (p: { name: string; description?: string }) => http.post<Msg & { id: number }>("contact_type", p),
  invoiceStates: () => http.get<Data<StateRef[]>>("invoice_states/dropdown").then(unwrap),
  processStates: () => http.get<Data<StateRef[]>>("process_states/dropdown").then(unwrap),
};

/* ───────────────────────────── Organizações (credores) ───────────────────────────── */
export const organizationService = {
  list: (p: ListParams & { isActive?: boolean }) => http.get<Paginated<Organization>>("organization", q(p)),
  dropdown: () => http.get<Data<Pick<Organization, "id" | "name">[]>>("organization/dropdown").then(unwrap),
  create: (p: { name: string; email: string; phone_number: string; address: string; file?: File | null }) => http.post<Msg & { data: Organization }>("organization", toFormData(p)),
  update: (id: number, p: { name: string; email: string; phone_number: string; address: string; file?: File | null }) => http.put<Msg>(`organization/${id}`, toFormData(p)),
  setActive: (id: number, active: boolean) => http.put<Msg>(`organization/${active ? "enable" : "desable"}/${id}`),
};

/* ───────────────────────────── Devedores ───────────────────────────── */
export interface DebtorPayload {
  name: string; nif: string; email: string; phone_number: string; address: string; social_reason?: string;
  organizationId: number; typeDebtor_id: number; is_company: boolean;
  contact_person_name: string; contact_person_email: string; contact_person_contact: string; contact_person_position: string;
  file?: File | null;
}
export type DebtorQuery = ListParams & { organizationId?: number; debtorTypeId?: number; isActive?: boolean; isCompany?: boolean; createdFrom?: string; createdTo?: string };
export const debtorService = {
  list: (p: DebtorQuery) => http.get<Paginated<Debtor>>("debtors", q(p)),
  dashboard: () => http.get<Data<DebtorDashboard>>("debtors/dashboard").then(unwrap),
  /** dívida do devedor: em aberto, vencida e já liquidada */
  debt: (id: number) => http.get<Data<DebtorDebtSummary>>(`debtors/${id}/debt`).then(unwrap),
  dropdown: () => http.get<Data<Pick<Debtor, "id" | "name">[]>>("debtors/dropdown").then(unwrap),
  /** O backend não tem GET /debtors/:id — procura pelo id na listagem. */
  async get(id: number): Promise<Debtor> {
    for (let page = 1; page <= 50; page++) {
      const r = await debtorService.list({ page, perPage: 100 });
      const d = r.data.find((x) => x.id === id);
      if (d) return d;
      if (page >= r.meta.lastPage) break;
    }
    throw new Error("Devedor não encontrado");
  },
  search: (search: string) => debtorService.list({ search, perPage: 10, isActive: true }).then((r) => r.data),
  create: (p: DebtorPayload) => http.post<Msg & { id: number }>("debtors", toFormData({ ...p })),
  update: (id: number, p: DebtorPayload) => http.put<Msg>(`debtors/${id}`, toFormData({ ...p })),
  setActive: (id: number, active: boolean) => http.put<Msg>(`debtors/${active ? "enable" : "desable"}/${id}`),
  withoutWallet: (userId: number) => http.get<Data<Pick<Debtor, "id" | "name">[]>>(`user_wallet/dropdown/user/${userId}`).then(unwrap),
  downloadLogo: (id: number) => downloadProtected(`file/logo_debtor/dowload/${id}`, `logo-${id}`),
};

/* ───────────────────────────── Facturas ───────────────────────────── */
export type InvoiceQuery = ListParams & {
  state?: string; debtorId?: number; currencyId?: number; minAmount?: string; maxAmount?: string;
  dueDateFrom?: string; dueDateTo?: string; issueDateFrom?: string; issueDateTo?: string; inProcess?: boolean;
};
export const invoiceService = {
  list: (p: InvoiceQuery) => http.get<Paginated<Invoice>>("invoices", q(p)),
  overdue: (p: InvoiceQuery) => http.get<Paginated<Invoice>>("invoices/overdue", q(p)),
  create: (p: { debtor_id: number; currency_id: number; refencence_number: string; amount: string; time_limit: number; issue_date: string; file?: File | null }) =>
    http.post<Msg & { id: number }>("invoices", toFormData(p), { idempotencyKey: true }),
  update: (id: number, p: { debtor_id: number; currency_id: number; refencence_number: string; amount: string; time_limit: number; issue_date: string }) =>
    http.put<Msg>(`invoices/${id}`, p),
  /** PDF da factura */
  documentPath: (id: number) => `invoices/${id}/document`,
  documentUrl: (id: number) => blobUrlProtected(`invoices/${id}/document`),
  downloadDocument: (id: number, ref: string) => downloadProtected(`invoices/${id}/document?download=1`, `Factura_${ref}.pdf`),
  attachDocument: (id: number, file: File) => http.post<Msg>(`invoices/${id}/document`, toFormData({ file })),
  /** contagem por estado (1 pedido leve por estado, perPage=1) */
  async countsByState(states: string[]) {
    const entries = await Promise.all(states.map(async (s) => [s, (await invoiceService.list({ state: s, perPage: 1 })).meta.total] as const));
    return Object.fromEntries(entries) as Record<string, number>;
  },
};

/* ───────────────────────────── Importações ───────────────────────────── */
export interface PdfMatch { file: string; matched: boolean; reference?: string; reason?: string }
export const importService = {
  debtors: (file: File) => http.post<Msg & { data: ImportResult }>("file/import/debtors", toFormData({ file })),
  invoices: (file: File) => http.post<Msg & { data: ImportResult }>("file/import/invoices", toFormData({ file })),
  organizations: (file: File) => http.post<Msg & { data: ImportResult }>("file/import/organization", toFormData({ file })),
  invoicePdfs: (files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("invoices", f));
    return http.post<Msg & { data: PdfMatch[] }>("file/import/invoices/pdf", fd);
  },
  downloadErrorReport: (path: string) => downloadProtected(`file/import-errors/${path.split("/").pop()}`, "erros_importacao.xlsx"),
};

export type ImportHistoryQuery = ListParams & { kind?: ImportKind; status?: ImportStatus; userId?: number; from?: string; to?: string };
export const importHistoryService = {
  list: (p: ImportHistoryQuery) => http.get<Paginated<ImportBatch>>("import-history", q(p)),
  stats: () => http.get<Data<ImportStats>>("import-history/stats").then(unwrap),
  get: (id: number) => http.get<Data<ImportBatchDetail>>(`import-history/${id}`).then(unwrap),
  preview: (id: number) => http.get<Data<SheetPreview>>(`import-history/${id}/preview`).then(unwrap),
  downloadFile: (id: number, name: string) => downloadProtected(`import-history/${id}/file`, name),
  downloadErrorReport: (id: number, name: string) => downloadProtected(`import-history/${id}/error-report`, `${name.replace(/\.[^.]+$/, "")}_erros.xlsx`),
};

/* ───────────────────────────── Processos e contactos ───────────────────────────── */
export type ProcessQuery = ListParams & {
  state?: string; debtorId?: number; assignedUserId?: number; unassigned?: boolean; open?: boolean;
  createdFrom?: string; createdTo?: string; noContactSince?: string; lastContactStatus?: string; minContacts?: number; maxContacts?: number;
};
export interface TransferPayload {
  processIds: number[]; fromUserId: number; toUserId: number; reason: string; notes?: string; permanent: boolean; returnAt?: string;
}
export const processService = {
  list: (p: ProcessQuery) => http.get<Paginated<Process>>("process", q(p)),
  invoices: (processId: number, p: ListParams = { perPage: 100 }) => http.get<Paginated<ProcessInvoiceLink>>(`process/invoces/process/${processId}`, q(p)),
  generate: () => http.post<Msg & { data: { processesCreated: number; invoicesLinked: number } }>("process/generate"),
  assign: (processId: number, userId: number) => http.post<Msg>("process/assgin_user", { processeId: processId, userId }),
  autoAssign: () => http.post<Msg & { count: number }>("process/assgin_user/automatic"),
  removeInvoices: (processId: number, invoiceIds: number[], reason?: string) =>
    http.post<Msg & { count: number }>("process/remove/invoice", { processId, invoiceIds, reason }, { idempotencyKey: true }),
  transfer: (t: TransferPayload) =>
    http.post<Msg>("process/transfere", {
      processes: t.processIds.map((processId) => ({ processId })),
      agenteOrigemId: t.fromUserId, agenteDestinoId: t.toUserId, motivoTransferencia: t.reason, observacoes: t.notes,
      transferenciaDefinitiva: t.permanent, dateToRetornProcess: t.returnAt,
    }, { idempotencyKey: true }),
};
export type ContactQuery = ListParams & { userId?: number; contactTypeId?: number; status?: string; from?: string; to?: string };
export const contactService = {
  ofProcess: (processId: number, p: ContactQuery = { perPage: 50 }) => http.get<Paginated<Contact>>(`contacts/process/${processId}`, q(p)),
  list: (p: ContactQuery) => http.get<Paginated<Contact>>("contacts", q(p)),
  create: (p: { processe_id: number; contact_type_id: number; status?: ContactStatus; contacted_at?: string; notes?: string; duration?: number }) =>
    http.post<Msg & { id: number }>("contacts", p),
};

/* ───────────────────────────── Carteiras ───────────────────────────── */
export const walletService = {
  ofUser: (userId: number) => http.get<Data<Debtor[]>>(`user_wallet/user/${userId}`).then(unwrap),
  add: (userId: number, debtorId: number) => http.post<Msg>("user_wallet", { userId, debtorId }),
  async addMany(userId: number, debtorIds: number[]) {
    for (const id of debtorIds) await walletService.add(userId, id);
  },
  remove: (debtorIds: number[]) => http.post<Msg & { count: number }>("user_wallet/remove/debtors", { debtorsId: debtorIds.map((debtor_id) => ({ debtor_id })) }),
  transfer: (toUserId: number, debtorIds: number[]) =>
    http.post<Msg & { count: number }>("user_wallet/transfere/debtors", { userId: toUserId, debtors: debtorIds.map((debtorId) => ({ debtorId })) }, { idempotencyKey: true }),
};

/* ───────────────────────────── Negociações ───────────────────────────── */
export interface NegotiationPayload {
  debtAmount: string; discountAmount: string; discountRate: string; totalAmount: string; finalAmount: string;
  effectiveDate: string; startDate: string; endDate: string; isInstallmentment: boolean; isParcelaIgual: boolean;
  totalInstallments?: number; processes: { id: number }[]; installmentments?: InstallmentInput[]; notes?: string;
}
export type NegotiationQuery = ListParams & {
  status?: string; debtorId?: number; createdById?: number; isInstallment?: boolean; minTotal?: string; maxTotal?: string; effectiveFrom?: string; effectiveTo?: string;
};
export const negotiationService = {
  /** limites configurados no servidor (multa máxima, desconto sem aprovação, juros de mora) */
  settings: () => http.get<Data<{ maxPenaltyPercent: string; approvalDiscountLimitPercent: string; lateMonthlyInterestPercent: string }>>("negotiations/settings").then(unwrap),
  list: (p: NegotiationQuery) => http.get<Paginated<NegotiationListItem>>("negotiations", q(p)),
  get: (id: number) => http.get<Data<NegotiationDetail>>(`negotiations/${id}`).then(unwrap),
  create: (p: NegotiationPayload, idempotencyKey: string) => http.post<Msg & { data: NegotiationDetail }>("negotiations", p, { idempotencyKey }),
  calculateValues: (debtAmount: string, discountRate: string) =>
    http.post<Data<{ debtAmount: string; discountRate: string; discountAmount: string; totalAmount: string }>>("negotiations/calculate-values", { debtAmount, discountRate }).then(unwrap),
  generateInstallments: (p: { totalAmount: string; count: number; startDate: string; intervalDays?: number; penaltyPercentage?: string; type?: "equal" | "decreasing"; firstPercent?: string }) =>
    http.post<Data<{ totalAmount: string; installments: InstallmentInput[]; sum: string }>>("negotiations/generate-installments", p).then(unwrap),
  calculateOverdue: (p: { amount: string; penaltyPercentage: string; monthlyInterest: string; monthsLate: number }) =>
    http.post<Data<{ amount: string; penalty: string; interest: string; total: string }>>("negotiations/calculate-overdue", p).then(unwrap),
  approve: (id: number) => http.post<Msg>(`negotiations/${id}/approve`),
  reject: (id: number, reason: string) => http.post<Msg>(`negotiations/${id}/reject`, { reason }),
  cancel: (id: number, reason: string) => http.post<Msg>(`negotiations/${id}/cancel`, { reason }, { idempotencyKey: true }),
  breakAgreement: (id: number, reason: string) => http.post<Msg>(`negotiations/${id}/break`, { reason }),
  renegotiationBalance: (id: number) => http.get<Data<RenegotiationBalance>>(`negotiations/${id}/renegotiation-balance`).then(unwrap),
  renegotiate: (id: number, p: Omit<NegotiationPayload, "debtAmount" | "processes">, idempotencyKey: string) =>
    http.post<Msg & { data: { id: number; status: string; negotiation: NegotiationDetail } }>(`negotiations/${id}/renegotiate`, p, { idempotencyKey }),
};

/* ───────────────────────────── Pagamentos ───────────────────────────── */
export type PaymentQuery = ListParams & {
  status?: string; receiver?: PaymentReceiver; negotiationId?: number; installmentId?: number; debtorId?: number; organizationId?: number;
  registeredById?: number; paymentMethodId?: number; currencyId?: number; paidFrom?: string; paidTo?: string; minAmount?: string; maxAmount?: string;
};
export interface RegisterPaymentPayload {
  negotiationId: number; installmentId?: number | null; receiver: PaymentReceiver; amount: string; currencyId: number; exchangeRate?: string;
  paymentMethodId: number; paidOn: string; reference?: string; notes?: string; proof: File;
}
export interface ConfirmationResult {
  paymentId: string; credit: string; commission: string; installmentsPaid: number; negotiationCompleted: boolean; processesClosed: number; invoicesPaid: number;
  allocations: { installmentId: number | null; amount: string; coversBucket: boolean }[];
}
export const paymentService = {
  list: (p: PaymentQuery) => http.get<Paginated<Payment>>("payments", q(p)),
  pending: (p: PaymentQuery) => http.get<Paginated<Payment>>("payments/pending-confirmation", q(p)),
  get: (id: string) => http.get<Data<Payment>>(`payments/${id}`).then(unwrap),
  register: (p: RegisterPaymentPayload, idempotencyKey: string) =>
    http.post<Msg & { data: { id: string } }>("payments", toFormData({ ...p }), { idempotencyKey }),
  confirm: (id: string) => http.post<Msg & { data: ConfirmationResult }>(`payments/${id}/confirm`, undefined, { idempotencyKey: true }),
  cancel: (id: string, reason: string) => http.post<Msg>(`payments/${id}/cancel`, { reason }),
  reverse: (id: string, reason: string) => http.post<Msg>(`payments/${id}/reverse`, { reason }, { idempotencyKey: true }),
  proof: (id: string) => downloadProtected(`payments/${id}/proof`, `comprovativo-${id}`),
  viewProof: (id: string) => openProtected(`payments/${id}/proof`),
  debtorCredit: (debtorId: number, page = 1, perPage = 20) => http.get<Data<DebtorCredit>>(`payments/debtor-credit/${debtorId}`, { page, perPage }).then(unwrap),
  methods: (onlyActive = true) => http.get<Data<PaymentMethod[]>>("payment-methods", { onlyActive }).then(unwrap),
  createMethod: (p: { name: string; description?: string; requiresReference: boolean }) => http.post<Msg>("payment-methods", p),
  updateMethod: (id: number, p: Partial<{ name: string; description: string; requiresReference: boolean; isActive: boolean }>) => http.patch<Msg>(`payment-methods/${id}`, p),
  currencies: (onlyActive = true) => http.get<Data<Currency[]>>("payment-currencies", { onlyActive }).then(unwrap),
  createCurrency: (p: { code: string; name: string; symbol: string }) => http.post<Msg>("payment-currencies", p),
  updateCurrency: (id: number, p: Partial<{ name: string; symbol: string; isActive: boolean }>) => http.patch<Msg>(`payment-currencies/${id}`, p),
};

/* ───────────────────────────── Conta-corrente dos credores ───────────────────────────── */
export const creditorService = {
  balances: (p: ListParams & { organizationId?: number }) => http.get<Paginated<CreditorBalance>>("creditor-accounts", q(p)),
  account: (organizationId: number, p: { page?: number; perPage?: number; from?: string; to?: string } = {}) =>
    http.get<Data<CreditorBalance & { entries: Paginated<LedgerLine> }>>(`creditor-accounts/${organizationId}`, q(p)).then(unwrap),
  setCommissionRate: (organizationId: number, rate: string) => http.patch<Msg>(`creditor-accounts/${organizationId}/commission-rate`, { rate }),
  settlements: (p: ListParams & { organizationId?: number; direction?: SettlementDirection; status?: string; settledFrom?: string; settledTo?: string }) =>
    http.get<Paginated<Settlement>>("creditor-accounts/settlements", q(p)),
  settlement: (id: string) => http.get<Data<Settlement>>(`creditor-accounts/settlements/${id}`).then(unwrap),
  registerSettlement: (organizationId: number, p: { direction: SettlementDirection; amount: string; settledOn: string; paymentMethodId: number; reference?: string; notes?: string; proof: File }, idempotencyKey: string) =>
    http.post<Msg>(`creditor-accounts/${organizationId}/settlements`, toFormData({ ...p }), { idempotencyKey }),
  confirmSettlement: (id: string) => http.post<Msg>(`creditor-accounts/settlements/${id}/confirm`),
  cancelSettlement: (id: string, reason: string) => http.post<Msg>(`creditor-accounts/settlements/${id}/cancel`, { reason }),
  settlementProof: (id: string) => downloadProtected(`creditor-accounts/settlements/${id}/proof`, `repasse-${id}`),
};

/* ───────────────────────────── Disputas de facturas ───────────────────────────── */
export const disputeService = {
  list: (p: ListParams & { status?: string; outcome?: DisputeOutcome; invoiceId?: number; debtorId?: number; organizationId?: number; openedFrom?: string; openedTo?: string }) =>
    http.get<Paginated<Dispute>>("invoice-disputes", q(p)),
  get: (id: string) => http.get<Data<Dispute>>(`invoice-disputes/${id}`).then(unwrap),
  open: (invoiceId: number, reason: string) => http.post<Msg>("invoice-disputes", { invoiceId, reason }, { idempotencyKey: true }),
  resolve: (id: string, p: { outcome: DisputeOutcome; notes: string; adjustedAmount?: string }) => http.post<Msg>(`invoice-disputes/${id}/resolve`, p),
};

/* ───────────────────────────── Régua de cobrança ───────────────────────────── */
export interface LadderPayload { name: string; description?: string; steps: Omit<LadderStep, "id">[] }
export interface LadderCoverage {
  ownerUserId: number; catchUpDays: number;
  processes: Array<{ processId: number; debtorName: string; day: number; startDate: string; hasActiveNegotiation: boolean; nextStepDay: number | null; nextStepTitle: string | null; lastStepDay: number | null }>;
}
export type PolicyPayload = Omit<CollectionPolicy, "version" | "updatedAt" | "skeleton"> & { expectedVersion: number };
export const policyService = {
  get: () => http.get<Data<CollectionPolicy>>("collection-policy").then(unwrap),
  update: (p: PolicyPayload) => http.put<Msg & { version: number; revalidated: number; suspended: number; restored: number }>("collection-policy", p),
};

export const ladderService = {
  coverage: (id: number) => http.get<Data<LadderCoverage>>(`collection-ladders/${id}/coverage`).then(unwrap),
  options: () => http.get<Data<{ actions: string[]; recipients: string[]; variables: string[]; debtorChannels?: string[]; debtorMessagesMode?: "log" | "send" }>>("collection-ladders/options").then(unwrap),
  list: (p: { ownerId?: number; includeArchived?: boolean; page?: number; perPage?: number } = {}) =>
    http.get<Paginated<Ladder>>("collection-ladders", q({ ...p, includeArchived: p.includeArchived ? "true" : undefined })),
  get: (id: number) => http.get<Data<Ladder>>(`collection-ladders/${id}`).then(unwrap),
  create: (p: LadderPayload) => http.post<Msg & { id: number }>("collection-ladders", p),
  update: (id: number, p: LadderPayload & { expectedVersion: number }) => http.put<Msg & { version: number }>(`collection-ladders/${id}`, p),
  preview: (id: number) => http.get<Data<LadderPreviewRow[]>>(`collection-ladders/${id}/preview`).then(unwrap),
  activate: (id: number) => http.post<Msg>(`collection-ladders/${id}/activate`),
  deactivate: (id: number) => http.post<Msg>(`collection-ladders/${id}/deactivate`),
  archive: (id: number) => http.post<Msg>(`collection-ladders/${id}/archive`),
  runNow: () => http.post<Data<unknown>>("collection-ladders/run"),
  tasks: (p: { page?: number; perPage?: number; status?: string; agentId?: number; ladderId?: number; processId?: number; dueFrom?: string; dueTo?: string }) =>
    http.get<Paginated<LadderTask>>("collection-ladder-tasks", q(p)),
  compliance: (p: { from?: string; to?: string; agentId?: number } = {}) =>
    http.get<{ period: { from: string; to: string }; data: ComplianceRow[] }>("collection-ladder-tasks/compliance", q(p)),
};

/* ───────────────────────────── Painel ───────────────────────────── */
export type DashboardQuery = { from?: string; to?: string; agentId?: number; organizationId?: number };
type Scoped<T> = { period: { from: string; to: string }; scope: string; currency: string; data: T[] };
export const dashboardService = {
  summary: (p: DashboardQuery = {}) => http.get<Data<DashboardSummary>>("dashboard/summary", q(p)).then(unwrap),
  byAgent: (p: DashboardQuery = {}) => http.get<Scoped<AgentFacts>>("dashboard/by-agent", q(p)),
  byCreditor: (p: DashboardQuery = {}) => http.get<Scoped<CreditorFacts>>("dashboard/by-creditor", q(p)),
};

/* ───────────────────────────── Notificações ───────────────────────────── */
export const notificationService = {
  list: (p: { page?: number; perPage?: number; is_read?: boolean; type?: string; priority?: string } = {}) => http.get<Paginated<AppNotification>>("notifications", q(p)),
  unreadCount: () => http.get<{ count: number }>("notifications/unread-count").then((r) => r.count),
  markRead: (id: string) => http.put<Msg>(`notifications/${id}/read`),
  markAllRead: () => http.put<Msg & { count: number }>("notifications/read-all"),
  remove: (id: string) => http.delete<Msg>(`notifications/${id}`),
};

/* ───────────────────────────── Auditoria ───────────────────────────── */
export const auditService = {
  list: (p: ListParams & { actorId?: number; entity?: string; entityId?: string; action?: string; from?: string; to?: string }) =>
    http.get<Paginated<AuditLog>>("audit-logs", q(p)),
  stats: () => http.get<Data<AuditStats>>("audit-logs/stats").then(unwrap),
};

/* ───────────────────────────── Outbox (administração) ───────────────────────────── */
export interface CircuitSnapshot { name: string; state: "CLOSED" | "OPEN" | "HALF_OPEN"; failures?: number; openedAt?: string | null; [k: string]: unknown }
export const outboxService = {
  list: (p: { status?: OutboxStatus; type?: string; page?: number; perPage?: number }) => http.get<Paginated<OutboxMessage>>("outbox", q(p)),
  stats: () => http.get<Data<Record<string, number>>>("outbox/stats").then(unwrap),
  circuits: () => http.get<Data<CircuitSnapshot[] | Record<string, unknown>>>("outbox/circuits").then(unwrap),
  retry: (ids: string[]) => http.post<Msg & { count: number }>("outbox/retry", { ids }),
};

export const emptyPage = <T,>(): Paginated<T> => ({ data: [], meta: { total: 0, perPage: 10, currentPage: 1, lastPage: 1, firstPage: 1 } as Pagination });

export { documentService, documentCategories } from "./documents";
export type { UploadMeta } from "./documents";

/* ───────────────────────────── Integração com o ERP ───────────────────────────── */
export const integrationService = {
  get: () => http.get<Data<Integration>>("integration").then(unwrap),
  update: (p: { version: number; provider?: string; config?: Record<string, unknown>; autoClose?: boolean; importDebtors?: boolean; intervalMinutes?: number; companies?: { companyCode: string; organizationId: number }[] }) =>
    http.put<Msg & Data<Integration>>("integration", p),
  setCredentials: (credentials: Record<string, string>) => http.put<Msg>("integration/credentials", { credentials }),
  test: () => http.post<Data<IntegrationTestResult>>("integration/test").then(unwrap),
  activate: () => http.post<Msg>("integration/activate"),
  pause: () => http.post<Msg>("integration/pause"),
  run: (mode: IntegrationRunMode) => http.post<Msg & Data<{ runId: number }>>("integration/runs", { mode }),
  runs: (p: ListParams = {}) => http.get<Paginated<IntegrationRun>>("integration/runs", q(p)),
  runDetail: (id: number) => http.get<Data<IntegrationRun>>(`integration/runs/${id}`).then(unwrap),
  reviews: (p: ListParams & { status?: IntegrationReviewStatus }) => http.get<Paginated<IntegrationReview>>("integration/reviews", q(p)),
  resolve: (id: number, action: "RESOLVE" | "IGNORE" | "CLOSE_PROCESS", note?: string) => http.post<Msg>(`integration/reviews/${id}/resolve`, { action, note }),
};

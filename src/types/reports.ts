/* Tipos dos relatórios de Contas a Receber (GET /reports/*). Valores monetários em number (moeda base). */

export interface ReportPeriod { from: string; to: string; days: number }
export interface ReportCurrency { code: string; symbol: string }

export type AgingBucketKey = "CURRENT" | "D1_30" | "D31_60" | "D61_90" | "D91_180" | "D180_PLUS";
export interface AgingBucket { key: AgingBucketKey; label: string; amount: number; count: number; pct: number }

export interface KpiTrendPoint {
  month: string; label: string; partial: boolean; receivable: number; sales: number; recovered: number;
  dso: number | null; cei: number | null; costToCollect: number | null;
}

export interface KpiReport {
  period: ReportPeriod;
  currency: ReportCurrency;
  receivable: { start: number; end: number; currentNotDue: number; overdue: number };
  sales: number; salesCount: number; recovered: number; recoveredCount: number; commissions: number; costs: number;
  dso: number | null;
  cei: number | null;
  delinquency: {
    rate: number | null; countRate: number | null; overdueAmount: number; overdueCount: number; maturedAmount: number; maturedCount: number;
    lossAmount: number; lossCount: number; lossRate: number | null; lossThresholdDays: number;
  };
  costToCollect: number | null;
  costPerPayment: number | null;
  margin: number;
  aging: { totalOutstanding: number; invoices: number; buckets: AgingBucket[]; overduePct: number | null };
  trend: KpiTrendPoint[];
}

export interface AgingRow {
  id: number; reference: string; amount: string; outstanding: string; issueDate: string; dueDate: string; daysOverdue: number; state: string;
  debtorId: number; debtorName: string; nif: string | null; organizationId: number; organizationName: string; processId: number | null;
  agentId: number | null; agentName: string | null; negotiationId: number | null; negotiationStatus: string | null;
  bucket: AgingBucketKey; bucketLabel: string; situation: string;
}
export interface AgingReport {
  asOf: string; currency: ReportCurrency; totalOutstanding: number; filteredOutstanding: number; buckets: AgingBucket[];
  debtors: { debtorId: number; debtorName: string; organizationName: string; invoices: number; outstanding: number; maxDays: number }[];
  rows: AgingRow[]; truncated: boolean;
}

export interface CashFlowPeriod {
  label: string; start: string | null; end: string | null; agreements: number; invoices: number; pending: number; nominal: number; probable: number; cumulative: number;
}
export interface CashFlowReport {
  asOf: string; granularity: "week" | "month"; currency: ReportCurrency;
  rates: { installment: number | null; invoice: number | null };
  totals: { nominal: number; probable: number; agreements: number; invoices: number; pending: number; pendingCount: number };
  overdue: CashFlowPeriod; periods: CashFlowPeriod[];
  installments: { id: number | null; negotiationId: number; number: number | null; of: number | null; dueDate: string; remaining: string; status: string; debtorName: string; organizationName: string; agentName: string | null }[];
  upcomingInvoices: { id: number; reference: string; debtorName: string; organizationName: string; dueDate: string; outstanding: string; agentName: string | null }[];
}

export interface ContactsReport {
  period: ReportPeriod; total: number; reached: number; reachRate: number | null; negotiationsStarted: number; debtorsContacted: number;
  byStatus: { key: string; label: string; count: number }[];
  byType: { type: string; count: number }[];
  byAgent: { agentName: string; total: number; reached: number; negotiations: number; failed: number; debtors: number; reachRate: number | null; avgDurationSeconds: number | null }[];
  rows: { id: number; contactedAt: string; agentId: number; agentName: string | null; debtorName: string; organizationName: string; processId: number; type: string; status: string; statusLabel: string; durationSeconds: number | null; notes: string | null }[];
  truncated: boolean;
}

export interface BrokenReport {
  period: ReportPeriod; currency: ReportCurrency; count: number; completed: number; breakRate: number | null;
  agreed: number; paid: number; missing: number; automatic: number; renegotiated: number;
  byAgent: { agentName: string; count: number; missing: number }[];
  rows: {
    id: number; debtorName: string; organizationName: string; agentName: string | null; createdByName: string | null; startedAt: string | null; brokenAt: string;
    agreed: string; paid: string; missing: string; installmentsPaid: number; installmentsTotal: number; breakReason: string; brokenByName: string | null;
    automatic: boolean; renegotiatedId: number | null; status: string;
  }[];
}

export interface DisputesReport {
  period: ReportPeriod; currency: ReportCurrency; opened: number; resolvedInPeriod: number; openNow: number; openAmount: number;
  avgResolutionDays: number | null; oldestOpenDays: number | null; cancelledAmount: number; adjustedReduction: number;
  outcomes: { key: "UPHELD" | "CANCELLED" | "ADJUSTED"; count: number; amount: number }[];
  rows: {
    id: number; invoiceId: number; reference: string; debtorName: string; organizationName: string; agentName: string | null; originalAmount: string; adjustedAmount: string | null;
    reason: string; status: "OPEN" | "RESOLVED"; outcome: "UPHELD" | "CANCELLED" | "ADJUSTED" | null; openedAt: string; openedByName: string | null;
    resolvedAt: string | null; resolvedByName: string | null; resolutionNotes: string | null; days: number;
  }[];
}

export type CostCategory = "STAFF" | "COMMUNICATIONS" | "TECHNOLOGY" | "TRAVEL" | "LEGAL" | "OFFICE" | "OTHER";
export interface CollectionCost {
  id: number; costDate: string; category: CostCategory; description: string; amount: string; organizationId: number | null; organizationName: string | null;
  createdById: number | null; createdByName: string | null; createdAt: string;
}
export interface CostPayload { costDate: string; category: CostCategory; description: string; amount: string; organizationId?: number | null }

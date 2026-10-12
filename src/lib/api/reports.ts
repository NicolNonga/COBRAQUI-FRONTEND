// Estatísticas e relatórios de Contas a Receber (GET /reports/* — JSON ou PDF com format=pdf).
import { downloadProtected, http, type Query } from "@/lib/api/http";
import type { Pagination } from "@/types/models";
import type {
  AgingBucketKey, AgingReport, BrokenReport, CashFlowReport, CollectionCost, ContactsReport, CostCategory, CostPayload, DisputesReport, KpiReport,
} from "@/types/reports";

type Data<T> = { data: T };
const unwrap = <T,>(r: Data<T>) => r.data;

export interface ReportFilters { from?: string; to?: string; organizationId?: number; agentId?: number }
export type AgingFilters = ReportFilters & { bucket?: AgingBucketKey; search?: string };
export type CashFlowFilters = ReportFilters & { granularity?: "week" | "month"; periods?: number };
export type ContactFilters = ReportFilters & { status?: string; contactTypeId?: number };
export type DisputeFilters = ReportFilters & { status?: "OPEN" | "RESOLVED" };

const qs = (p: object) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") s.set(k, String(v)); });
  return s.toString();
};
/** descarrega o PDF gerado no servidor (o nome vem do Content-Disposition) */
const pdf = (path: string, p: object, name: string) => downloadProtected(`${path}?${qs({ ...p, format: "pdf" })}`, `${name}.pdf`);

export type ReportKey = "kpis" | "aging" | "cash-flow" | "contacts" | "broken-agreements" | "disputes";

export const reportService = {
  kpis: (p: ReportFilters) => http.get<Data<KpiReport>>("reports/kpis", p as Query).then(unwrap),
  aging: (p: AgingFilters) => http.get<Data<AgingReport>>("reports/aging", p as Query).then(unwrap),
  cashFlow: (p: CashFlowFilters) => http.get<Data<CashFlowReport>>("reports/cash-flow", p as Query).then(unwrap),
  contacts: (p: ContactFilters) => http.get<Data<ContactsReport>>("reports/contacts", p as Query).then(unwrap),
  brokenAgreements: (p: ReportFilters) => http.get<Data<BrokenReport>>("reports/broken-agreements", p as Query).then(unwrap),
  disputes: (p: DisputeFilters) => http.get<Data<DisputesReport>>("reports/disputes", p as Query).then(unwrap),
  pdf: (report: ReportKey, p: object) => pdf(`reports/${report}`, p, `relatorio_${report}`),

  costCategories: () => http.get<Data<{ value: CostCategory; label: string }[]>>("reports/costs/categories").then(unwrap),
  costs: (p: { page?: number; perPage?: number; from?: string; to?: string; category?: string; organizationId?: number; search?: string }) =>
    http.get<{ meta: Pagination; data: CollectionCost[]; summary: { amount: string; byCategory: { category: CostCategory; label: string; amount: string }[] } }>("reports/costs", p as Query),
  createCost: (p: CostPayload) => http.post<{ message: string; data: CollectionCost }>("reports/costs", p),
  updateCost: (id: number, p: CostPayload) => http.put<{ message: string; data: CollectionCost }>(`reports/costs/${id}`, p),
  deleteCost: (id: number) => http.delete<{ message: string }>(`reports/costs/${id}`),
};

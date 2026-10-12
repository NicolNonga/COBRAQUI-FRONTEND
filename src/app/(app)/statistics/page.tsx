"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader, Skeleton, Tabs } from "@/components/ui/display";
import { useAuth } from "@/components/shared/auth-provider";
import { KpisTab } from "@/components/statistics/kpis-tab";
import { AgingTab, BrokenTab, CashFlowTab, ContactsTab, DisputesTab } from "@/components/statistics/report-tabs";
import { CostsTab } from "@/components/statistics/costs-tab";

type Tab = "kpis" | "aging" | "cash-flow" | "contacts" | "broken" | "disputes" | "costs";
const TABS: { value: Tab; label: string; description: string }[] = [
  { value: "kpis", label: "Indicadores", description: "DSO, inadimplência, CEI, aging e custo por cobrança — o relatório de Contas a Receber." },
  { value: "aging", label: "Aging list", description: "Facturas em aberto hoje, por devedor e faixa de atraso." },
  { value: "cash-flow", label: "Fluxo de caixa", description: "Quanto deve entrar nas próximas semanas ou meses, e com que probabilidade." },
  { value: "contacts", label: "Contactos", description: "Histórico de contactos com os devedores e eficácia por agente." },
  { value: "broken", label: "Acordos quebrados", description: "Acordos de pagamento que não foram cumpridos e o valor que ficou por receber." },
  { value: "disputes", label: "Disputas", description: "Facturas contestadas pelos devedores: motivos, decisões e tempo de resolução." },
  { value: "costs", label: "Custos", description: "Custos da operação de cobrança, base do indicador de custo por cobrança." },
];

export default function StatisticsPage() {
  return <Suspense fallback={<Skeleton className="h-96" />}><StatisticsView /></Suspense>;
}

function StatisticsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const tab = (TABS.find((t) => t.value === params.get("tab"))?.value ?? "kpis") as Tab;
  const current = TABS.find((t) => t.value === tab)!;
  if (!user) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader title="Estatísticas" description={current.description} breadcrumbs={[{ label: "Análise" }, { label: "Estatísticas" }, { label: current.label }]} />
      <div className="mb-6">
        <Tabs<Tab> value={tab} onChange={(t) => router.replace(t === "kpis" ? "/statistics" : `/statistics?tab=${t}`, { scroll: false })} items={TABS.map(({ value, label }) => ({ value, label }))} />
      </div>
      {tab === "kpis" && <KpisTab />}
      {tab === "aging" && <AgingTab />}
      {tab === "cash-flow" && <CashFlowTab />}
      {tab === "contacts" && <ContactsTab />}
      {tab === "broken" && <BrokenTab />}
      {tab === "disputes" && <DisputesTab />}
      {tab === "costs" && <CostsTab />}
    </>
  );
}

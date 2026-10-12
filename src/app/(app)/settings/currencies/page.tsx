"use client";
import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/display";
import { SimpleCrudPage } from "@/components/shared/simple-crud";
import { ActiveBadge } from "@/components/shared/status";
import { paymentService } from "@/lib/api/services";
import type { Currency } from "@/types/models";

export default function CurrenciesPage() {
  return (
    <SimpleCrudPage<Currency>
      title="Moedas" description="Moedas aceites nos pagamentos. Valores noutras moedas são convertidos para a moeda base (AOA) com a taxa indicada no registo."
      breadcrumbs={[{ label: "Configurações" }, { label: "Moedas" }]}
      entity="moeda" icon={<Coins className="h-5 w-5" />}
      service={{
        list: () => paymentService.currencies(false),
        save: (p: Partial<Currency>) => p.id
          ? paymentService.updateCurrency(p.id, { name: p.name, symbol: p.symbol, isActive: p.isActive })
          : paymentService.createCurrency({ code: String(p.code).toUpperCase(), name: String(p.name), symbol: String(p.symbol) }),
      }}
      toggle={{ key: "isActive", run: (id, isActive) => paymentService.updateCurrency(id, { isActive }) }}
      searchIn={(r) => r.name + r.code}
      fields={[
        { name: "name", label: "Nome", required: true, placeholder: "Ex: Kwanza" },
        { name: "code", label: "Código ISO (só na criação)", required: true, placeholder: "AOA", transform: (v) => v.toUpperCase().slice(0, 3) },
        { name: "symbol", label: "Símbolo", required: true, placeholder: "Kz" },
        { name: "isActive", label: "Moeda activa", type: "switch" },
      ]}
      columns={[
        { key: "n", header: "Moeda", cell: (r) => <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-soft text-sm font-semibold">{r.symbol}</span><span className="font-medium">{r.name}</span>{r.code === "AOA" && <Badge tone="brand">Base</Badge>}</div> },
        { key: "c", header: "Código", cell: (r) => <code className="font-mono text-xs">{r.code}</code> },
        { key: "s", header: "Estado", cell: (r) => <ActiveBadge active={r.isActive} on="Activa" off="Inactiva" /> },
      ]}
    />
  );
}

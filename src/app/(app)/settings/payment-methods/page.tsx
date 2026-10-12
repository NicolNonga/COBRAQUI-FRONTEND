"use client";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/display";
import { SimpleCrudPage } from "@/components/shared/simple-crud";
import { ActiveBadge } from "@/components/shared/status";
import { paymentService } from "@/lib/api/services";
import type { PaymentMethod } from "@/types/models";

export default function PaymentMethodsPage() {
  return (
    <SimpleCrudPage<PaymentMethod>
      title="Meios de pagamento" description="Formas de pagamento aceites (transferência, Multicaixa, numerário…)."
      breadcrumbs={[{ label: "Configurações" }, { label: "Meios de pagamento" }]}
      entity="meio de pagamento" icon={<CreditCard className="h-5 w-5" />}
      service={{
        list: () => paymentService.methods(false),
        save: (p: Partial<PaymentMethod>) => p.id
          ? paymentService.updateMethod(p.id, { name: p.name, description: p.description ?? undefined, requiresReference: !!p.requiresReference, isActive: p.isActive })
          : paymentService.createMethod({ name: String(p.name), description: p.description || undefined, requiresReference: !!p.requiresReference }),
      }}
      toggle={{ key: "isActive", run: (id, isActive) => paymentService.updateMethod(id, { isActive }) }}
      defaults={{ requiresReference: true, isActive: true }}
      searchIn={(r) => r.name + (r.description ?? "")}
      fields={[
        { name: "name", label: "Nome", required: true, placeholder: "Ex: Transferência bancária", full: true },
        { name: "description", label: "Descrição", type: "textarea" },
        { name: "requiresReference", label: "Exige nº de referência do comprovativo", type: "switch" },
        { name: "isActive", label: "Activo", type: "switch" },
      ]}
      columns={[
        { key: "n", header: "Meio", cell: (r) => <span className="font-medium">{r.name}</span> },
        { key: "d", header: "Descrição", cell: (r) => <span className="text-muted">{r.description ?? "—"}</span>, hideOnMobile: true },
        { key: "r", header: "Referência", cell: (r) => r.requiresReference ? <Badge tone="info">Obrigatória</Badge> : <span className="text-xs text-muted">Opcional</span> },
        { key: "s", header: "Estado", cell: (r) => <ActiveBadge active={r.isActive} /> },
      ]}
    />
  );
}

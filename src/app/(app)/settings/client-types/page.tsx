"use client";
import { Tags } from "lucide-react";
import { Badge } from "@/components/ui/display";
import { SimpleCrudPage } from "@/components/shared/simple-crud";
import { catalogService } from "@/lib/api/services";
import type { DebtorType } from "@/types/models";

export default function DebtorTypesPage() {
  return (
    <SimpleCrudPage<DebtorType>
      title="Tipos de devedor" description="Classificação dos devedores (empresa, particular, Estado…)."
      breadcrumbs={[{ label: "Configurações" }, { label: "Tipos de devedor" }]}
      note="Catálogo gerido no servidor (só consulta)."
      entity="tipo de devedor" icon={<Tags className="h-5 w-5" />}
      service={{ list: () => catalogService.debtorTypes({ perPage: 100 }).then((r) => r.data) }}
      searchIn={(r) => r.name + (r.description ?? "")} fields={[]}
      columns={[
        { key: "n", header: "Nome", cell: (r) => <span className="font-medium">{r.name}</span> },
        { key: "c", header: "Natureza", cell: (r) => <Badge tone={r.isCompany ? "info" : "neutral"}>{r.isCompany ? "Pessoa colectiva" : "Pessoa singular"}</Badge> },
        { key: "d", header: "Descrição", cell: (r) => <span className="text-muted">{r.description ?? "—"}</span> },
      ]}
    />
  );
}

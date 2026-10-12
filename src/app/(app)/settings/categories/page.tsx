"use client";
import { Wallet } from "lucide-react";
import { SimpleCrudPage } from "@/components/shared/simple-crud";
import { ActiveBadge } from "@/components/shared/status";
import { catalogService } from "@/lib/api/services";
import type { Category } from "@/types/models";
import { formatDate } from "@/lib/utils";

export default function CategoriesPage() {
  return (
    <SimpleCrudPage<Category>
      title="Categorias de utilizadores" description="Níveis da equipa de cobrança, usados na atribuição de processos."
      breadcrumbs={[{ label: "Configurações" }, { label: "Categorias" }]}
      note="Catálogo gerido no servidor (só consulta)."
      entity="categoria" icon={<Wallet className="h-5 w-5" />}
      service={{ list: () => catalogService.categories({ perPage: 100 }).then((r) => r.data) }}
      searchIn={(r) => r.name} fields={[]}
      columns={[
        { key: "n", header: "Nome", cell: (r) => <span className="font-medium">{r.name}</span> },
        { key: "s", header: "Estado", cell: (r) => <ActiveBadge active={r.isActive} on="Activa" off="Inactiva" /> },
        { key: "c", header: "Criada em", cell: (r) => <span className="text-muted">{formatDate(r.createdAt)}</span> },
      ]}
    />
  );
}

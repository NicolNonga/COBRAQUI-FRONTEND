"use client";
import { Phone } from "lucide-react";
import { SimpleCrudPage } from "@/components/shared/simple-crud";
import { catalogService } from "@/lib/api/services";
import type { ContactType } from "@/types/models";
import { formatDate } from "@/lib/utils";

export default function ContactTypesPage() {
  return (
    <SimpleCrudPage<ContactType>
      title="Tipos de contacto" description="Canais usados para contactar devedores (telefone, email, visita…)."
      breadcrumbs={[{ label: "Configurações" }, { label: "Tipos de contacto" }]}
      entity="tipo de contacto" icon={<Phone className="h-5 w-5" />} allowEdit={false}
      service={{
        list: () => catalogService.contactTypes({ perPage: 100 }).then((r) => r.data),
        save: (p: { name: string; description?: string }) => catalogService.createContactType({ name: p.name.trim(), description: p.description?.trim() || undefined }),
      }}
      searchIn={(r) => r.name + (r.description ?? "")}
      fields={[{ name: "name", label: "Nome", required: true, placeholder: "Ex: WhatsApp" }, { name: "description", label: "Descrição", type: "textarea" }]}
      columns={[
        { key: "n", header: "Nome", cell: (r) => <span className="font-medium">{r.name}</span> },
        { key: "d", header: "Descrição", cell: (r) => <span className="text-muted">{r.description ?? "—"}</span> },
        { key: "c", header: "Criado em", cell: (r) => <span className="text-muted">{formatDate(r.createdAt)}</span>, hideOnMobile: true },
      ]}
    />
  );
}

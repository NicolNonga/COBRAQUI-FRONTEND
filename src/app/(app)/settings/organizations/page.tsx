"use client";
import { useState } from "react";
import { Building2, Upload } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { SimpleCrudPage } from "@/components/shared/simple-crud";
import { ActiveBadge } from "@/components/shared/status";
import { ImportModal } from "@/components/shared/import-modal";
import { importService, organizationService } from "@/lib/api/services";
import type { Organization } from "@/types/models";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/components/shared/auth-provider";
import { P } from "@/lib/permissions";

export default function OrganizationsPage() {
  const [importOpen, setImportOpen] = useState(false);
  const [key, setKey] = useState(0);
  const { can } = useAuth();
  const manage = can(P.ORGANIZATION_MANAGE);
  type OrgForm = { id?: number; name: string; email: string; phoneNumber: string; address: string };
  const save = (p: OrgForm) => {
    const body = { name: p.name.trim(), email: p.email.trim(), phone_number: p.phoneNumber.trim(), address: p.address.trim() };
    return p.id ? organizationService.update(p.id, body) : organizationService.create(body);
  };
  return (
    <>
      {manage && <div className="mb-2 flex justify-end"><Button variant="secondary" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>Importar credores (Excel)</Button></div>}
      <SimpleCrudPage<Organization>
        key={key}
        title="Credores (organizações)" description="Empresas cujas dívidas a agência cobra."
        breadcrumbs={[{ label: "Configurações" }, { label: "Credores" }]}
        entity="credor" icon={<Building2 className="h-5 w-5" />}
        service={{
          list: () => organizationService.list({ perPage: 100 }).then((r) => r.data),
          save: manage ? save : undefined,
        }}
        toggle={manage ? { key: "isActive", run: (id, enable) => organizationService.setActive(id, enable) } : undefined}
        searchIn={(r) => r.name + r.email}
        fields={[
          { name: "name", label: "Nome", required: true, placeholder: "Nome do credor", full: true },
          { name: "email", label: "Email", type: "email", required: true, placeholder: "geral@empresa.ao" },
          { name: "phoneNumber", label: "Telefone", required: true, placeholder: "+244 222 000 000" },
          { name: "address", label: "Endereço", required: true, placeholder: "Rua, bairro, cidade", full: true },
        ]}
        columns={[
          { key: "n", header: "Credor", cell: (r) => <div className="flex items-center gap-3"><Avatar name={r.name} size="sm" /><span className="font-medium">{r.name}</span></div> },
          { key: "e", header: "Email", cell: (r) => <span className="text-muted">{r.email}</span> },
          { key: "p", header: "Telefone", cell: (r) => <span className="tabular text-muted">{r.phoneNumber}</span>, hideOnMobile: true },
          { key: "a", header: "Endereço", cell: (r) => <span className="text-muted">{r.address}</span>, hideOnMobile: true },
          { key: "c", header: "Desde", cell: (r) => <span className="text-muted">{formatDate(r.createdAt)}</span>, hideOnMobile: true },
          { key: "s", header: "Estado", cell: (r) => <ActiveBadge active={r.isActive} on="Activo" off="Inactivo" /> },
        ]}
      />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} title="Importar credores" description="Ficheiro Excel com os credores."
        columnsHint="Colunas esperadas: nome, email, telefone e endereço." onImport={importService.organizations} onDone={() => setKey((k) => k + 1)} />
    </>
  );
}

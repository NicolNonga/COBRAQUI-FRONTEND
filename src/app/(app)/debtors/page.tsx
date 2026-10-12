"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Download, Eye, MoreHorizontal, Pencil, Plus, Power, Upload, User, UserCheck, Users } from "lucide-react";
import { PageHeader, StatCard, Avatar, Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { SearchInput, SegmentedControl, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dropdown, MenuItem, MenuSeparator, ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { ActiveBadge } from "@/components/shared/status";
import { DebtorFormDrawer } from "@/components/shared/debtor-form";
import { ImportModal } from "@/components/shared/import-modal";
import { useListState, useQuery } from "@/hooks/use-query";
import { ExportPdfButton } from "@/components/shared/export-pdf-button";
import { debtorService, importService, organizationService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import { ErrorBanner } from "@/components/shared/process-list";
import type { Debtor } from "@/types/models";
import { downloadFile, formatDate, formatNumber, toCsv } from "@/lib/utils";

export default function DebtorsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const list = useListState();
  const [type, setType] = useState<"all" | "company" | "person">("all");
  const [status, setStatus] = useState("");
  const [orgId, setOrgId] = useState("");
  const { data: orgs } = useQuery(() => organizationService.dropdown().catch(() => []));
  const [editing, setEditing] = useState<Debtor | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toggling, setToggling] = useState<Debtor | null>(null);

  useEffect(() => { if (params.get("new")) { setEditing(null); setFormOpen(true); } }, [params]);

  const { data, loading, error, reload } = useQuery(
    () => debtorService.list({
      page: list.page, perPage: list.perPage, search: list.debounced || undefined,
      isCompany: type === "all" ? undefined : type === "company", isActive: status ? status === "active" : undefined,
      organizationId: orgId ? Number(orgId) : undefined,
    }),
    [list.page, list.debounced, type, status, orgId],
  );
  const { data: stats, reload: reloadStats } = useQuery(() => debtorService.dashboard());

  const columns: Column<Debtor>[] = [
    {
      key: "name", header: "Devedor", cell: (d) => (
        <div className="flex items-center gap-3">
          <Avatar name={d.name} size="sm" />
          <div className="min-w-0">
            <p className="max-w-[240px] truncate font-medium">{d.name}</p>
            <p className="text-xs text-muted">{d.email}</p>
          </div>
        </div>
      ),
    },
    { key: "nif", header: "NIF", cell: (d) => <span className="font-mono text-xs">{d.nif ?? "—"}</span> },
    { key: "type", header: "Tipo", cell: (d) => <Badge tone={d.isCompany ? "info" : "neutral"}>{d.isCompany ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}{d.debtorType?.name ?? (d.isCompany ? "Empresa" : "Particular")}</Badge> },
    { key: "phone", header: "Telefone", cell: (d) => <span className="tabular text-muted">{d.phoneNumber}</span>, hideOnMobile: true },
    { key: "org", header: "Credor", cell: (d) => <span className="text-muted">{d.organization?.name ?? "—"}</span>, hideOnMobile: true },
    { key: "status", header: "Estado", cell: (d) => <ActiveBadge active={d.isActive} /> },
    { key: "created", header: "Registado", cell: (d) => <span className="text-muted">{formatDate(d.createdAt)}</span>, hideOnMobile: true },
    {
      key: "actions", header: "", align: "right", cell: (d) => (
        <Dropdown trigger={<Button variant="ghost" size="icon-sm" aria-label="Acções"><MoreHorizontal className="h-4 w-4" /></Button>}>
          <MenuItem icon={<Eye />} onClick={() => router.push(`/debtors/${d.id}`)}>Ver detalhes</MenuItem>
          <MenuItem icon={<Pencil />} onClick={() => { setEditing(d); setFormOpen(true); }}>Editar</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Power />} danger={d.isActive} onClick={() => setToggling(d)}>{d.isActive ? "Desactivar" : "Activar"}</MenuItem>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Devedores" description="Empresas e particulares com dívidas sob gestão."
        actions={<>
          <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>Importar</Button>
          <ExportPdfButton path="debtors/export/pdf" name="devedores" disabled={!data?.data.length}
            params={{ search: list.debounced || undefined, isCompany: type === "all" ? undefined : type === "company", isActive: status ? status === "active" : undefined, organizationId: orgId ? Number(orgId) : undefined }} />
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => data && downloadFile("devedores.csv", toCsv(data.data.map((d) => ({ Nome: d.name, NIF: d.nif, Email: d.email, Telefone: d.phoneNumber, Tipo: d.debtorType?.name ?? "", Credor: d.organization?.name ?? "" }))))}>Exportar CSV</Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>Novo devedor</Button>
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de devedores" value={formatNumber(stats?.totalDebtors ?? 0)} icon={<Users />} />
        <StatCard label="Activos" value={formatNumber(stats?.totalDebtorsActive ?? 0)} icon={<UserCheck />} tone="success" />
        <StatCard label="Empresas" value={formatNumber(stats?.totalDebtorCompany ?? 0)} icon={<Building2 />} tone="info" />
        <StatCard label="Particulares" value={formatNumber(stats?.totalDebtorParticular ?? 0)} icon={<User />} tone="neutral" />
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      <DataTable
        columns={columns} rows={data?.data} meta={data?.meta} loading={loading} onRefresh={reload} onPage={list.setPage}
        onRowClick={(d) => router.push(`/debtors/${d.id}`)}
        toolbar={<>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Pesquisar por nome, NIF, email…" />
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl value={type} onChange={(v) => { setType(v); list.setPage(1); }}
              options={[{ value: "all", label: "Todos" }, { value: "company", label: "Empresas" }, { value: "person", label: "Particulares" }]} />
            <Select value={status} onChange={(e) => { setStatus(e.target.value); list.setPage(1); }} className="w-36">
              <option value="">Todos estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </Select>
            <Select value={orgId} onChange={(e) => { setOrgId(e.target.value); list.setPage(1); }} className="w-48">
              <option value="">Todos os credores</option>
              {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </div>
        </>}
        empty={{ title: "Nenhum devedor encontrado", description: "Registe o primeiro devedor ou importe uma lista em Excel.", action: <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>Novo devedor</Button> }}
      />

      <DebtorFormDrawer open={formOpen} onClose={() => { setFormOpen(false); if (params.get("new")) router.replace("/debtors"); }} debtor={editing} onSaved={() => { reload(); reloadStats(); }} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} title="Importar devedores" description="Carregue um ficheiro Excel com a lista de devedores."
        columnsHint="Colunas esperadas: nome, NIF, email, telefone, endereço, tipo de devedor, credor e pessoa de contacto."
        onImport={importService.debtors} onDone={() => { reload(); reloadStats(); }} />
      <ConfirmDialog open={!!toggling} onClose={() => setToggling(null)} tone={toggling?.isActive ? "danger" : "primary"}
        title={toggling?.isActive ? "Desactivar devedor?" : "Activar devedor?"}
        description={<>O devedor <b>{toggling?.name}</b> será {toggling?.isActive ? "desactivado e deixará de aparecer nas novas cobranças" : "reactivado"}.</>}
        confirmLabel={toggling?.isActive ? "Desactivar" : "Activar"}
        onConfirm={async () => {
          if (!toggling) return;
          try {
            const r = await debtorService.setActive(toggling.id, !toggling.isActive);
            toast("success", r.message);
            reload(); reloadStats();
          } catch (e) { toast("error", "Não foi possível alterar o estado", errorMessage(e)); }
          setToggling(null);
        }} />
    </>
  );
}

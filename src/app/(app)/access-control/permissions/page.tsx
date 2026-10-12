"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Info, ListChecks, ShieldCheck } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/display";
import { SearchInput } from "@/components/ui/form";
import { ErrorBanner } from "@/components/shared/process-list";
import { useQuery } from "@/hooks/use-query";
import { permissionService, roleService } from "@/lib/api/services";
import type { Role } from "@/types/models";

/**
 * Permissões são definidas pelo sistema (não se criam aqui).
 * Mostra o que cada uma permite fazer e quais perfis a têm.
 */
export default function PermissionsPage() {
  const groups = useQuery(() => permissionService.grouped());
  const roles = useQuery(() => roleService.list({ perPage: 100 }).then((r) => r.data).catch(() => [] as Role[]));
  const [q, setQ] = useState("");

  const rolesOf = useMemo(() => {
    const m = new Map<number, Role[]>();
    for (const r of roles.data ?? []) for (const p of r.permissions ?? []) m.set(p.id, [...(m.get(p.id) ?? []), r]);
    return m;
  }, [roles.data]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (groups.data ?? [])
      .map((g) => ({ ...g, permissions: g.permissions.filter((p) => !n || `${g.group} ${p.name} ${p.description ?? ""}`.toLowerCase().includes(n)) }))
      .filter((g) => g.permissions.length > 0);
  }, [groups.data, q]);
  const total = groups.data?.reduce((s, g) => s + g.permissions.length, 0) ?? 0;

  return (
    <>
      <PageHeader title="Permissões" description="O que cada perfil pode fazer na plataforma. As permissões são definidas pelo sistema; atribua-as aos perfis em Perfis."
        breadcrumbs={[{ label: "Controlo de acesso" }, { label: "Permissões" }]} />

      <div className="mb-5 flex items-start gap-3 rounded-xl border bg-brand-50/60 p-4 text-sm dark:bg-brand-500/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <p className="text-muted">
          Para dar ou retirar acessos, abra <Link href="/access-control/roles" className="font-medium text-brand-600 hover:underline">Perfis</Link> e
          escolha <span className="font-medium text-[var(--text)]">Gerir permissões</span>. O perfil super-admin tem sempre todas as permissões.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={q} onChange={setQ} placeholder="Procurar por acção, ex.: aprovar" />
        {groups.data && <span className="text-[13px] text-muted">{total} permissões em {groups.data.length} áreas</span>}
      </div>
      {groups.error && <ErrorBanner message={groups.error} onRetry={groups.reload} />}

      {groups.loading && !groups.data ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<ListChecks />} title="Nenhuma permissão encontrada" description="Experimente outra palavra." /></Card>
      ) : (
        <div className="space-y-5">
          {filtered.map((g) => (
            <Card key={g.group} padded={false}>
              <div className="flex items-center justify-between border-b px-5 py-3.5">
                <h2 className="text-sm font-semibold">{g.group}</h2>
                <span className="text-xs text-muted">{g.permissions.length}</span>
              </div>
              <ul className="divide-y">
                {g.permissions.map((p) => {
                  const rs = rolesOf.get(p.id) ?? [];
                  return (
                    <li key={p.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:gap-6">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="mt-0.5 text-[13px] text-muted">{p.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:max-w-[45%] sm:justify-end">
                        {rs.length ? rs.map((r) => (
                          <Badge key={r.id} tone={r.slug === "super-admin" ? "brand" : "neutral"}>
                            {r.slug === "super-admin" && <ShieldCheck className="mr-1 h-3 w-3" />}{r.name}
                          </Badge>
                        )) : <span className="text-xs text-muted">Nenhum perfil</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

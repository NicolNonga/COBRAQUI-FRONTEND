"use client";
import { useEffect, useMemo, useState } from "react";
import { KeyRound, MoreHorizontal, Pencil, Plus, Power, Search, ShieldCheck } from "lucide-react";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Switch, Textarea } from "@/components/ui/form";
import { Drawer, Dropdown, MenuItem, MenuSeparator, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { ActiveBadge } from "@/components/shared/status";
import { ErrorBanner } from "@/components/shared/process-list";
import { useQuery } from "@/hooks/use-query";
import { permissionService, roleService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import { useAuth } from "@/components/shared/auth-provider";
import { P, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import type { PermissionGroup, Role } from "@/types/models";

export default function RolesPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useQuery(() => roleService.list({ perPage: 100 }).then((r) => r.data));
  const [editing, setEditing] = useState<Role | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [permRole, setPermRole] = useState<Role | null>(null);
  const { can } = useAuth();
  const canManage = can(P.ROLE_MANAGE);
  const confirm = useConfirm();

  async function toggle(r: Role) {
    try {
      let msg = "";
      const ok = await confirm({
        title: r.isActive ? `Desactivar o perfil ${r.name}?` : `Activar o perfil ${r.name}?`,
        description: r.isActive
          ? "Os utilizadores com este perfil perdem de imediato todas as permissões dele e deixam de conseguir usar as funcionalidades associadas."
          : "Os utilizadores com este perfil voltam a ter as permissões associadas.",
        confirmLabel: r.isActive ? "Desactivar perfil" : "Activar perfil", tone: r.isActive ? "danger" : "primary",
        onConfirm: async () => { msg = (await roleService.setActive(r.id, !r.isActive)).message; },
      });
      if (ok) { toast("success", msg); reload(); }
    } catch (e) { toast("error", "Não foi possível alterar", errorMessage(e)); }
  }

  return (
    <>
      <PageHeader title="Perfis" description="Perfis de acesso e as permissões associadas a cada um."
        breadcrumbs={[{ label: "Controlo de acesso" }, { label: "Perfis" }]}
        actions={canManage && <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setFormOpen(true); }}>Novo perfil</Button>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && !data ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />) : data?.map((r) => (
          <Card key={r.id} className="flex flex-col">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15"><ShieldCheck className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5"><ActiveBadge active={r.isActive} />{r.isManager && <Badge tone="brand">Gestor</Badge>}{r.slug === SUPER_ADMIN_ROLE && <Badge tone="neutral">Acesso total</Badge>}</div>
              </div>
              {canManage && r.slug !== SUPER_ADMIN_ROLE && <Dropdown trigger={<Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>}>
                <MenuItem icon={<Pencil />} onClick={() => { setEditing(r); setFormOpen(true); }}>Editar</MenuItem>
                <MenuItem icon={<KeyRound />} onClick={() => setPermRole(r)}>Gerir permissões</MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Power />} danger={r.isActive} onClick={() => toggle(r)}>{r.isActive ? "Desactivar" : "Activar"}</MenuItem>
              </Dropdown>}
            </div>
            <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted">{r.description || "Sem descrição."}</p>
            <div className="mt-4 flex items-center justify-end border-t pt-4">
              <Button variant="secondary" size="sm" icon={<KeyRound className="h-3.5 w-3.5" />} onClick={() => setPermRole(r)}>{r.slug === SUPER_ADMIN_ROLE ? "Todas as permissões" : `${r.permissions?.length ?? 0} permissões`}</Button>
            </div>
          </Card>
        ))}
      </div>
      <RoleFormModal open={formOpen} role={editing} onClose={() => setFormOpen(false)} onSaved={reload} />
      <PermissionsDrawer role={permRole} readOnly={!canManage || permRole?.slug === SUPER_ADMIN_ROLE} onClose={() => setPermRole(null)} onSaved={reload} />
    </>
  );
}

function RoleFormModal({ open, role, onClose, onSaved }: { open: boolean; role: Role | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isManager, setIsManager] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setName(role?.name ?? ""); setDesc(role?.description ?? ""); setIsManager(role?.isManager ?? false); } }, [open, role]);
  return (
    <Modal open={open} onClose={onClose} title={role ? "Editar perfil" : "Novo perfil"} icon={<ShieldCheck className="h-5 w-5" />}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!name.trim()} loading={saving} onClick={async () => {
          setSaving(true);
          try {
            const p = { name: name.trim(), description: desc.trim() || undefined, isManager };
            const r = role ? await roleService.update(role.id, p) : await roleService.create(p);
            toast("success", r.message); onSaved(); onClose();
          } catch (e) { toast("error", "Não foi possível guardar", errorMessage(e)); } finally { setSaving(false); }
        }}>Guardar</Button></>}>
      <div className="space-y-4">
        <Field label="Nome" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Supervisor" /></Field>
        <Field label="Descrição"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <div className="flex items-center justify-between rounded-xl border p-3.5">
          <div><p className="text-sm font-medium">Perfil de gestão</p><p className="text-xs text-muted">Pode ter agentes sob a sua responsabilidade e aprovar operações.</p></div>
          <Switch checked={isManager} onChange={setIsManager} />
        </div>
      </div>
    </Modal>
  );
}

function PermissionsDrawer({ role, readOnly, onClose, onSaved }: { role: Role | null; readOnly: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const isSuper = role?.slug === SUPER_ADMIN_ROLE;
  useEffect(() => {
    if (!role) return;
    setQ(""); setSel(role.permissions?.map((p) => p.id) ?? []);
    permissionService.grouped().then(setGroups).catch((e) => toast("error", "Não foi possível carregar as permissões", errorMessage(e)));
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = groups.reduce((s, g) => s + g.permissions.length, 0);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return groups
      .map((g) => ({ ...g, permissions: g.permissions.filter((p) => !n || `${g.group} ${p.name} ${p.description ?? ""}`.toLowerCase().includes(n)) }))
      .filter((g) => g.permissions.length > 0);
  }, [groups, q]);
  const has = (id: number) => isSuper || sel.includes(id);
  const toggle = (id: number) => { if (!readOnly) setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); };
  const toggleGroup = (ids: number[], on: boolean) => { if (!readOnly) setSel((s) => (on ? [...new Set([...s, ...ids])] : s.filter((x) => !ids.includes(x)))); };
  const original = role?.permissions?.map((p) => p.id) ?? [];
  const dirty = sel.length !== original.length || sel.some((id) => !original.includes(id));

  return (
    <Drawer open={!!role} onClose={onClose} width="max-w-2xl" title={`Permissões · ${role?.name ?? ""}`}
      description={isSuper ? "Acesso total ao sistema" : `${sel.length} de ${total} permissões`}
      footer={readOnly ? <Button variant="secondary" onClick={onClose}>Fechar</Button> : <><Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button loading={saving} disabled={!dirty} onClick={async () => {
          if (!role) return;
          const removing = original.filter((id) => !sel.includes(id)).length;
          if (removing > 0) {
            const ok = await confirm({ title: `Retirar ${removing} permissão(ões) ao perfil ${role.name}?`, confirmLabel: "Guardar alterações",
              description: "Os utilizadores com este perfil perdem esses acessos de imediato, mesmo que estejam a trabalhar agora." }).catch(() => false);
            if (!ok) return;
          }
          setSaving(true);
          try {
            const r = await roleService.syncPermissions(role.id, original, sel);
            toast("success", "Permissões actualizadas", `${r.added} adicionada(s), ${r.removed} removida(s). Os utilizadores deste perfil são afectados de imediato.`); onSaved(); onClose();
          } catch (e) { toast("error", "Não foi possível actualizar as permissões", errorMessage(e)); } finally { setSaving(false); }
        }}>Guardar permissões</Button></>}>
      {isSuper && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border bg-brand-50/60 p-3.5 text-sm dark:bg-brand-500/10">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-muted">O super-admin tem sempre todas as permissões, incluindo as que forem acrescentadas no futuro. Não é possível retirá-las.</p>
        </div>
      )}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar por acção, ex.: aprovar" className="h-9 w-full rounded-lg border surface pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:shadow-focus" />
      </div>
      <div className="space-y-4">
        {filtered.map((g) => {
          const ids = g.permissions.map((p) => p.id);
          const on = ids.filter(has).length;
          return (
            <section key={g.group} className="overflow-hidden rounded-xl border">
              <div className="flex items-center gap-3 border-b bg-subtle px-4 py-2.5">
                <Checkbox checked={on === ids.length} indeterminate={on > 0 && on < ids.length} onChange={() => toggleGroup(ids, on !== ids.length)} />
                <p className="flex-1 text-sm font-semibold">{g.group}</p>
                <span className="text-xs text-muted">{on}/{ids.length}</span>
              </div>
              <ul className="divide-y">
                {g.permissions.map((p) => (
                  <li key={p.id} onClick={() => toggle(p.id)} className={`flex items-start gap-3 px-4 py-3 ${readOnly ? "" : "cursor-pointer hover:bg-subtle"}`}>
                    <Checkbox checked={has(p.id)} onChange={() => toggle(p.id)} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="mt-0.5 text-[13px] text-muted">{p.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {groups.length > 0 && filtered.length === 0 && <p className="py-8 text-center text-sm text-muted">Nenhuma permissão encontrada.</p>}
      </div>
    </Drawer>
  );
}

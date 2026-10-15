"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, MoreHorizontal, Pencil, Plus, Power, ShieldPlus, UserCog } from "lucide-react";
import { Avatar, Badge, PageHeader } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, SearchInput, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog, Drawer, Dropdown, MenuItem, MenuSeparator } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { ActiveBadge } from "@/components/shared/status";
import { ErrorBanner } from "@/components/shared/process-list";
import { displayName, useAuth } from "@/components/shared/auth-provider";
import { useListState, useQuery } from "@/hooks/use-query";
import { catalogService, organizationService, permissionService, roleService, userService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import { P } from "@/lib/permissions";
import type { Category, PermissionGroup, Role, User, UserRef } from "@/types/models";
import { formatDate } from "@/lib/utils";

export default function UsersPage() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const list = useListState();
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [granting, setGranting] = useState<User | null>(null);
  const { can } = useAuth();
  const { data: roles } = useQuery(() => roleService.dropdown().catch(() => [] as Role[]));

  useEffect(() => { if (params.get("new")) { setEditing(null); setOpen(true); } }, [params]);
  useEffect(() => list.setPage(1), [roleId, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, error, reload } = useQuery(() => userService.list({
    page: list.page, perPage: list.perPage, search: list.debounced || undefined, roleId: roleId ? Number(roleId) : undefined, isActive: status ? status === "active" : undefined,
  }), [list.page, list.debounced, roleId, status]);

  const columns: Column<User>[] = [
    { key: "u", header: "Utilizador", cell: (u) => <div className="flex items-center gap-3"><Avatar name={displayName(u)} size="sm" /><div><p className="font-medium">{u.fullName ?? "—"}</p><p className="text-xs text-muted">{u.email}</p></div></div> },
    { key: "r", header: "Perfil", cell: (u) => u.role ? <Badge tone={u.role.isManager ? "brand" : "neutral"}>{u.role.name}</Badge> : <span className="text-muted">—</span> },
    { key: "c", header: "Categoria", cell: (u) => <span className="text-muted">{u.category?.name ?? "—"}</span>, hideOnMobile: true },
    { key: "o", header: "Organização", cell: (u) => <span className="text-muted">{u.organization?.name ?? "—"}</span>, hideOnMobile: true },
    { key: "s", header: "Estado", cell: (u) => <div className="flex flex-wrap gap-1"><ActiveBadge active={u.isActive} />{u.firstAccess && <Badge tone="warning">1.º acesso pendente</Badge>}</div> },
    { key: "d", header: "Criado em", cell: (u) => <span className="text-muted">{formatDate(u.createdAt)}</span>, hideOnMobile: true },
    {
      key: "a", header: "", align: "right", cell: (u) => (
        <Dropdown trigger={<Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>}>
          <MenuItem icon={<Pencil />} onClick={() => { setEditing(u); setOpen(true); }}>Editar</MenuItem>
          {can(P.USER_PERMISSIONS_MANAGE) && <MenuItem icon={<ShieldPlus />} onClick={() => setGranting(u)}>Permissões individuais</MenuItem>}
          <MenuItem icon={<KeyRound />} onClick={() => setResetting(u)}>Repor palavra-passe</MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Power />} danger={u.isActive} onClick={() => setToggling(u)}>{u.isActive ? "Desactivar" : "Activar"}</MenuItem>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Utilizadores" description="Contas com acesso à plataforma e respectivos perfis."
        breadcrumbs={[{ label: "Controlo de acesso" }, { label: "Utilizadores" }]}
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setOpen(true); }}>Novo utilizador</Button>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <DataTable columns={columns} rows={data?.data} meta={data?.meta} loading={loading} onRefresh={reload} onPage={list.setPage} onRowClick={(u) => { setEditing(u); setOpen(true); }}
        toolbar={<>
          <SearchInput value={list.search} onChange={list.setSearch} placeholder="Nome ou email…" />
          <div className="flex gap-2">
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-44"><option value="">Todos os perfis</option>{(roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36"><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></Select>
          </div>
        </>}
        empty={{ title: "Nenhum utilizador", icon: <UserCog /> }} />

      <UserDrawer open={open} user={editing} roles={roles ?? []} onClose={() => { setOpen(false); if (params.get("new")) router.replace("/access-control/users"); }} onSaved={reload} />
      <UserPermissionsDrawer user={granting} onClose={() => setGranting(null)} onSaved={reload} />
      <ConfirmDialog open={!!toggling} onClose={() => setToggling(null)} tone={toggling?.isActive ? "danger" : "primary"}
        title={toggling?.isActive ? "Desactivar utilizador?" : "Activar utilizador?"}
        description={toggling?.isActive ? <><b>{displayName(toggling)}</b> perde imediatamente o acesso à plataforma.</> : <><b>{displayName(toggling)}</b> volta a ter acesso.</>}
        confirmLabel={toggling?.isActive ? "Desactivar" : "Activar"}
        onConfirm={async () => {
          if (!toggling) return;
          try { const r = await userService.setActive(toggling.id, !toggling.isActive); toast("success", r.message); reload(); } catch (e) { toast("error", errorMessage(e)); }
          setToggling(null);
        }} />
      <ConfirmDialog open={!!resetting} onClose={() => setResetting(null)} tone="primary" title="Repor palavra-passe?" confirmLabel="Repor"
        description={<>Será gerada uma nova palavra-passe temporária para <b>{displayName(resetting)}</b>, enviada por email. No próximo acesso terá de a alterar.</>}
        onConfirm={async () => {
          if (!resetting) return;
          try { const r = await userService.adminResetPassword(resetting.id); toast("success", r.message); reload(); } catch (e) { toast("error", errorMessage(e)); }
          setResetting(null);
        }} />
    </>
  );
}

function UserDrawer({ open, user, roles, onClose, onSaved }: { open: boolean; user: User | null; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [cats, setCats] = useState<Category[]>([]);
  const [managers, setManagers] = useState<UserRef[]>([]);
  const [orgs, setOrgs] = useState<{ id: number; name: string }[]>([]);
  const blank = { fullName: "", email: "", phoneNumber: "", roleId: "", categoryId: "", managerId: "", organizationId: "" };
  const [f, setF] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    catalogService.categoriesDropdown().then(setCats).catch(() => setCats([]));
    userService.managers().then(setManagers).catch(() => setManagers([]));
    organizationService.dropdown().then(setOrgs).catch(() => setOrgs([]));
    setErrors({});
    setF(user ? { fullName: user.fullName ?? "", email: user.email, phoneNumber: user.phoneNumber ?? "", roleId: String(user.roleId ?? ""), categoryId: String(user.categoryId ?? ""), managerId: "", organizationId: String(user.organizationId ?? "") } : blank);
  }, [open, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const role = roles.find((r) => String(r.id) === f.roleId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = "Email inválido.";
    if (f.phoneNumber && !/^\+?[0-9 ]{6,20}$/.test(f.phoneNumber)) er.phoneNumber = "Telefone inválido.";
    if (!f.roleId) er.roleId = "Seleccione um perfil.";
    if (!user && role && !role.isManager && !f.managerId) er.managerId = "Seleccione o gestor responsável.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const base = { fullName: f.fullName.trim() || null, email: f.email.trim(), phone_number: f.phoneNumber.trim() || undefined, roleId: Number(f.roleId), categorie_id: f.categoryId ? Number(f.categoryId) : undefined };
      const r = user ? await userService.update(user.id, base)
        : await userService.create({ ...base, organizationId: f.organizationId ? Number(f.organizationId) : undefined, managerId: f.managerId ? Number(f.managerId) : undefined });
      toast("success", r.message, user ? undefined : "Foi enviado um email com a palavra-passe de acesso.");
      onSaved(); onClose();
    } catch (err) { toast("error", "Não foi possível guardar", errorMessage(err)); } finally { setSaving(false); }
  }

  return (
    <Drawer open={open} onClose={onClose} title={user ? "Editar utilizador" : "Novo utilizador"} description={user ? user.email : "O utilizador recebe por email uma palavra-passe temporária."}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="user-form" loading={saving}>{user ? "Guardar" : "Criar utilizador"}</Button></>}>
      <form id="user-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" className="sm:col-span-2"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} placeholder="Nome e apelido" /></Field>
        <Field label="Email" required error={errors.email}><Input type="email" value={f.email} invalid={!!errors.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Telefone" error={errors.phoneNumber}><Input value={f.phoneNumber} invalid={!!errors.phoneNumber} onChange={(e) => setF({ ...f, phoneNumber: e.target.value })} placeholder="+244 923 000 000" /></Field>
        <Field label="Perfil" required error={errors.roleId}>
          <Select value={f.roleId} invalid={!!errors.roleId} placeholder="Seleccione" onChange={(e) => setF({ ...f, roleId: e.target.value })}>
            {roles.filter((r) => r.isActive !== false).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Categoria">
          <Select value={f.categoryId} placeholder="Sem categoria" onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
            {cats.filter((c) => c.isActive !== false).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        {!user && <>
          <Field label="Organização" hint="Opcional: utilizador de um credor.">
            <Select value={f.organizationId} placeholder="Agência (interno)" onChange={(e) => setF({ ...f, organizationId: e.target.value })}>{orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
          </Field>
          {role && !role.isManager && (
            <Field label="Gestor responsável" required error={errors.managerId}>
              <Select value={f.managerId} invalid={!!errors.managerId} placeholder="Seleccione" onChange={(e) => setF({ ...f, managerId: e.target.value })}>{managers.map((m) => <option key={m.id} value={m.id}>{displayName(m)}</option>)}</Select>
            </Field>
          )}
        </>}
      </form>
    </Drawer>
  );
}

/** Permissões dadas só a este utilizador; somam-se às do perfil (que aparecem bloqueadas). */
function UserPermissionsDrawer({ user, onClose, onSaved }: { user: User | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { user: me } = useAuth();
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [fromRole, setFromRole] = useState<Set<string>>(new Set());
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [roleName, setRoleName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const mine = new Set(me?.permissions ?? []);
  const self = !!user && me?.id === user.id;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([permissionService.grouped(), userService.permissions(user.id)])
      .then(([g, p]) => { setGroups(g); setFromRole(new Set(p.fromRole)); setGranted(new Set(p.granted)); setRoleName(p.role?.name ?? null); })
      .catch((e) => toast("error", "Não foi possível carregar", errorMessage(e)))
      .finally(() => setLoading(false));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (slug: string, on: boolean) => setGranted((s) => { const n = new Set(s); if (on) n.add(slug); else n.delete(slug); return n; });

  async function save() {
    if (!user) return;
    setSaving(true);
    try { const r = await userService.setPermissions(user.id, [...granted]); toast("success", r.message); onSaved(); onClose(); }
    catch (e) { toast("error", "Não foi possível guardar", errorMessage(e)); } finally { setSaving(false); }
  }

  return (
    <Drawer open={!!user} onClose={onClose} title="Permissões individuais" description={user ? `${displayName(user)} · perfil ${roleName ?? "—"}` : undefined} width="max-w-2xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save} loading={saving} disabled={loading || self}>Guardar</Button></>}>
      <p className="mb-4 text-sm text-muted">
        Estas permissões somam-se às do perfil e valem só para este utilizador. Para ver os dados de outros agentes, dê <b>“Ver dados de todos os agentes”</b>.
        Só pode dar o que você próprio tem{self ? "; e não pode alterar as suas próprias permissões" : ""}.
      </p>
      {loading ? <p className="text-sm text-muted">A carregar…</p> : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.group}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.group}</h4>
              <ul className="space-y-1">
                {g.permissions.map((p) => {
                  const viaRole = fromRole.has(p.slug);
                  const cannotGive = !viaRole && !granted.has(p.slug) && !mine.has(p.slug);
                  return (
                    <li key={p.slug} className="rounded-lg px-2 py-1.5 hover:bg-[var(--surface-2,transparent)]">
                      <Checkbox checked={viaRole || granted.has(p.slug)} disabled={viaRole || cannotGive || self} onChange={(v) => toggle(p.slug, v)}
                        label={<span><span className="font-medium">{p.name}</span>{viaRole && <Badge className="ml-2">do perfil</Badge>}{cannotGive && <span className="ml-2 text-xs text-muted">(não a tem)</span>}
                          {p.description && <span className="block text-xs text-muted">{p.description}</span>}</span>} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Drawer>
  );
}

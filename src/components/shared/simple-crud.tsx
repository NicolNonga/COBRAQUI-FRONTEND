"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput, Switch, Textarea } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dropdown, MenuItem, MenuSeparator, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useQuery } from "@/hooks/use-query";
import { errorMessage } from "@/lib/api/http";
import type { Pagination } from "@/types/models";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CrudField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "email" | "switch";
  placeholder?: string;
  required?: boolean;
  full?: boolean;
  hint?: string;
  transform?: (v: string) => string;
}

export interface SimpleCrudProps<T extends { id: number }> {
  title: string;
  description: string;
  breadcrumbs?: { label: string; href?: string }[];
  entity: string; // ex: "tipo de cliente"
  icon: ReactNode;
  columns: Column<T>[];
  fields: CrudField[];
  service: { list: () => Promise<T[]>; save?: (p: any) => Promise<unknown>; remove?: (id: number) => Promise<unknown> };
  /** false = só criação (o backend não permite editar registos existentes) */
  allowEdit?: boolean;
  /** texto informativo por baixo do título */
  note?: string;
  toggle?: { key: keyof T; run: (id: number, enable: boolean) => Promise<unknown> };
  searchIn: (row: T) => string;
  defaults?: Record<string, unknown>;
}

const PER_PAGE = 10;

export function SimpleCrudPage<T extends { id: number }>(p: SimpleCrudProps<T>) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error, reload } = useQuery(() => p.service.list());
  const nameOf = (row: T) => String((row as Record<string, unknown>).name ?? (row as Record<string, unknown>).code ?? `#${row.id}`);
  const canCreate = !!p.service.save;
  const canEdit = canCreate && p.allowEdit !== false;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setPage(1), [q]);
  const filtered = useMemo(() => (data ?? []).filter((r) => p.searchIn(r).toLowerCase().includes(q.toLowerCase())), [data, q, p]);
  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const meta: Pagination = { total: filtered.length, perPage: PER_PAGE, currentPage: Math.min(page, lastPage), lastPage, firstPage: 1 };
  const rows = filtered.slice((meta.currentPage - 1) * PER_PAGE, meta.currentPage * PER_PAGE);

  const openForm = (row: T | null) => {
    setEditing(row);
    setErrors({});
    const init: Record<string, any> = { ...(p.defaults ?? {}) };
    p.fields.forEach((f) => (init[f.name] = row ? (row as any)[f.name] : init[f.name] ?? (f.type === "switch" ? true : "")));
    setForm(init);
    setOpen(true);
  };

  async function save() {
    const er: Record<string, string> = {};
    p.fields.forEach((f) => { if (f.required && !String(form[f.name] ?? "").trim()) er[f.name] = "Campo obrigatório."; });
    p.fields.forEach((f) => { if (f.type === "email" && form[f.name] && !/^\S+@\S+\.\S+$/.test(form[f.name])) er[f.name] = "Email inválido."; });
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      await p.service.save?.({ ...form, id: editing?.id });
      toast("success", editing ? `${cap(p.entity)} actualizado(a)` : `${cap(p.entity)} criado(a)`);
      setOpen(false); reload();
    } catch (e) { toast("error", "Erro ao guardar", errorMessage(e)); } finally { setSaving(false); }
  }

  const hasActions = canEdit || !!p.toggle || !!p.service.remove;
  const columns: Column<T>[] = [
    ...p.columns,
    ...(hasActions ? [{
      key: "__actions", header: "", align: "right", cell: (row) => (
        <Dropdown trigger={<Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>}>
          {canEdit && <MenuItem icon={<Pencil />} onClick={() => openForm(row)}>Editar</MenuItem>}
          {p.toggle && (
            <MenuItem icon={<Power />} onClick={async () => {
              const on = !!row[p.toggle!.key];
              try {
                const ok = await confirm({
                  title: `${on ? "Desactivar" : "Activar"} ${p.entity}?`,
                  description: on
                    ? <><b>{nameOf(row)}</b> deixa de estar disponível para seleccionar nos formulários. Pode voltar a activar mais tarde.</>
                    : <><b>{nameOf(row)}</b> volta a estar disponível em toda a plataforma.</>,
                  confirmLabel: on ? "Desactivar" : "Activar", tone: on ? "danger" : "primary",
                  onConfirm: () => p.toggle!.run(row.id, !on),
                });
                if (ok) { toast("success", on ? "Desactivado" : "Activado"); reload(); }
              } catch (e) { toast("error", "Não foi possível alterar", errorMessage(e)); }
            }}>
              {row[p.toggle.key] ? "Desactivar" : "Activar"}
            </MenuItem>
          )}
          {p.service.remove && <><MenuSeparator /><MenuItem icon={<Trash2 />} danger onClick={async () => {
            try {
              const ok = await confirm({
                title: `Eliminar ${p.entity}?`, confirmLabel: "Eliminar",
                description: <><b>{nameOf(row)}</b> será eliminado. Esta acção não pode ser revertida e registos associados podem ser afectados.</>,
                onConfirm: () => p.service.remove!(row.id),
              });
              if (ok) { toast("success", "Registo eliminado"); reload(); }
            } catch (e) { toast("error", "Não foi possível eliminar", errorMessage(e)); }
          }}>Eliminar</MenuItem></>}
        </Dropdown>
      ),
    } as Column<T>] : []),
  ];

  return (
    <>
      <PageHeader title={p.title} description={p.description} breadcrumbs={p.breadcrumbs}
        actions={canCreate ? <Button icon={<Plus className="h-4 w-4" />} onClick={() => openForm(null)}>Novo(a) {p.entity}</Button> : undefined} />
      {p.note && <p className="-mt-3 mb-4 rounded-xl bg-subtle px-4 py-2.5 text-[13px] text-muted">{p.note}</p>}
      {error && <p className="mb-4 rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:bg-danger-500/10">{error}</p>}
      <DataTable columns={columns} rows={rows} meta={meta} onPage={setPage} loading={loading} onRefresh={reload} onRowClick={canEdit ? (r) => openForm(r) : undefined}
        toolbar={<><SearchInput value={q} onChange={setQ} /><span className="text-[13px] text-muted">{filtered.length} registo(s)</span></>}
        empty={{ title: `Nenhum(a) ${p.entity}`, description: "Crie o primeiro registo para começar.", icon: p.icon, action: canCreate ? <Button size="sm" onClick={() => openForm(null)}>Criar</Button> : undefined }} />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `Editar ${p.entity}` : `Novo(a) ${p.entity}`} icon={p.icon} size={p.fields.length > 3 ? "lg" : "md"}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancelar</Button><Button loading={saving} onClick={save}>Guardar</Button></>}>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="grid gap-4 sm:grid-cols-2">
          {p.fields.map((f) => (
            <Field key={f.name} label={f.type === "switch" ? undefined : f.label} required={f.required} error={errors[f.name]} hint={f.hint}
              className={f.full || f.type === "textarea" || p.fields.length <= 2 ? "sm:col-span-2" : undefined}>
              {f.type === "textarea" ? (
                <Textarea value={form[f.name] ?? ""} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} />
              ) : f.type === "switch" ? (
                <div className="flex items-center justify-between rounded-xl border p-3.5">
                  <span className="text-sm font-medium">{f.label}</span>
                  <Switch checked={!!form[f.name]} onChange={(v) => setForm({ ...form, [f.name]: v })} />
                </div>
              ) : (
                <Input type={f.type ?? "text"} value={form[f.name] ?? ""} placeholder={f.placeholder} invalid={!!errors[f.name]}
                  onChange={(e) => setForm({ ...form, [f.name]: f.transform ? f.transform(e.target.value) : e.target.value })} />
              )}
            </Field>
          ))}
          <button type="submit" className="hidden" />
        </form>
      </Modal>


    </>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

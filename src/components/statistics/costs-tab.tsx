"use client";
import { useEffect, useState } from "react";
import { Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput, SegmentedControl, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/overlay";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/shared/auth-provider";
import { ErrorBanner } from "@/components/shared/process-list";
import { useListState, useQuery } from "@/hooks/use-query";
import { errorMessage } from "@/lib/api/http";
import { organizationService } from "@/lib/api/services";
import { reportService } from "@/lib/api/reports";
import { P } from "@/lib/permissions";
import { todayIso } from "@/lib/utils";
import type { CollectionCost, CostCategory } from "@/types/reports";
import { dateS, Explain, money, periodFor, type Preset } from "./shared";

export function CostsTab() {
  const toast = useToast();
  const confirm = useConfirm();
  const { can } = useAuth();
  const canManage = can(P.REPORTS_COST_MANAGE);
  const list = useListState({ perPage: 20 });
  const [preset, setPreset] = useState<Preset>("year");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<CollectionCost | "new" | null>(null);
  const period = periodFor(preset, { from: `${todayIso().slice(0, 4)}-01-01`, to: todayIso() });
  useEffect(() => list.setPage(1), [preset, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = { page: list.page, perPage: list.perPage, from: period.from, to: period.to, category: category || undefined, search: list.debounced || undefined };
  const { data, loading, error, reload } = useQuery(() => reportService.costs(query), [JSON.stringify(query)]);
  const { data: categories } = useQuery(() => reportService.costCategories().catch(() => []));
  const catLabel = (c: string) => categories?.find((x) => x.value === c)?.label ?? c;
  const total = Number(data?.summary.amount ?? 0);

  const cols: Column<CollectionCost>[] = [
    { key: "date", header: "Data", cell: (c) => <span className="tabular">{dateS(c.costDate)}</span> },
    { key: "cat", header: "Categoria", cell: (c) => <span className="text-[13px]">{catLabel(c.category)}</span> },
    { key: "desc", header: "Descrição", cell: (c) => <span className="line-clamp-2 max-w-[320px]">{c.description}</span> },
    { key: "org", header: "Credor", hideOnMobile: true, cell: (c) => c.organizationName ?? <span className="text-xs text-muted">Geral</span> },
    { key: "by", header: "Lançado por", hideOnMobile: true, cell: (c) => <span className="text-[13px] text-muted">{c.createdByName ?? "—"}</span> },
    { key: "amount", header: "Valor", align: "right", cell: (c) => <span className="tabular font-medium">{money(c.amount)}</span> },
    {
      key: "act", header: "", align: "right", cell: (c) => canManage ? (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Editar" title="Editar" onClick={(e) => { e.stopPropagation(); setEditing(c); }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Remover" title="Remover" onClick={async (e) => {
            e.stopPropagation();
            await confirm({
              title: "Remover este custo?", tone: "danger", confirmLabel: "Remover",
              description: `${c.description} · ${money(c.amount)}. O custo por cobrança dos períodos afectados é recalculado. A remoção fica registada na auditoria.`,
              onConfirm: async () => { const r = await reportService.deleteCost(c.id); toast("success", r.message); reload(); },
            }).catch((err) => toast("error", "Não foi possível remover", errorMessage(err)));
          }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ) : null,
    },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SegmentedControl value={preset} onChange={setPreset} options={[{ value: "month", label: "Este mês" }, { value: "90d", label: "90 dias" }, { value: "year", label: "Este ano" }]} />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 w-56" aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {(categories ?? []).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>
        {canManage && <div className="ml-auto"><Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>Lançar custo</Button></div>}
      </div>
      {error && <ErrorBanner message={error} onRetry={reload} />}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Total no período" description={`${dateS(period.from)} a ${dateS(period.to)}`} />
          <p className="tabular mt-3 text-[26px] font-semibold tracking-tight">{money(total)}</p>
          <div className="mt-4 space-y-2.5">
            {(data?.summary.byCategory ?? []).map((c) => (
              <div key={c.category}>
                <div className="mb-1 flex justify-between text-[13px]"><span className="text-muted">{c.label}</span><span className="tabular font-medium">{money(c.amount)}</span></div>
                <div className="h-1.5 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-brand-500" style={{ width: `${total ? (Number(c.amount) / total) * 100 : 0}%` }} /></div>
              </div>
            ))}
            {data && !data.summary.byCategory.length && <p className="text-sm text-muted">Sem custos lançados neste período.</p>}
          </div>
        </Card>
        <div className="xl:col-span-2">
          <DataTable columns={cols} rows={data?.data} meta={data?.meta} loading={loading} onPage={list.setPage} onRefresh={reload}
            onRowClick={canManage ? (c) => setEditing(c) : undefined}
            toolbar={<SearchInput value={list.search} onChange={list.setSearch} placeholder="Pesquisar descrição…" className="sm:w-72" />}
            empty={{ title: "Sem custos lançados", description: canManage ? "Lance os custos da operação para calcular o custo por cobrança." : "Ainda não há custos neste período.", icon: <Receipt />,
              action: canManage ? <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>Lançar custo</Button> : undefined }} />
        </div>
      </div>
      <Explain>
        Lance aqui o que a operação de cobrança custa (salários da equipa, chamadas e SMS, sistemas, deslocações, advogados…). O indicador <b>Custo por cobrança</b> divide estes custos pelo valor recuperado no mesmo período.
        Um custo associado a um credor conta só para esse credor; um custo geral é repartido pelos credores na proporção do valor recuperado de cada um.
      </Explain>

      <CostModal cost={editing} categories={categories ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />
    </>
  );
}

function CostModal({ cost, categories, onClose, onSaved }: {
  cost: CollectionCost | "new" | null; categories: { value: CostCategory; label: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const { data: orgs } = useQuery(() => organizationService.dropdown().catch(() => []));
  const empty = { costDate: todayIso(), category: "STAFF" as CostCategory, description: "", amount: "", organizationId: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (cost && cost !== "new") setForm({ costDate: cost.costDate, category: cost.category, description: cost.description, amount: Number(cost.amount).toFixed(2), organizationId: cost.organizationId ? String(cost.organizationId) : "" });
    else setForm(empty);
    setErrors({});
  }, [cost]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const amount = form.amount.replace(/\s/g, "").replace(",", ".");
    const e: Record<string, string> = {};
    if (!form.costDate) e.costDate = "Indique a data";
    if (!form.description.trim()) e.description = "Descreva o custo";
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) e.amount = "Valor inválido (ex.: 150000,00)";
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload = { costDate: form.costDate, category: form.category, description: form.description.trim(), amount, organizationId: form.organizationId ? Number(form.organizationId) : null };
    try {
      const r = cost && cost !== "new" ? await reportService.updateCost(cost.id, payload) : await reportService.createCost(payload);
      toast("success", r.message);
      onSaved();
    } catch (err) {
      toast("error", "Não foi possível guardar", errorMessage(err));
    }
  };

  return (
    <Modal open={cost !== null} onClose={onClose} title={cost === "new" ? "Lançar custo" : "Editar custo"} description="Custos da operação de cobrança, usados no indicador de custo por cobrança." icon={<Receipt className="h-5 w-5" />}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={save}>{cost === "new" ? "Lançar" : "Guardar"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data" required error={errors.costDate}><Input type="date" value={form.costDate} max={todayIso()} onChange={(e) => setForm({ ...form, costDate: e.target.value })} /></Field>
        <Field label="Categoria" required>
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as CostCategory })}>
            {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="Descrição" required error={errors.description} className="sm:col-span-2">
          <Input value={form.description} maxLength={255} placeholder="Ex.: Pacote de SMS de Outubro" onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Valor (Kz)" required error={errors.amount}>
          <Input inputMode="decimal" value={form.amount} placeholder="0,00" onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Credor" hint="Vazio = custo geral, repartido por todos">
          <Select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
            <option value="">Custo geral</option>
            {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

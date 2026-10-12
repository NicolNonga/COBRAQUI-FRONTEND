"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft, Bot, Eye, FolderKanban, Handshake, MessageSquarePlus, MoreHorizontal, PhoneCall, RefreshCw, Trash2, UserPlus,
} from "lucide-react";
import { Avatar, Card, DescriptionList, EmptyState, PageHeader, Skeleton, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput, SegmentedControl, Select, Textarea } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog, Drawer, Dropdown, MenuItem, MenuSeparator, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { ContactStatusBadge, InvoiceStatusBadge, ProcessStateBadge, contactStatusMeta, processStateMeta } from "@/components/shared/status";
import { TransferModal } from "@/components/shared/transfer-modal";
import { displayName, useAuth } from "@/components/shared/auth-provider";
import { useListState, useQuery } from "@/hooks/use-query";
import { ExportPdfButton } from "@/components/shared/export-pdf-button";
import { catalogService, contactService, processService, userService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import { CONTACT_STATUSES, type Contact, type ContactStatus, type ContactType, type Process, type ProcessStateCode, type UserRef } from "@/types/models";
import { formatDate, formatMoney, timeAgo } from "@/lib/utils";

const code = (p: Process) => `PRC-${String(p.id).padStart(5, "0")}`;
const daysAgoIso = (d: number) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

export function ProcessList({ mode }: { mode: "all" | "mine" }) {
  const { user, isManager } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const list = useListState();
  const [state, setState] = useState("");
  const [openFilter, setOpenFilter] = useState<"open" | "closed" | "all">("open");
  const [noContact, setNoContact] = useState("");
  const [lastStatus, setLastStatus] = useState("");
  const [unassigned, setUnassigned] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [transfer, setTransfer] = useState<Process[] | null>(null);
  const [viewing, setViewing] = useState<{ p: Process; tab?: "invoices" | "contacts" | "info" } | null>(null);
  const [assigning, setAssigning] = useState<Process | null>(null);
  const [busy, setBusy] = useState<"generate" | "auto" | null>(null);

  const query = {
    page: list.page, perPage: list.perPage, search: list.debounced || undefined, state: state || undefined,
    open: openFilter === "all" ? undefined : openFilter === "open",
    noContactSince: noContact ? daysAgoIso(Number(noContact)) : undefined, lastContactStatus: lastStatus || undefined,
    unassigned: unassigned || undefined, assignedUserId: mode === "mine" ? user?.id : undefined,
  };
  const { data, loading, error, reload } = useQuery(() => processService.list(query), [JSON.stringify(query)]);
  useEffect(() => { list.setPage(1); setSelected([]); }, [state, openFilter, noContact, lastStatus, unassigned]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.data ?? [];
  const selectedRows = rows.filter((r) => selected.includes(r.id));

  function startTransfer(ps: Process[]) {
    const owners = new Set(ps.map((p) => p.assignment?.userId ?? 0));
    if (owners.has(0)) return toast("error", "Há processos sem responsável", "Atribua primeiro um agente aos processos sem responsável.");
    if (owners.size > 1) return toast("error", "Agentes diferentes", "Seleccione processos do mesmo agente para transferir de uma vez.");
    setTransfer(ps);
  }

  const columns: Column<Process>[] = [
    { key: "id", header: "Processo", cell: (p) => <span className="font-mono text-xs font-medium">{code(p)}</span> },
    {
      key: "debtor", header: "Devedor", cell: (p) => (
        <div className="flex items-center gap-2.5"><Avatar name={p.debtor?.name ?? "?"} size="xs" />
          <div className="min-w-0"><p className="max-w-[220px] truncate font-medium">{p.debtor?.name}</p><p className="font-mono text-[11px] text-muted">{p.debtor?.nif}</p></div>
        </div>
      ),
    },
    { key: "inv", header: "Facturas", align: "right", cell: (p) => <span className="tabular">{p.invoicesCount ?? 0}</span>, hideOnMobile: true },
    { key: "amount", header: "Em dívida", align: "right", cell: (p) => <span className="tabular font-medium">{formatMoney(p.totalAmount)}</span> },
    { key: "state", header: "Estado", cell: (p) => <ProcessStateBadge code={p.processState?.code} name={p.processState?.name} /> },
    ...(mode === "all" ? [{
      key: "agent", header: "Agente", hideOnMobile: true, cell: (p: Process) => p.assignment?.user
        ? <div className="flex items-center gap-2"><Avatar name={displayName(p.assignment.user)} size="xs" /><span className="text-muted">{displayName(p.assignment.user)}</span></div>
        : <span className="text-xs text-warning-600">Sem responsável</span>,
    }] : []),
    {
      key: "contact", header: "Último contacto", cell: (p) => p.lastContactAt ? (
        <div><div className="flex items-center gap-2"><ContactStatusBadge value={p.lastContactStatus} /></div>
          <p className="mt-0.5 text-xs text-muted">{timeAgo(p.lastContactAt)} · {p.contactsCount} contacto(s)</p></div>
      ) : <span className="text-xs text-danger-600">Nunca contactado</span>,
    },
    {
      key: "a", header: "", align: "right", cell: (p) => (
        <Dropdown trigger={<Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>}>
          <MenuItem icon={<Eye />} onClick={() => setViewing({ p })}>Ver processo</MenuItem>
          <MenuItem icon={<PhoneCall />} onClick={() => setViewing({ p, tab: "contacts" })}>Registar contacto</MenuItem>
          <MenuSeparator />
          {!p.assignment && <MenuItem icon={<UserPlus />} onClick={() => setAssigning(p)}>Atribuir a agente</MenuItem>}
          {p.assignment && <MenuItem icon={<ArrowRightLeft />} onClick={() => startTransfer([p])}>Transferir</MenuItem>}
          <Link href={`/negotiations/new?debtorId=${p.debtorId}&processId=${p.id}`}><MenuItem icon={<Handshake />}>Iniciar negociação</MenuItem></Link>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={mode === "mine" ? "Meus processos" : "Processos"}
        description={mode === "mine" ? "Processos de cobrança pelos quais é responsável." : "Todos os processos de cobrança, com responsável e histórico de contactos."}
        actions={<>
          <ExportPdfButton path="process/export/pdf" name={mode === "mine" ? "meus_processos" : "processos"} params={query} disabled={!data?.data.length} />
          {mode === "all" && isManager && <>
          <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} loading={busy === "generate"} onClick={async () => {
            setBusy("generate");
            try {
              let r: Awaited<ReturnType<typeof processService.generate>> | null = null;
              const ok = await confirm({ title: "Gerar processos agora?", tone: "primary", confirmLabel: "Gerar processos",
                description: "Todas as facturas vencidas que ainda não estão em cobrança passam a processos (uma por devedor). Isto também acontece automaticamente; use para não esperar pelo próximo ciclo.",
                onConfirm: async () => { r = await processService.generate(); } });
              if (ok && r) { const x = r as Awaited<ReturnType<typeof processService.generate>>; toast("success", x.message, `${x.data.processesCreated} processo(s) · ${x.data.invoicesLinked} factura(s)`); reload(); }
            } catch (e) { toast("error", "Falha ao gerar processos", errorMessage(e)); } finally { setBusy(null); }
          }}>Gerar processos</Button>
          <Button variant="secondary" icon={<Bot className="h-4 w-4" />} loading={busy === "auto"} onClick={async () => {
            setBusy("auto");
            try {
              let msg = "";
              const ok = await confirm({ title: "Atribuir processos pelas carteiras?", tone: "primary", confirmLabel: "Atribuir",
                description: "Os processos sem responsável são atribuídos ao dono da carteira de cada devedor, e cada um recebe uma notificação.",
                onConfirm: async () => { msg = (await processService.autoAssign()).message; } });
              if (ok) { toast("success", msg); reload(); }
            } catch (e) { toast("error", "Falha na atribuição automática", errorMessage(e)); } finally { setBusy(null); }
          }}>Atribuir pelas carteiras</Button>
        </>}
        </>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SegmentedControl value={openFilter} onChange={setOpenFilter} options={[{ value: "open", label: "Abertos" }, { value: "closed", label: "Fechados" }, { value: "all", label: "Todos" }]} />
        <Select value={state} onChange={(e) => setState(e.target.value)} className="w-40">
          <option value="">Todos os estados</option>
          {(Object.keys(processStateMeta) as ProcessStateCode[]).map((s) => <option key={s} value={s}>{processStateMeta[s].label}</option>)}
        </Select>
        <Select value={noContact} onChange={(e) => setNoContact(e.target.value)} className="w-48">
          <option value="">Qualquer último contacto</option>
          <option value="3">Sem contacto há 3+ dias</option>
          <option value="7">Sem contacto há 7+ dias</option>
          <option value="15">Sem contacto há 15+ dias</option>
          <option value="30">Sem contacto há 30+ dias</option>
        </Select>
        <Select value={lastStatus} onChange={(e) => setLastStatus(e.target.value)} className="w-48">
          <option value="">Qualquer resultado</option>
          {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{contactStatusMeta[s].label}</option>)}
        </Select>
        {mode === "all" && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={unassigned} onChange={(e) => setUnassigned(e.target.checked)} className="accent-[var(--color-brand-600)]" /> Só sem responsável
          </label>
        )}
      </div>

      {error && <ErrorBanner message={error} onRetry={reload} />}
      <DataTable columns={columns} rows={rows} meta={data?.meta} loading={loading} onRefresh={reload} onPage={list.setPage}
        selectable selected={selected} onSelectedChange={setSelected} onRowClick={(p) => setViewing({ p })}
        bulkActions={<Button size="sm" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => startTransfer(selectedRows)}>Transferir seleccionados</Button>}
        toolbar={<SearchInput value={list.search} onChange={list.setSearch} placeholder="Pesquisar devedor ou NIF…" />}
        empty={{ title: "Sem processos", description: mode === "mine" ? "Ainda não tem processos atribuídos." : "Nenhum processo corresponde aos filtros.", icon: <FolderKanban /> }} />

      <ProcessDrawer process={viewing?.p ?? null} initialTab={viewing?.tab} onClose={() => setViewing(null)} onChanged={reload} />
      <TransferModal open={!!transfer} onClose={() => setTransfer(null)} count={transfer?.length ?? 0} noun={transfer?.length === 1 ? "processo" : "processos"}
        excludeUserId={transfer?.[0]?.assignment?.userId}
        onConfirm={async (d) => {
          if (!transfer?.length) return;
          const r = await processService.transfer({ processIds: transfer.map((p) => p.id), fromUserId: transfer[0].assignment!.userId, toUserId: d.toUserId, reason: d.reason, notes: d.notes, permanent: d.permanent, returnAt: d.returnAt });
          toast("success", r.message);
          setSelected([]); reload();
        }} />
      <AssignModal process={assigning} onClose={() => setAssigning(null)} onDone={reload} />
    </>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:bg-danger-500/10">
      <span>{message}</span>
      {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

function AssignModal({ process, onClose, onDone }: { process: Process | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [users, setUsers] = useState<UserRef[]>([]);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (process) { setUserId(""); userService.dropdown().then(setUsers).catch(() => setUsers([])); } }, [process]);
  return (
    <Modal open={!!process} onClose={onClose} title="Atribuir processo" description={process?.debtor?.name} icon={<UserPlus className="h-5 w-5" />}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!userId} loading={busy} onClick={async () => {
          if (!process) return;
          setBusy(true);
          try { await processService.assign(process.id, Number(userId)); toast("success", "Processo atribuído"); onDone(); onClose(); }
          catch (e) { toast("error", "Não foi possível atribuir", errorMessage(e)); } finally { setBusy(false); }
        }}>Atribuir</Button></>}>
      <Field label="Agente responsável">
        <Select value={userId} placeholder="Seleccione" onChange={(e) => setUserId(e.target.value)}>
          {users.map((u) => <option key={u.id} value={u.id}>{displayName(u)}</option>)}
        </Select>
      </Field>
    </Modal>
  );
}

export function ProcessDrawer({ process, initialTab, onClose, onChanged }: { process: Process | null; initialTab?: "invoices" | "contacts" | "info"; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<"invoices" | "contacts" | "info">("invoices");
  useEffect(() => { if (process) setTab(initialTab ?? "invoices"); }, [process, initialTab]);
  const pid = process?.id ?? 0;
  const { data: links, loading: linksLoading, reload: reloadLinks } = useQuery(() => (pid ? processService.invoices(pid) : Promise.resolve(null)), [pid]);
  const { data: contacts, loading: contactsLoading, reload: reloadContacts } = useQuery(() => (pid ? contactService.ofProcess(pid) : Promise.resolve(null)), [pid]);
  const [removeSel, setRemoveSel] = useState<number[]>([]);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRemoveSel([]); }, [pid]);

  const invoices = (links?.data ?? []).flatMap((l) => (l.invoice ? [l.invoice] : []));
  const total = invoices.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <Drawer open={!!process} onClose={onClose} width="max-w-2xl"
      title={process ? `Processo ${code(process)}` : ""}
      description={process && <span className="flex items-center gap-2">{process.debtor?.name} <ProcessStateBadge code={process.processState?.code} name={process.processState?.name} /></span>}
      footer={process && <Link href={`/negotiations/new?debtorId=${process.debtorId}&processId=${process.id}`}><Button icon={<Handshake className="h-4 w-4" />}>Iniciar negociação</Button></Link>}>
      {process && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-subtle p-4"><p className="text-xs text-muted">Em dívida</p><p className="tabular mt-1 text-lg font-semibold">{formatMoney(process.totalAmount ?? total)}</p></Card>
            <Card className="bg-subtle p-4"><p className="text-xs text-muted">Facturas</p><p className="tabular mt-1 text-lg font-semibold">{process.invoicesCount ?? invoices.length}</p></Card>
            <Card className="bg-subtle p-4"><p className="text-xs text-muted">Contactos</p><p className="tabular mt-1 text-lg font-semibold">{contacts?.meta.total ?? process.contactsCount}</p></Card>
          </div>
          <Tabs value={tab} onChange={setTab} items={[{ value: "invoices", label: "Facturas" }, { value: "contacts", label: "Contactos", count: contacts?.meta.total }, { value: "info", label: "Detalhes" }]} />

          {tab === "invoices" && (
            <div>
              {removeSel.length > 0 && (
                <div className="mb-3 flex items-center justify-between rounded-xl bg-subtle px-4 py-2.5 text-sm">
                  <span>{removeSel.length} factura(s) seleccionada(s)</span>
                  <Button size="sm" variant="outline-danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => { setReason(""); setRemoveOpen(true); }}>Retirar e pôr em disputa</Button>
                </div>
              )}
              {linksLoading && !links ? <Skeleton className="h-40" /> : (
                <div className="overflow-hidden rounded-xl border">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-subtle text-xs text-muted">
                      <th className="w-8 pl-3" /><th className="px-3 py-2 text-left font-medium">Número</th><th className="px-3 py-2 text-right font-medium">Valor</th>
                      <th className="px-3 py-2 text-left font-medium">Vencimento</th><th className="px-3 py-2 text-left font-medium">Estado</th>
                    </tr></thead>
                    <tbody>
                      {invoices.map((i) => (
                        <tr key={i.id} className="border-b last:border-0">
                          <td className="pl-3"><input type="checkbox" className="accent-[var(--color-brand-600)]" checked={removeSel.includes(i.id)} onChange={() => setRemoveSel((s) => (s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id]))} /></td>
                          <td className="px-3 py-2.5 font-mono text-xs">{i.referenceNumber}</td>
                          <td className="tabular px-3 py-2.5 text-right font-medium">{formatMoney(i.amount, i.currency?.code)}</td>
                          <td className="px-3 py-2.5 text-muted">{formatDate(i.dueDate)}</td>
                          <td className="px-3 py-2.5"><InvoiceStatusBadge code={i.invoiceState?.code} name={i.invoiceState?.name} /></td>
                        </tr>
                      ))}
                      {invoices.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Sem facturas neste processo.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "contacts" && <ContactsTab processId={process.id} contacts={contacts?.data ?? []} loading={contactsLoading && !contacts} onCreated={() => { reloadContacts(); onChanged(); }} />}

          {tab === "info" && (
            <DescriptionList items={[
              { label: "Devedor", value: process.debtor?.name },
              { label: "NIF", value: process.debtor?.nif },
              { label: "Responsável", value: process.assignment?.user ? displayName(process.assignment.user) : "Sem responsável" },
              { label: "Entrada em cobrança", value: formatDate(process.startDate ?? process.createdAt) },
              { label: "Último contacto", value: process.lastContactAt ? formatDate(process.lastContactAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Nunca" },
              { label: "Fechado em", value: formatDate(process.closedAt) },
            ]} />
          )}
        </div>
      )}
      <Modal open={removeOpen} onClose={() => setRemoveOpen(false)} title="Retirar facturas do processo" icon={<Trash2 className="h-5 w-5" />}
        description="As facturas saem do processo e ficam “Em disputa” até serem resolvidas."
        footer={<><Button variant="secondary" onClick={() => setRemoveOpen(false)}>Cancelar</Button>
          <Button variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={async () => {
            if (!process) return;
            setBusy(true);
            try {
              const r = await processService.removeInvoices(process.id, removeSel, reason.trim());
              toast("success", r.message); setRemoveOpen(false); setRemoveSel([]); reloadLinks(); onChanged();
            } catch (e) { toast("error", "Não foi possível retirar", errorMessage(e)); } finally { setBusy(false); }
          }}>Retirar {removeSel.length} factura(s)</Button></>}>
        <Field label="Motivo da disputa" required hint="Ex: o devedor contesta a quantidade facturada.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </Drawer>
  );
}

function ContactsTab({ processId, contacts, loading, onCreated }: { processId: number; contacts: Contact[]; loading: boolean; onCreated: () => void }) {
  const toast = useToast();
  const [types, setTypes] = useState<ContactType[]>([]);
  const [form, setForm] = useState({ type: "", status: "answered" as ContactStatus, at: "", minutes: "", notes: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { catalogService.contactTypes().then((r) => setTypes(r.data)).catch(() => setTypes([])); }, []);

  return (
    <div className="space-y-5">
      <Card className="space-y-3 bg-subtle p-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><MessageSquarePlus className="h-4 w-4 text-brand-600" /> Registar contacto</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Canal" required>
            <Select value={form.type} placeholder="Seleccione" onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Resultado" required>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ContactStatus })}>
              {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{contactStatusMeta[s].label}</option>)}
            </Select>
          </Field>
          <Field label="Quando" hint="Vazio = agora (até 30 dias atrás)">
            <Input type="datetime-local" value={form.at} onChange={(e) => setForm({ ...form, at: e.target.value })} />
          </Field>
          <Field label="Duração (min)"><Input type="number" min={0} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} /></Field>
          <Field label="Notas" className="sm:col-span-2"><Textarea rows={2} className="min-h-[60px]" placeholder="O que foi combinado?" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end">
          <Button size="sm" disabled={!form.type} loading={busy} onClick={async () => {
            setBusy(true);
            try {
              await contactService.create({
                processe_id: processId, contact_type_id: Number(form.type), status: form.status,
                contacted_at: form.at ? new Date(form.at).toISOString() : undefined,
                duration: form.minutes ? Math.round(Number(form.minutes) * 60) : undefined, notes: form.notes || undefined,
              });
              toast("success", "Contacto registado");
              setForm({ type: form.type, status: "answered", at: "", minutes: "", notes: "" });
              onCreated();
            } catch (e) { toast("error", "Não foi possível registar", errorMessage(e)); } finally { setBusy(false); }
          }}>Guardar contacto</Button>
        </div>
      </Card>

      {loading ? <Skeleton className="h-32" /> : contacts.length === 0 ? (
        <EmptyState icon={<PhoneCall />} title="Sem contactos" description="Ainda não foi registado nenhum contacto neste processo." />
      ) : (
        <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-[var(--border)]">
          {contacts.map((c) => (
            <li key={c.id} className="relative flex gap-3">
              <Avatar name={displayName(c.user) === "—" ? "?" : displayName(c.user)} size="sm" className="relative z-10 ring-4 ring-[var(--surface)]" />
              <div className="min-w-0 flex-1 rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{c.contactType?.name ?? "Contacto"}</span>
                  <ContactStatusBadge value={c.status} />
                  <span className="ml-auto text-xs text-muted">{formatDate(c.contactedAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {c.notes && <p className="mt-1.5 text-sm text-muted">{c.notes}</p>}
                <p className="mt-1 text-xs text-muted">{displayName(c.user)}{c.durationSeconds ? ` · ${Math.round(c.durationSeconds / 60)} min` : ""}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

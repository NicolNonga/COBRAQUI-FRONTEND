"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Plus, Search, UserMinus, Wallet } from "lucide-react";
import { Avatar, Badge, PageHeader } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Checkbox, SearchInput, Select } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { ActiveBadge } from "@/components/shared/status";
import { TransferModal } from "@/components/shared/transfer-modal";
import { ErrorBanner } from "@/components/shared/process-list";
import { displayName, useAuth } from "@/components/shared/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { debtorService, userService, walletService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { Debtor, Pagination } from "@/types/models";

const PER = 10;

export default function WalletPage() {
  const { user, isManager } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [owner, setOwner] = useState<number>(user!.id);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: team } = useQuery(() => (isManager ? userService.myAgents().catch(() => []) : Promise.resolve([])), [isManager]);
  const { data, loading, error, reload } = useQuery(() => walletService.ofUser(owner), [owner]);
  useEffect(() => { setSelected([]); setPage(1); }, [owner, q]);

  const filtered = useMemo(() => (data ?? []).filter((d) => `${d.name} ${d.nif ?? ""} ${d.email}`.toLowerCase().includes(q.toLowerCase())), [data, q]);
  const meta: Pagination = { total: filtered.length, perPage: PER, currentPage: page, lastPage: Math.max(1, Math.ceil(filtered.length / PER)), firstPage: 1 };
  const rows = filtered.slice((page - 1) * PER, page * PER);
  const ownerName = owner === user?.id ? "Minha carteira" : `Carteira de ${displayName(team?.find((t) => t.id === owner))}`;

  const columns: Column<Debtor>[] = [
    { key: "n", header: "Devedor", cell: (d) => <div className="flex items-center gap-3"><Avatar name={d.name} size="sm" /><div><p className="font-medium">{d.name}</p><p className="text-xs text-muted">{d.email}</p></div></div> },
    { key: "nif", header: "NIF", cell: (d) => <span className="font-mono text-xs">{d.nif ?? "—"}</span> },
    { key: "t", header: "Tipo", cell: (d) => <Badge tone={d.isCompany ? "info" : "neutral"}>{d.debtorType?.name ?? (d.isCompany ? "Empresa" : "Particular")}</Badge> },
    { key: "p", header: "Telefone", cell: (d) => <span className="text-muted">{d.phoneNumber}</span>, hideOnMobile: true },
    { key: "o", header: "Credor", cell: (d) => <span className="text-muted">{d.organization?.name ?? "—"}</span>, hideOnMobile: true },
    { key: "s", header: "Estado", cell: (d) => <ActiveBadge active={d.isActive} /> },
  ];

  return (
    <>
      <PageHeader title={ownerName} description="Devedores atribuídos para acompanhamento. Os processos destes devedores são atribuídos automaticamente ao responsável da carteira."
        actions={<>
          {isManager && (team?.length ?? 0) > 0 && (
            <Select value={owner} onChange={(e) => setOwner(Number(e.target.value))} className="w-60">
              <option value={user!.id}>Minha carteira</option>
              {team!.filter((t) => t.id !== user!.id).map((t) => <option key={t.id} value={t.id}>{displayName(t)}</option>)}
            </Select>
          )}
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)}>Adicionar devedores</Button>
        </>} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      <DataTable columns={columns} rows={rows} meta={meta} loading={loading} onRefresh={reload} onPage={setPage}
        selectable selected={selected} onSelectedChange={setSelected} onRowClick={(d) => router.push(`/debtors/${d.id}`)}
        bulkActions={<>
          <Button size="sm" variant="secondary" icon={<UserMinus className="h-4 w-4" />} onClick={() => setRemoveOpen(true)}>Remover da carteira</Button>
          <Button size="sm" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => setTransferOpen(true)}>Transferir</Button>
        </>}
        toolbar={<><SearchInput value={q} onChange={setQ} placeholder="Pesquisar na carteira…" /><span className="text-[13px] text-muted">{filtered.length} devedor(es)</span></>}
        empty={{ title: "Carteira vazia", description: "Adicione devedores para começar a acompanhar as cobranças.", icon: <Wallet />, action: <Button size="sm" onClick={() => setAddOpen(true)}>Adicionar devedores</Button> }} />

      <AddToWalletModal open={addOpen} ownerId={owner} onClose={() => setAddOpen(false)} onAdd={async (ids) => {
        try { await walletService.addMany(owner, ids); toast("success", "Devedores adicionados", `${ids.length} devedor(es) adicionado(s).`); } catch (e) { toast("error", "Alguns devedores não foram adicionados", errorMessage(e)); }
        reload();
      }} />
      <TransferModal mode="wallet" open={transferOpen} onClose={() => setTransferOpen(false)} count={selected.length} noun="devedor(es)" excludeUserId={owner}
        onConfirm={async (d) => { const r = await walletService.transfer(d.toUserId, selected); toast("success", r.message); setSelected([]); reload(); }} />
      <ConfirmDialog open={removeOpen} onClose={() => setRemoveOpen(false)} loading={busy} title="Remover da carteira?" confirmLabel="Remover"
        description={`${selected.length} devedor(es) deixam de estar atribuídos a esta carteira.`}
        onConfirm={async () => {
          setBusy(true);
          try { const r = await walletService.remove(selected); toast("success", r.message); setSelected([]); reload(); } catch (e) { toast("error", errorMessage(e)); }
          setBusy(false); setRemoveOpen(false);
        }} />
    </>
  );
}

function AddToWalletModal({ open, ownerId, onClose, onAdd }: { open: boolean; ownerId: number; onClose: () => void; onAdd: (ids: number[]) => Promise<void> }) {
  const [items, setItems] = useState<{ id: number; name: string }[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setPicked([]); setQ(""); debtorService.withoutWallet(ownerId).then(setItems).catch(() => setItems([])); } }, [open, ownerId]);
  const filtered = items.filter((d) => d.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: number) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Modal open={open} onClose={onClose} title="Adicionar devedores à carteira" description="Devedores ainda sem responsável." icon={<Wallet className="h-5 w-5" />}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!picked.length} loading={busy} onClick={async () => { setBusy(true); await onAdd(picked); setBusy(false); onClose(); }}>Adicionar {picked.length > 0 && `(${picked.length})`}</Button></>}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por nome…" className="h-9 w-full rounded-lg border surface pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:shadow-focus" />
      </div>
      <ul className="scroll-thin max-h-72 divide-y overflow-y-auto rounded-xl border">
        {filtered.map((d) => (
          <li key={d.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-subtle" onClick={() => toggle(d.id)}>
            <Checkbox checked={picked.includes(d.id)} onChange={() => toggle(d.id)} />
            <Avatar name={d.name} size="xs" /><span className="flex-1 truncate text-sm">{d.name}</span>
          </li>
        ))}
        {filtered.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">Nenhum devedor disponível.</li>}
      </ul>
    </Modal>
  );
}

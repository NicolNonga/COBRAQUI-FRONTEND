"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Banknote, FolderKanban, Mail, Phone, Target, TrendingUp, UserPlus, Users } from "lucide-react";
import { Avatar, Card, PageHeader, Progress, Skeleton, StatCard } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, SearchInput, SegmentedControl } from "@/components/ui/form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { ActiveBadge, ProcessStateBadge } from "@/components/shared/status";
import { TransferModal } from "@/components/shared/transfer-modal";
import { ErrorBanner } from "@/components/shared/process-list";
import { displayName } from "@/components/shared/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { dashboardService, processService, userService } from "@/lib/api/services";
import type { AgentFacts, User } from "@/types/models";
import { formatMoney, formatNumber, pct, sumMoney } from "@/lib/utils";

type Row = User & { facts?: AgentFacts };
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

export default function AgentsPage() {
  const router = useRouter();
  const [view, setView] = useState<"grid" | "table">("grid");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState("");
  const [open, setOpen] = useState<Row | null>(null);
  const agents = useQuery(() => userService.myAgents());
  const facts = useQuery(() => dashboardService.byAgent({ from: from || undefined, to: to || undefined }).catch(() => null), [from, to]);

  const rows: Row[] = (agents.data ?? []).map((u) => ({ ...u, facts: facts.data?.data.find((f) => f.agentId === u.id) }))
    .filter((a) => displayName(a).toLowerCase().includes(q.toLowerCase()));
  const sum = (k: keyof AgentFacts) => sumMoney(rows.map((r) => (r.facts?.[k] as string | undefined) ?? "0"));
  const totalProcesses = rows.reduce((s, r) => s + (r.facts?.openProcesses ?? 0), 0);

  const columns: Column<Row>[] = [
    { key: "u", header: "Agente", cell: (a) => <div className="flex items-center gap-3"><Avatar name={displayName(a)} size="sm" /><div><p className="font-medium">{a.fullName ?? "—"}</p><p className="text-xs text-muted">{a.email}</p></div></div> },
    { key: "c", header: "Categoria", cell: (a) => <span className="text-muted">{a.category?.name ?? "—"}</span>, hideOnMobile: true },
    { key: "p", header: "Processos abertos", align: "right", cell: (a) => <span className="tabular">{a.facts?.openProcesses ?? 0}</span> },
    { key: "in", header: "Em cobrança", align: "right", cell: (a) => <span className="tabular">{formatMoney(a.facts?.inCollection ?? 0, "AOA", true)}</span> },
    { key: "rec", header: "Recuperado", align: "right", cell: (a) => <span className="tabular font-medium text-success-700">{formatMoney(a.facts?.recovered ?? 0, "AOA", true)}</span> },
    { key: "r", header: "Taxa de sucesso", cell: (a) => { const r = Number(a.facts?.successRate ?? 0) / 100; return <div className="flex w-32 items-center gap-2"><Progress value={r} tone={r > 0.5 ? "success" : "brand"} /><span className="tabular text-xs">{a.facts?.successRate ? pct(a.facts.successRate, 0) : "—"}</span></div>; } },
    { key: "s", header: "Estado", cell: (a) => <ActiveBadge active={a.isActive} /> },
  ];

  return (
    <>
      <PageHeader title="Meus agentes" description="Equipa de cobrança sob a sua gestão e o desempenho no período."
        actions={<Link href="/access-control/users?new=1"><Button icon={<UserPlus className="h-4 w-4" />}>Novo agente</Button></Link>} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Período:</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 w-40" />
        <span className="text-muted">–</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 w-40" />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Agentes" value={formatNumber(rows.length)} icon={<Users />} />
        <StatCard label="Processos abertos" value={formatNumber(totalProcesses)} icon={<FolderKanban />} tone="info" />
        <StatCard label="Em cobrança" value={formatMoney(sum("inCollection"), "AOA", true)} icon={<Target />} tone="warning" />
        <StatCard label="Recuperado no período" value={formatMoney(sum("recovered"), "AOA", true)} icon={<TrendingUp />} tone="success" />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={q} onChange={setQ} placeholder="Pesquisar agente…" />
        <SegmentedControl value={view} onChange={setView} options={[{ value: "grid", label: "Cartões" }, { value: "table", label: "Tabela" }]} />
      </div>
      {agents.error && <ErrorBanner message={agents.error} onRetry={agents.reload} />}

      {view === "table" ? <DataTable columns={columns} rows={rows} loading={agents.loading} onRefresh={agents.reload} onRowClick={setOpen} empty={{ title: "Sem agentes na sua equipa", icon: <Users /> }} /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.loading && !agents.data ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />) : rows.map((a) => {
            const r = Number(a.facts?.successRate ?? 0) / 100;
            return (
              <button key={a.id} onClick={() => setOpen(a)} className="text-left">
                <Card className="h-full transition-shadow hover:shadow-pop">
                  <div className="flex items-start gap-3">
                    <Avatar name={displayName(a)} size="lg" />
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{a.fullName ?? a.email}</p><p className="text-xs text-muted">{a.role?.name} · {a.category?.name ?? "sem categoria"}</p></div>
                    <ActiveBadge active={a.isActive} />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-subtle p-3 text-center">
                    <div><p className="tabular text-lg font-semibold">{a.facts?.openProcesses ?? 0}</p><p className="text-[11px] text-muted">Processos</p></div>
                    <div><p className="tabular text-lg font-semibold">{a.facts?.recoveredPayments ?? 0}</p><p className="text-[11px] text-muted">Pagamentos</p></div>
                    <div><p className="tabular text-lg font-semibold">{a.facts?.successRate ? pct(a.facts.successRate, 0) : "—"}</p><p className="text-[11px] text-muted">Sucesso</p></div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted">Recuperado</span><span className="tabular font-medium">{formatMoney(a.facts?.recovered ?? 0, "AOA", true)} / {formatMoney(a.facts?.placed ?? 0, "AOA", true)}</span></div>
                    <Progress value={r} tone={r > 0.5 ? "success" : "brand"} />
                  </div>
                </Card>
              </button>
            );
          })}
          {!agents.loading && rows.length === 0 && <Card className="sm:col-span-2 xl:col-span-3"><p className="py-8 text-center text-sm text-muted">Sem agentes na sua equipa.</p></Card>}
        </div>
      )}
      <AgentDrawer agent={open} onClose={() => setOpen(null)} onChanged={() => { agents.reload(); facts.reload(); }} onWallet={() => router.push("/wallet")} />
    </>
  );
}

function AgentDrawer({ agent, onClose, onChanged, onWallet }: { agent: Row | null; onClose: () => void; onChanged: () => void; onWallet: () => void }) {
  const toast = useToast();
  const { data, reload } = useQuery(() => (agent ? processService.list({ assignedUserId: agent.id, open: true, perPage: 100 }) : Promise.resolve(null)), [agent?.id]);
  const [sel, setSel] = useState<number[]>([]);
  const [transfer, setTransfer] = useState(false);
  const procs = data?.data ?? [];

  return (
    <Drawer open={!!agent} onClose={() => { setSel([]); onClose(); }} width="max-w-2xl" title={agent ? displayName(agent) : ""} description={agent && `${agent.role?.name ?? ""} · ${agent.category?.name ?? "sem categoria"}`}
      footer={<>
        <Button variant="secondary" icon={<Banknote className="h-4 w-4" />} className="mr-auto" onClick={onWallet}>Ver carteiras</Button>
        <Button disabled={!sel.length} icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => setTransfer(true)}>Transferir {sel.length > 0 && `(${sel.length})`}</Button>
      </>}>
      {agent && (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{agent.email}</span>
            {agent.phoneNumber && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{agent.phoneNumber}</span>}
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Processos abertos ({data?.meta.total ?? 0})</h3>
            <div className="overflow-hidden rounded-xl border">
              {procs.map((p) => {
                const toggle = () => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]));
                return (
                  <div key={p.id} onClick={toggle} className="flex cursor-pointer items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-subtle">
                    <Checkbox checked={sel.includes(p.id)} onChange={toggle} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{p.debtor?.name}</p><p className="font-mono text-[11px] text-muted">PRC-{String(p.id).padStart(5, "0")} · {formatMoney(p.totalAmount)}</p></div>
                    <ProcessStateBadge code={p.processState?.code} name={p.processState?.name} />
                  </div>
                );
              })}
              {data && !procs.length && <p className="px-4 py-8 text-center text-sm text-muted">Sem processos abertos.</p>}
            </div>
          </div>
        </div>
      )}
      <TransferModal open={transfer} onClose={() => setTransfer(false)} count={sel.length} noun="processo(s)" excludeUserId={agent?.id}
        onConfirm={async (d) => {
          if (!agent) return;
          const r = await processService.transfer({ processIds: sel, fromUserId: agent.id, toUserId: d.toUserId, reason: d.reason, notes: d.notes, permanent: d.permanent, returnAt: d.returnAt });
          toast("success", r.message); setSel([]); reload(); onChanged();
        }} />
    </Drawer>
  );
}

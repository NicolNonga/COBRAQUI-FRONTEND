"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Eye, ListChecks, MoreHorizontal, Pencil, Play, Plus, Power, ShieldCheck, Workflow } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/form";
import { ConfirmDialog, Dropdown, MenuItem, MenuSeparator } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { LadderPreviewDrawer, LadderTimeline, PolicyNotice, ladderActionMeta } from "@/components/shared/ladders";
import { ErrorBanner } from "@/components/shared/process-list";
import { useAuth } from "@/components/shared/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { ladderService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { Ladder } from "@/types/models";
import { cn, formatDate } from "@/lib/utils";

export default function LaddersPage() {
  const router = useRouter();
  const toast = useToast();
  const { can, isManager } = useAuth();
  const [archived, setArchived] = useState(false);
  const { data, loading, error, reload } = useQuery(() => ladderService.list({ includeArchived: archived, perPage: 100 }), [archived]);
  const [preview, setPreview] = useState<number | null>(null);
  const [archiving, setArchiving] = useState<Ladder | null>(null);
  const [running, setRunning] = useState(false);
  const confirm = useConfirm();

  async function toggle(l: Ladder) {
    try {
      let msg = "";
      const ok = await confirm({
        title: l.isActive ? `Desactivar a régua "${l.name}"?` : `Activar a régua "${l.name}"?`,
        description: l.isActive
          ? "A régua deixa de gerar alertas e mensagens para os processos. Pode voltar a activá-la a qualquer momento."
          : "A régua passa a correr automaticamente nos seus processos: gera alertas para a equipa e, nos passos configurados, envia mensagens aos devedores. Só pode ter uma régua activa — a que estiver activa será desactivada.",
        confirmLabel: l.isActive ? "Desactivar" : "Activar régua", tone: l.isActive ? "danger" : "primary",
        onConfirm: async () => { msg = (l.isActive ? await ladderService.deactivate(l.id) : await ladderService.activate(l.id)).message; },
      });
      if (ok) { toast("success", msg); reload(); }
    } catch (e) { toast("error", "Não foi possível alterar", errorMessage(e)); }
  }

  return (
    <>
      <PageHeader title="Régua de cobrança" description="Passos automáticos por dia de processo: lembretes, sugestões de negociação e escalonamento."
        actions={<>
          <Link href="/ladders/policy"><Button variant="secondary" icon={<ShieldCheck className="h-4 w-4" />}>Régua master</Button></Link>
          <Link href="/ladders/tasks"><Button variant="secondary" icon={<ListChecks className="h-4 w-4" />}>Tarefas e cumprimento</Button></Link>
          {(isManager || can("collection_ladder_run_permission")) && <Button variant="secondary" icon={<Play className="h-4 w-4" />} loading={running} onClick={async () => {
            setRunning(true);
            try {
              const ok = await confirm({
                title: "Executar as réguas agora?", tone: "primary", confirmLabel: "Executar agora",
                description: "Todas as réguas activas correm já sobre os processos abertos: são gerados os alertas de hoje e enviadas as mensagens aos devedores previstas para hoje. Cada passo só é executado uma vez por processo.",
                onConfirm: () => ladderService.runNow(),
              });
              if (ok) toast("success", "Réguas executadas", "Os alertas de hoje foram gerados.");
            } catch (e) { toast("error", errorMessage(e)); } finally { setRunning(false); }
          }}>Executar agora</Button>}
          <Link href="/ladders/new"><Button icon={<Plus className="h-4 w-4" />}>Nova régua</Button></Link>
        </>} />

      <label className="mb-4 flex items-center gap-2 text-sm text-muted"><Switch checked={archived} onChange={setArchived} /> Mostrar arquivadas</label>
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {loading && !data ? <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
        : !data?.data.length ? <Card><EmptyState icon={<Workflow />} title="Ainda não tem réguas" description="Crie a primeira régua para automatizar os passos de cobrança." action={<Link href="/ladders/new"><Button size="sm">Nova régua</Button></Link>} /></Card>
        : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {data.data.map((l) => (
              <Card key={l.id} className={cn("flex flex-col", l.archivedAt && "opacity-60")}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15"><Workflow className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <button className="truncate text-left font-semibold hover:text-brand-600" onClick={() => router.push(`/ladders/${l.id}`)}>{l.name}</button>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {l.archivedAt ? <Badge>Arquivada</Badge> : <Badge tone={l.isActive ? "success" : "neutral"} dot>{l.isActive ? "Activa" : "Inactiva"}</Badge>}
                      <Badge>v{l.version}</Badge>
                      {l.policyCompliant === false && <Badge tone="danger" dot>Fora da master</Badge>}
                    </div>
                  </div>
                  {!l.archivedAt && <Switch checked={l.isActive} onChange={() => toggle(l)} label="Activar régua" />}
                  <Dropdown trigger={<Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>}>
                    <MenuItem icon={<Pencil />} onClick={() => router.push(`/ladders/${l.id}`)}>Editar</MenuItem>
                    <MenuItem icon={<Eye />} onClick={() => setPreview(l.id)}>Pré-visualizar</MenuItem>
                    {!l.archivedAt && <MenuItem icon={<Power />} onClick={() => toggle(l)}>{l.isActive ? "Desactivar" : "Activar"}</MenuItem>}
                    <MenuSeparator />
                    {!l.archivedAt && <MenuItem icon={<Archive />} danger onClick={() => setArchiving(l)}>Arquivar</MenuItem>}
                  </Dropdown>
                </div>
                {l.policyCompliant === false && <div className="mt-3"><PolicyNotice ladder={l} /></div>}
                {l.description && <p className="mt-3 line-clamp-2 text-sm text-muted">{l.description}</p>}
                <div className="mt-4 flex-1">
                  <LadderTimeline steps={l.steps ?? []} max={4} compact />
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted">
                  <span>{l.steps?.length ?? 0} passos{l.executions !== undefined && ` · ${l.executions} execuções`}</span>
                  <span>Actualizada {formatDate(l.updatedAt)}</span>
                </div>
              </Card>
            ))}
          </div>
        )}

      <LadderPreviewDrawer ladderId={preview} onClose={() => setPreview(null)} />
      <ConfirmDialog open={!!archiving} onClose={() => setArchiving(null)} title="Arquivar régua?" confirmLabel="Arquivar"
        description={<>A régua <b>{archiving?.name}</b> deixa de ser executada. O histórico de alertas e tarefas mantém-se.</>}
        onConfirm={async () => { if (!archiving) return; try { const r = await ladderService.archive(archiving.id); toast("success", r.message); reload(); } catch (e) { toast("error", errorMessage(e)); } setArchiving(null); }} />
    </>
  );
}

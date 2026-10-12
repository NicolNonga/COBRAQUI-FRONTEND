"use client";
import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Pencil } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { LadderEditor, LadderPreviewDrawer, LadderTimeline, PolicyNotice } from "@/components/shared/ladders";
import { useQuery } from "@/hooks/use-query";
import { ladderService } from "@/lib/api/services";

export default function LadderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, reload } = useQuery(() => ladderService.get(Number(id)), [id]);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  if (error) return <EmptyState title="Régua não encontrada" description={error} action={<Link href="/ladders"><Button variant="secondary">Voltar</Button></Link>} />;
  if (!data) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;

  return (
    <>
      <Link href="/ladders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--text)]"><ArrowLeft className="h-4 w-4" /> Régua de cobrança</Link>
      <PageHeader
        title={<span className="flex items-center gap-3">{data.name} <Badge>v{data.version}</Badge></span>}
        description={editing ? "Ao guardar é criada uma nova versão; a régua mantém o estado (activa/inactiva)." : data.description ?? "Passos que a régua executa em cada processo, contados desde a entrada em cobrança."}
        actions={editing
          ? <Button variant="secondary" onClick={() => setEditing(false)}>Fechar edição</Button>
          : <>
              <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={() => setPreview(true)}>Pré-visualizar</Button>
              {!data.archivedAt && <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>Editar</Button>}
            </>} />

      {!editing && <div className="mb-4 max-w-3xl"><PolicyNotice ladder={data} /></div>}
      {editing ? (
        <LadderEditor ladder={data} onSaved={() => { reload(); setEditing(false); }} />
      ) : (
        <Card className="max-w-3xl rounded-3xl p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Régua de cobrança · {data.name}</h2>
            {data.archivedAt
              ? <Badge>Arquivada</Badge>
              : <span className={data.isActive
                  ? "rounded-full border border-success-200 bg-success-50 px-3.5 py-1 text-sm font-medium text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
                  : "rounded-full border bg-soft px-3.5 py-1 text-sm font-medium text-muted"}>{data.isActive ? "Activa" : "Inactiva"}</span>}
          </div>
          <LadderTimeline steps={data.steps ?? []} />
          <p className="mt-6 text-xs text-muted">D+N = N dias depois de o processo entrar em cobrança (factura vencida).</p>
        </Card>
      )}
      <LadderPreviewDrawer ladderId={preview ? data.id : null} onClose={() => setPreview(false)} />
    </>
  );
}

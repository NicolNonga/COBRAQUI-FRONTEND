"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRightLeft, Bell, CheckCheck, FileText, Handshake, Trash2, Upload, UserPlus } from "lucide-react";
import { Card, EmptyState, PageHeader, Skeleton, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useQuery } from "@/hooks/use-query";
import { notificationService } from "@/lib/api/services";
import { useNotifications } from "@/components/shared/notifications-provider";
import { errorMessage } from "@/lib/api/http";
import { cn, timeAgo } from "@/lib/utils";

const icons: Record<string, typeof Bell> = {
  "invoice.overdue": FileText, "negotiation.payment": Handshake, "negotiation.breach": AlertTriangle,
  "process.transfer": ArrowRightLeft, "import.done": Upload, "debtor.created": UserPlus, "user.created": UserPlus,
};

export default function NotificationsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(1);
  const live = useNotifications();
  const confirm = useConfirm();
  const { data: res, loading, error, reload } = useQuery(() => notificationService.list({ page, perPage: 20, is_read: tab === "unread" ? false : undefined }), [tab, page, live.version]);
  const data = res?.data;
  const { data: unread, reload: reloadAll } = useQuery(() => notificationService.unreadCount().catch(() => 0), [live.version]);
  const refresh = () => { reload(); reloadAll(); live.reload(); };

  return (
    <>
      <PageHeader title="Notificações" description="Alertas e actividade relevante da sua operação."
        actions={<Button variant="secondary" icon={<CheckCheck className="h-4 w-4" />} onClick={async () => { try { const r = await notificationService.markAllRead(); toast("success", r.message); refresh(); } catch (e) { toast("error", errorMessage(e)); } }}>Marcar todas como lidas</Button>} />
      <div className="mb-4">
        <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} items={[{ value: "all", label: "Todas", count: tab === "all" ? res?.meta.total : undefined }, { value: "unread", label: "Não lidas", count: unread }]} />
      </div>
      <Card padded={false}>
        {loading && !data ? <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          : data?.length === 0 ? <EmptyState icon={<Bell />} title="Está tudo em dia" description="Não tem notificações por ler." />
          : (
            <ul className="divide-y">
              {data?.map((n) => {
                const Icon = icons[n.type] ?? Bell;
                return (
                  <li key={n.id} className={cn("group flex items-start gap-4 px-5 py-4", !n.isRead && "bg-brand-50/40 dark:bg-brand-500/5")}>
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      n.priority === "high" ? "bg-danger-50 text-danger-600 dark:bg-danger-500/15" : n.priority === "medium" ? "bg-warning-50 text-warning-600 dark:bg-warning-500/15" : "bg-soft text-muted")}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <Link href={n.actionUrl ?? "/notifications"} onClick={() => notificationService.markRead(n.id).then(refresh)} className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">{n.title}{!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}</p>
                      <p className="mt-0.5 text-sm text-muted">{n.message}</p>
                      <p className="mt-1 text-xs text-muted">{timeAgo(n.createdAt)}</p>
                    </Link>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      {!n.isRead && <Button variant="ghost" size="icon-sm" title="Marcar como lida" onClick={async () => { await notificationService.markRead(n.id); refresh(); }}><CheckCheck className="h-4 w-4" /></Button>}
                      <Button variant="ghost" size="icon-sm" title="Eliminar" onClick={async () => {
                        const ok = await confirm({ title: "Eliminar notificação?", description: "A notificação é apagada e não pode ser recuperada.", confirmLabel: "Eliminar", onConfirm: () => notificationService.remove(n.id) }).catch(() => false);
                        if (ok) refresh();
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </Card>
      {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
      {res && res.meta.lastPage > 1 && (
        <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
          <span>Página {res.meta.currentPage} de {res.meta.lastPage}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Button size="sm" variant="secondary" disabled={page >= res.meta.lastPage} onClick={() => setPage(page + 1)}>Seguinte</Button>
          </div>
        </div>
      )}
    </>
  );
}

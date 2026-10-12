"use client";
import { useEffect, useState } from "react";
import { ArrowRightLeft, Check, Search } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/display";
import { Field, Input, SegmentedControl, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { userService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { UserRef } from "@/types/models";
import { cn } from "@/lib/utils";

export interface TransferDetails { toUserId: number; reason: string; notes?: string; permanent: boolean; returnAt?: string }

/**
 * Transferência para outro utilizador.
 * - mode "process": motivo obrigatório (≥5 caracteres), definitiva ou temporária (com data de regresso), observações.
 * - mode "wallet": só o destino.
 */
export function TransferModal({ open, onClose, count, noun, excludeUserId, onConfirm, mode = "process" }: {
  open: boolean; onClose: () => void; count: number; noun: string; excludeUserId?: number; mode?: "process" | "wallet";
  onConfirm: (d: TransferDetails) => Promise<void>;
}) {
  const toast = useToast();
  const [users, setUsers] = useState<UserRef[]>([]);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<"permanent" | "temporary">("permanent");
  const [returnAt, setReturnAt] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTarget(null); setReason(""); setNotes(""); setQ(""); setKind("permanent"); setReturnAt("");
    userService.dropdown().then((u) => setUsers(u.filter((x) => x.id !== excludeUserId))).catch(() => setUsers([]));
  }, [open, excludeUserId]);

  const filtered = users.filter((u) => `${u.fullName ?? ""} ${u.email}`.toLowerCase().includes(q.toLowerCase()));
  const valid = !!target && (mode === "wallet" || (reason.trim().length >= 5 && (kind === "permanent" || !!returnAt)));

  return (
    <Modal open={open} onClose={onClose} size="md" icon={<ArrowRightLeft className="h-5 w-5" />}
      title={`Transferir ${count} ${noun}`} description="Seleccione quem passará a ser responsável."
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!valid} loading={loading} onClick={async () => {
          if (!target) return;
          setLoading(true);
          try {
            await onConfirm({ toUserId: target, reason: reason.trim(), notes: notes.trim() || undefined, permanent: kind === "permanent", returnAt: kind === "temporary" ? new Date(returnAt).toISOString() : undefined });
            onClose();
          } catch (e) { toast("error", "Não foi possível transferir", errorMessage(e)); } finally { setLoading(false); }
        }}>Transferir</Button>
      </>}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar utilizador…" className="h-9 w-full rounded-lg border surface pr-3 pl-9 text-sm outline-none focus:border-brand-500 focus:shadow-focus" />
      </div>
      <ul className="scroll-thin max-h-56 space-y-1 overflow-y-auto">
        {filtered.map((u) => (
          <li key={u.id}>
            <button onClick={() => setTarget(u.id)}
              className={cn("flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors", target === u.id ? "border-brand-500 bg-brand-50/50 dark:bg-brand-500/10" : "border-transparent hover:bg-soft")}>
              <Avatar name={u.fullName ?? u.email} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{u.fullName ?? u.email}</span>
                <span className="block truncate text-xs text-muted">{u.email}</span>
              </span>
              {target === u.id && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white"><Check className="h-3 w-3" /></span>}
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="py-6 text-center text-sm text-muted">Nenhum utilizador.</li>}
      </ul>
      {mode === "process" && (
        <div className="mt-4 space-y-4">
          <SegmentedControl value={kind} onChange={setKind} options={[{ value: "permanent", label: "Definitiva" }, { value: "temporary", label: "Temporária" }]} />
          {kind === "temporary" && (
            <Field label="Regressa ao agente de origem em" required hint="Na data indicada o processo volta automaticamente.">
              <Input type="datetime-local" value={returnAt} onChange={(e) => setReturnAt(e.target.value)} />
            </Field>
          )}
          <Field label="Motivo" required hint="Mínimo 5 caracteres. Fica registado na auditoria.">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: redistribuição de carteira, férias do agente" />
          </Field>
          <Field label="Observações (opcional)">
            <Textarea rows={2} className="min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

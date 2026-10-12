"use client";
import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { disputeService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { Invoice } from "@/types/models";

export function DisputeModal({ invoice, onClose, onDone }: { invoice: Invoice | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (invoice) setReason(""); }, [invoice]);
  return (
    <Modal open={!!invoice} onClose={onClose} title="Abrir disputa" icon={<Scale className="h-5 w-5" />}
      description={invoice && <>A factura <b>{invoice.referenceNumber}</b> fica suspensa da cobrança até a disputa ser resolvida.</>}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={reason.trim().length < 5} loading={busy} onClick={async () => {
          if (!invoice) return;
          setBusy(true);
          try { const r = await disputeService.open(invoice.id, reason.trim()); toast("success", r.message); onDone(); onClose(); }
          catch (e) { toast("error", "Não foi possível abrir a disputa", errorMessage(e)); } finally { setBusy(false); }
        }}>Abrir disputa</Button></>}>
      <Field label="Motivo apresentado pelo devedor" required hint="Mínimo 5 caracteres. Ex: valor já pago, serviço não prestado, valor errado.">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
      </Field>
    </Modal>
  );
}

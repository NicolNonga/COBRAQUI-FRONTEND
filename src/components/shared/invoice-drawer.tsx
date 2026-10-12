"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, FileText, FileWarning, Handshake, Paperclip, Pencil, Scale } from "lucide-react";
import { Card, DescriptionList, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/ui/form";
import { Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { InvoiceStatusBadge } from "@/components/shared/status";
import { useAuth } from "@/components/shared/auth-provider";
import { invoiceService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import { P } from "@/lib/permissions";
import type { Invoice } from "@/types/models";
import { formatDate, formatMoney } from "@/lib/utils";

export const canDispute = (i: Invoice) => !["PAID", "CANCELLED", "IN_DISPUTE"].includes(i.invoiceState?.code ?? "");
/** paga, parcialmente paga, cancelada ou em disputa → já não se edita */
export const canEditInvoice = (i: Invoice) => !["PAID", "PARTIALLY_PAID", "CANCELLED", "IN_DISPUTE"].includes(i.invoiceState?.code ?? "");

/** Detalhe da factura com pré-visualização do PDF anexado. */
export function InvoiceDrawer({ invoice: v, onClose, onDispute, onChanged, onEdit }: {
  invoice: Invoice | null; onClose: () => void; onDispute?: (i: Invoice) => void; onChanged?: () => void; onEdit?: (i: Invoice) => void;
}) {
  const { can } = useAuth();
  return (
    <Drawer open={!!v} onClose={onClose} width="max-w-3xl" title={v?.referenceNumber ?? ""} description={v && <InvoiceStatusBadge code={v.invoiceState?.code} name={v.invoiceState?.name} />}
      footer={v && <>
        {onEdit && can(P.INVOICE_UPDATE) && canEditInvoice(v) && <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} className="mr-auto" onClick={() => onEdit(v)}>Editar</Button>}
        {onDispute && <Button variant="secondary" icon={<Scale className="h-4 w-4" />} disabled={!canDispute(v)} onClick={() => onDispute(v)}>Abrir disputa</Button>}
        <Link href={`/negotiations/new?debtorId=${v.debtorId}`}><Button icon={<Handshake className="h-4 w-4" />}>Negociar</Button></Link>
      </>}>
      {v && (
        <div className="space-y-6">
          <Card className="bg-subtle">
            <p className="text-xs text-muted">Valor da factura</p>
            <p className="tabular mt-1 text-3xl font-semibold tracking-tight">{formatMoney(v.amount, v.currency?.code)}</p>
            {(v.overdueDays ?? 0) > 0 && <p className="mt-1 text-sm text-danger-600">{v.overdueDays} dias em atraso</p>}
          </Card>
          <InvoiceDocument invoice={v} onChanged={onChanged} />
          <DescriptionList items={[
            { label: "Devedor", value: v.debtor ? <Link href={`/debtors/${v.debtorId}`} className="text-brand-600 hover:underline">{v.debtor.name}</Link> : "—" },
            { label: "NIF", value: v.debtor?.nif ?? "—" },
            { label: "Data de emissão", value: formatDate(v.issueDate) },
            { label: "Vencimento", value: formatDate(v.dueDate) },
            { label: "Prazo de pagamento", value: `${v.timeLimitDays} dias` },
            { label: "Moeda", value: v.currency ? `${v.currency.name} (${v.currency.code})` : "—" },
            { label: "Em processo de cobrança", value: v.inProcess ? "Sim" : "Não" },
            { label: "Registada por", value: v.createdBy?.fullName ?? v.createdBy?.email ?? "—" },
            { label: "Registada em", value: formatDate(v.createdAt) },
          ]} />
        </div>
      )}
    </Drawer>
  );
}

function InvoiceDocument({ invoice, onChanged }: { invoice: Invoice; onChanged?: () => void }) {
  const toast = useToast();
  const { can } = useAuth();
  const [hasDoc, setHasDoc] = useState(!!invoice.documentPath);
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [problem, setProblem] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => { setHasDoc(!!invoice.documentPath); setFile(null); }, [invoice.id, invoice.documentPath]);

  useEffect(() => {
    if (!hasDoc) return;
    let alive = true;
    let created: string | null = null;
    setState("loading"); setUrl(null);
    invoiceService.documentUrl(invoice.id)
      .then((u) => { created = u; if (alive) { setUrl(u); setState("idle"); } else URL.revokeObjectURL(u); })
      .catch((e) => { if (alive) { setProblem(errorMessage(e)); setState("error"); } });
    return () => { alive = false; if (created) URL.revokeObjectURL(created); };
  }, [invoice.id, hasDoc, reload]);

  const header = (
    <div className="flex items-center gap-3 border-b px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15"><FileText className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Documento da factura</p>
        <p className="text-xs text-muted">{hasDoc ? "PDF anexado" : "Ainda sem PDF"}</p>
      </div>
      {hasDoc && url && <>
        <Button size="sm" variant="ghost" icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => window.open(url, "_blank", "noopener")}>Abrir</Button>
        <Button size="sm" variant="secondary" icon={<Download className="h-3.5 w-3.5" />}
          onClick={() => invoiceService.downloadDocument(invoice.id, invoice.referenceNumber).catch((e) => toast("error", "Não foi possível descarregar", errorMessage(e)))}>Descarregar</Button>
      </>}
    </div>
  );

  if (hasDoc)
    return (
      <div className="overflow-hidden rounded-xl border">
        {header}
        {state === "loading" && <Skeleton className="m-4 h-[420px] rounded-lg" />}
        {state === "error" && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <FileWarning className="h-6 w-6 text-warning-600" />
            <p className="text-sm">{problem}</p>
            <Button size="sm" variant="secondary" onClick={() => setReload((n) => n + 1)}>Tentar novamente</Button>
          </div>
        )}
        {url && <iframe src={url} title={`Factura ${invoice.referenceNumber}`} className="h-[520px] w-full bg-subtle" />}
      </div>
    );

  return (
    <div className="overflow-hidden rounded-xl border">
      {header}
      <div className="space-y-3 p-4">
        {can(P.INVOICE_CREATE) ? <>
          <FileDrop accept="application/pdf" file={file} onFile={setFile} hint="Anexe o PDF da factura (máx. 10 MB)" />
          {file && (
            <div className="flex justify-end">
              <Button size="sm" loading={busy} icon={<Paperclip className="h-3.5 w-3.5" />} onClick={async () => {
                setBusy(true);
                try {
                  const r = await invoiceService.attachDocument(invoice.id, file);
                  toast("success", r.message); setFile(null); setHasDoc(true); onChanged?.();
                } catch (e) { toast("error", "Não foi possível anexar o PDF", errorMessage(e)); } finally { setBusy(false); }
              }}>Anexar PDF</Button>
            </div>
          )}
        </> : <p className="text-sm text-muted">Esta factura foi registada sem PDF.</p>}
      </div>
    </div>
  );
}

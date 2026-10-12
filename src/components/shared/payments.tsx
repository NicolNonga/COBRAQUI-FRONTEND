"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, CheckCircle2, Eye, FileDown, Info, Undo2, XCircle } from "lucide-react";
import { Badge, Card, DescriptionList } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, FileDrop, Input, SegmentedControl, Select, Textarea } from "@/components/ui/form";
import { Drawer, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { PaymentStatusBadge } from "@/components/shared/status";
import { useAuth } from "@/components/shared/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { paymentService, type ConfirmationResult } from "@/lib/api/services";
import { errorMessage, newIdempotencyKey } from "@/lib/api/http";
import type { Currency, Installment, Payment, PaymentMethod, PaymentReceiver } from "@/types/models";
import { formatDate, formatMoney, todayIso } from "@/lib/utils";

export const receiverLabel: Record<PaymentReceiver, string> = { CREDITOR: "Pago ao credor", AGENCY: "Pago à agência" };
export const paymentCode = (id: string) => `PAG-${id.slice(0, 8).toUpperCase()}`;

/* ───────────────────────── Registar pagamento ───────────────────────── */
export function RegisterPaymentModal({ open, onClose, onDone, negotiationId, installments, debtorName }: {
  open: boolean; onClose: () => void; onDone: () => void; negotiationId: number; installments?: Installment[]; debtorName?: string;
}) {
  const toast = useToast();
  const idem = useRef(newIdempotencyKey());
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const blank = { installmentId: "", receiver: "AGENCY" as PaymentReceiver, amount: "", currencyId: "", exchangeRate: "", paymentMethodId: "", paidOn: todayIso(), reference: "", notes: "" };
  const [f, setF] = useState(blank);
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    idem.current = newIdempotencyKey();
    setErrors({}); setProof(null);
    Promise.all([paymentService.methods(), paymentService.currencies()]).then(([m, c]) => {
      setMethods(m); setCurrencies(c);
      const next = installments?.find((i) => i.paymentState !== "PAID" && i.paymentState !== "CANCELLED");
      setF({ ...blank, currencyId: String(c.find((x) => x.code === "AOA")?.id ?? c[0]?.id ?? ""), paymentMethodId: String(m[0]?.id ?? ""),
        installmentId: next ? String(next.id) : "", amount: next ? Number(next.remainingAmount).toFixed(2) : "" });
    }).catch((e) => toast("error", "Não foi possível carregar métodos/moedas", errorMessage(e)));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const method = methods.find((m) => String(m.id) === f.paymentMethodId);
  const currency = currencies.find((c) => String(c.id) === f.currencyId);
  const foreign = currency && currency.code !== "AOA";
  const openInst = (installments ?? []).filter((i) => i.paymentState !== "PAID" && i.paymentState !== "CANCELLED");

  async function submit() {
    const er: Record<string, string> = {};
    if (!(Number(f.amount) > 0)) er.amount = "Indique o valor pago.";
    if (!f.paymentMethodId) er.method = "Seleccione o meio de pagamento.";
    if (!f.currencyId) er.currency = "Seleccione a moeda.";
    if (foreign && !(Number(f.exchangeRate) > 0)) er.rate = "Indique a taxa de câmbio para a moeda base.";
    if (method?.requiresReference && !f.reference.trim()) er.reference = `O meio "${method.name}" exige a referência.`;
    if (f.paidOn > todayIso()) er.paidOn = "A data não pode ser futura.";
    if (!proof) er.proof = "O comprovativo é obrigatório.";
    setErrors(er);
    if (Object.keys(er).length || !proof) return;
    setBusy(true);
    try {
      const r = await paymentService.register({
        negotiationId, installmentId: f.installmentId ? Number(f.installmentId) : null, receiver: f.receiver, amount: Number(f.amount).toFixed(2),
        currencyId: Number(f.currencyId), exchangeRate: foreign ? f.exchangeRate : undefined, paymentMethodId: Number(f.paymentMethodId),
        paidOn: f.paidOn, reference: f.reference.trim() || undefined, notes: f.notes.trim() || undefined, proof,
      }, idem.current);
      toast("success", r.message, "Fica pendente até outra pessoa (o seu gestor ou o financeiro) o confirmar; só então abate a dívida.");
      onDone(); onClose();
    } catch (e) { toast("error", "Não foi possível registar o pagamento", errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Registar pagamento" icon={<Banknote className="h-5 w-5" />}
      description={<>Acordo <b>ACD-{String(negotiationId).padStart(5, "0")}</b>{debtorName && <> · {debtorName}</>}. O pagamento fica pendente até ser confirmado.</>}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={busy} onClick={submit}>Registar pagamento</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quem recebeu o dinheiro" className="sm:col-span-2" hint={f.receiver === "CREDITOR" ? "O devedor pagou directamente ao credor: a agência só regista a comissão." : "O devedor pagou à agência: o valor entra na conta-corrente para repasse ao credor."}>
          <SegmentedControl value={f.receiver} onChange={(v) => setF({ ...f, receiver: v })} options={[{ value: "AGENCY", label: "Agência" }, { value: "CREDITOR", label: "Credor (directo)" }]} />
        </Field>
        {installments && (
          <Field label="Prestação" className="sm:col-span-2" hint="Sem prestação: o valor cobre as prestações em aberto por ordem de vencimento.">
            <Select value={f.installmentId} onChange={(e) => {
              const inst = openInst.find((i) => String(i.id) === e.target.value);
              setF({ ...f, installmentId: e.target.value, amount: inst ? Number(inst.remainingAmount).toFixed(2) : f.amount });
            }}>
              <option value="">Distribuir automaticamente</option>
              {openInst.map((i) => <option key={i.id} value={i.id}>Prestação {i.installmentNumber} · vence {formatDate(i.dueDate)} · falta {formatMoney(i.remainingAmount)}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Valor pago" required error={errors.amount}>
          <Input type="number" min="0" step="0.01" value={f.amount} invalid={!!errors.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} trailing={currency?.symbol} className="tabular" />
        </Field>
        <Field label="Moeda" required error={errors.currency}>
          <Select value={f.currencyId} invalid={!!errors.currency} onChange={(e) => setF({ ...f, currencyId: e.target.value })}>
            {currencies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </Select>
        </Field>
        {foreign && (
          <Field label={`Taxa de câmbio (1 ${currency?.code} = ? AOA)`} required error={errors.rate} className="sm:col-span-2">
            <Input type="number" min="0" step="0.000001" value={f.exchangeRate} invalid={!!errors.rate} onChange={(e) => setF({ ...f, exchangeRate: e.target.value })} className="tabular" />
          </Field>
        )}
        <Field label="Meio de pagamento" required error={errors.method}>
          <Select value={f.paymentMethodId} invalid={!!errors.method} onChange={(e) => setF({ ...f, paymentMethodId: e.target.value })}>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Data do pagamento" required error={errors.paidOn}>
          <Input type="date" max={todayIso()} value={f.paidOn} invalid={!!errors.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} />
        </Field>
        <Field label={`Referência${method?.requiresReference ? "" : " (opcional)"}`} required={method?.requiresReference} error={errors.reference} className="sm:col-span-2">
          <Input value={f.reference} invalid={!!errors.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Nº da transferência, talão ou recibo" className="font-mono" />
        </Field>
        <Field label="Comprovativo" required error={errors.proof} className="sm:col-span-2">
          <FileDrop accept=".pdf,.png,.jpg,.jpeg" file={proof} onFile={setProof} hint="PDF, PNG ou JPG" />
        </Field>
        <Field label="Observações (opcional)" className="sm:col-span-2"><Textarea rows={2} className="min-h-[60px]" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Detalhe do pagamento ───────────────────────── */
export function PaymentDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { can, isManager, user } = useAuth();
  const { data: p, reload } = useQuery(() => (id ? paymentService.get(id) : Promise.resolve(null)), [id]);
  const [action, setAction] = useState<"cancel" | "reverse" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ConfirmationResult | null>(null);
  useEffect(() => { setResult(null); }, [id]);

  /** regra dos quatro olhos: quem registou não confirma, não anula nem estorna (também validado no servidor e na BD) */
  const ownPayment = !!p && !!user && (p.registeredById ?? p.registeredBy?.id) === user.id;
  const canDecide = (isManager || can("payment_confirm_permission")) && !ownPayment;
  const done = () => { reload(); onChanged(); };
  const ask = useConfirm();

  async function confirmPayment() {
    if (!p) return;
    setBusy(true);
    try {
      let r: Awaited<ReturnType<typeof paymentService.confirm>> | null = null;
      const ok = await ask({
        title: "Confirmar este pagamento?", tone: "primary", confirmLabel: "Confirmar pagamento",
        description: <>Os <b>{formatMoney(p.amount, p.currency?.code)}</b> passam a abater a dívida: as prestações são liquidadas, a comissão é calculada e o valor entra na conta-corrente do credor. Depois só pode ser revertido por estorno.</>,
        onConfirm: async () => { r = await paymentService.confirm(p.id); },
      });
      if (ok && r) { const x = r as Awaited<ReturnType<typeof paymentService.confirm>>; setResult(x.data); toast("success", x.message); done(); }
    } catch (e) { toast("error", "Não foi possível confirmar", errorMessage(e)); } finally { setBusy(false); }
  }
  async function runReason() {
    if (!p || !action) return;
    setBusy(true);
    try {
      const r = action === "cancel" ? await paymentService.cancel(p.id, reason.trim()) : await paymentService.reverse(p.id, reason.trim());
      toast("success", r.message); setAction(null); setReason(""); done();
    } catch (e) { toast("error", "Operação recusada", errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Drawer open={!!id} onClose={onClose} width="max-w-2xl" title={p ? paymentCode(p.id) : "Pagamento"} description={p && <PaymentStatusBadge value={p.status} />}
      footer={p && <>
        <Button variant="secondary" icon={<Eye className="h-4 w-4" />} onClick={() => paymentService.viewProof(p.id).catch((e) => toast("error", errorMessage(e)))} className="mr-auto">Ver comprovativo</Button>
        <Button variant="ghost" icon={<FileDown className="h-4 w-4" />} onClick={() => paymentService.proof(p.id).catch((e) => toast("error", errorMessage(e)))}>Descarregar</Button>
        {p.status === "PENDING" && canDecide && <>
          <Button variant="outline-danger" icon={<XCircle className="h-4 w-4" />} onClick={() => setAction("cancel")}>Anular</Button>
          <Button icon={<CheckCircle2 className="h-4 w-4" />} loading={busy && !action} onClick={confirmPayment}>Confirmar</Button>
        </>}
        {p.status === "CONFIRMED" && canDecide && <Button variant="outline-danger" icon={<Undo2 className="h-4 w-4" />} onClick={() => setAction("reverse")}>Estornar</Button>}
      </>}>
      {p && (
        <div className="space-y-6">
          {ownPayment && (p.status === "PENDING" || p.status === "CONFIRMED") && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
              Este pagamento foi registado por si, por isso não o pode {p.status === "PENDING" ? "confirmar nem anular" : "estornar"}.
              Por segurança, outra pessoa com a permissão &quot;Confirmar pagamentos&quot; (ou o seu gestor) tem de o fazer — mesmo sendo super-admin.
            </div>
          )}
          <Card className="bg-subtle">
            <p className="text-xs text-muted">Valor pago</p>
            <p className="tabular mt-1 text-3xl font-semibold tracking-tight">{formatMoney(p.amount, p.currency?.code)}</p>
            {p.currency?.code !== "AOA" && <p className="mt-1 text-sm text-muted">= {formatMoney(p.amountBase)} (câmbio {p.exchangeRate})</p>}
          </Card>
          {result && (
            <div className="rounded-xl border border-success-500/30 bg-success-50 p-4 text-sm text-success-700 dark:bg-success-500/10">
              <p className="mb-2 flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Pagamento confirmado</p>
              <ul className="space-y-1">
                <li>{result.installmentsPaid} prestação(s) liquidada(s) · comissão {formatMoney(result.commission)}</li>
                {Number(result.credit) > 0 && <li>Crédito gerado para o devedor: {formatMoney(result.credit)}</li>}
                {result.negotiationCompleted && <li>O acordo foi integralmente pago e ficou <b>Liquidado</b> ({result.processesClosed} processo(s) fechado(s), {result.invoicesPaid} factura(s) pagas).</li>}
              </ul>
            </div>
          )}
          <DescriptionList items={[
            { label: "Acordo", value: <Link href={`/negotiations/${p.negotiationId}`} className="text-brand-600 hover:underline">ACD-{String(p.negotiationId).padStart(5, "0")}</Link> },
            { label: "Recebido por", value: <Badge tone={p.receiver === "AGENCY" ? "brand" : "info"}>{receiverLabel[p.receiver]}</Badge> },
            { label: "Data do pagamento", value: formatDate(p.paidOn) },
            { label: "Meio", value: p.paymentMethod?.name ?? "—" },
            { label: "Referência", value: p.reference ?? "—" },
            { label: "Registado por", value: p.registeredBy?.fullName ?? "—" },
            { label: "Registado em", value: formatDate(p.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
            { label: "Confirmado em", value: p.confirmedAt ? formatDate(p.confirmedAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—" },
            ...(p.commissionAmount ? [{ label: `Comissão (${p.commissionRate}%)`, value: formatMoney(p.commissionAmount) }] : []),
            ...(p.creditAmount && Number(p.creditAmount) > 0 ? [{ label: "Crédito gerado", value: formatMoney(p.creditAmount) }] : []),
          ]} />
          {p.notes && <div><p className="mb-1 text-xs font-medium text-muted">Observações</p><p className="text-sm">{p.notes}</p></div>}
          {(p.cancelReason || p.reverseReason) && (
            <div className="rounded-xl border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700 dark:bg-danger-500/10">
              <b>{p.status === "REVERSED" ? "Motivo do estorno" : "Motivo da anulação"}:</b> {p.reverseReason ?? p.cancelReason}
            </div>
          )}
          {!!p.allocations?.length && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Aplicação do pagamento</h3>
              <ul className="divide-y rounded-xl border text-sm">
                {p.allocations.map((a) => (
                  <li key={a.id} className="flex justify-between px-4 py-2.5">
                    <span>{a.installmentNumber ? `Prestação ${a.installmentNumber}` : "Acordo à vista / crédito"}{a.reversedAt && <span className="ml-2 text-xs text-danger-600">estornado</span>}</span>
                    <span className="tabular font-medium">{formatMoney(a.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.status === "PENDING" && !canDecide && (
            <p className="flex items-start gap-2 rounded-xl bg-subtle p-3 text-sm text-muted"><Info className="mt-0.5 h-4 w-4 shrink-0" />Aguarda confirmação de quem tem a permissão &quot;Confirmar pagamentos&quot; ou do gestor da carteira.</p>
          )}
        </div>
      )}
      <Modal open={!!action} onClose={() => setAction(null)} size="sm" title={action === "reverse" ? "Estornar pagamento?" : "Anular pagamento?"}
        description={action === "reverse" ? "O valor deixa de abater a dívida e as prestações voltam a ficar em aberto. A operação fica na auditoria." : "O pagamento pendente é descartado e não abate a dívida."}
        footer={<><Button variant="secondary" onClick={() => setAction(null)}>Voltar</Button><Button variant="danger" disabled={reason.trim().length < 5} loading={busy} onClick={runReason}>{action === "reverse" ? "Estornar" : "Anular"}</Button></>}>
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-danger-50 px-3 py-2.5 text-[13px] text-danger-700 dark:bg-danger-500/10 dark:text-danger-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Esta acção não pode ser desfeita.
        </p>
        <Field label="Motivo" required hint="Mínimo 5 caracteres."><Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} /></Field>
      </Modal>
    </Drawer>
  );
}

export type { Payment };

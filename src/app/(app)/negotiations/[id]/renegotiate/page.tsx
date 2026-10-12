"use client";
import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input, SegmentedControl, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useQuery } from "@/hooks/use-query";
import { negotiationService } from "@/lib/api/services";
import { errorMessage, newIdempotencyKey } from "@/lib/api/http";
import { cn, formatDate, formatMoney, todayIso } from "@/lib/utils";
import { addDaysIso as addDays } from "@/lib/installments";
import { InstallmentPlanEditor, type PlanState } from "@/components/shared/installment-plan";

export default function RenegotiatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const nid = Number(id);
  const router = useRouter();
  const toast = useToast();
  const idem = useRef(newIdempotencyKey());
  const today = todayIso();
  const { data: bal, error } = useQuery(() => negotiationService.renegotiationBalance(nid), [nid]);

  const [rate, setRate] = useState("0");
  const [values, setValues] = useState<{ discountAmount: string; totalAmount: string } | null>(null);
  const [mode, setMode] = useState<"single" | "installments">("single");
  const [startDate, setStartDate] = useState(today);
  const [singleEnd, setSingleEnd] = useState("");
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!bal) return;
    const t = setTimeout(() => negotiationService.calculateValues(bal.total, String(Number(rate) || 0)).then(setValues).catch(() => setValues(null)), 250);
    return () => clearTimeout(t);
  }, [bal, rate]);
  const total = values?.totalAmount ?? "0.00";
  const n = mode === "single" ? 0 : planState?.count ?? 0;
  const plan = planState?.plan ?? [];

  if (error) return <EmptyState title="Não é possível renegociar" description={error} action={<Link href={`/negotiations/${nid}`}><Button variant="secondary">Voltar ao acordo</Button></Link>} />;
  if (!bal) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  const endDate = mode === "single" ? singleEnd : planState?.endDate ?? "";
  const ok = !!values && Number(total) > 0 && startDate >= today && !!endDate && endDate > startDate && (mode === "single" || !!planState?.ok);

  async function save() {
    if (!ok || !values) return;
    setSaving(true);
    try {
      const r = await negotiationService.renegotiate(nid, {
        discountRate: String(Number(rate) || 0), discountAmount: values.discountAmount, totalAmount: values.totalAmount, finalAmount: values.totalAmount,
        effectiveDate: today, startDate, endDate, isInstallmentment: mode === "installments", isParcelaIgual: mode === "installments" ? !!planState?.isEqual : false,
        totalInstallments: mode === "installments" ? n : undefined,
        installmentments: mode === "installments" ? plan : undefined,
        notes: notes.trim() || undefined,
      }, idem.current);
      toast("success", r.message);
      router.push(`/negotiations/${r.data.id}`);
    } catch (e) { toast("error", "Não foi possível renegociar", errorMessage(e)); setSaving(false); }
  }

  return (
    <>
      <Link href={`/negotiations/${nid}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--text)]"><ArrowLeft className="h-4 w-4" /> Acordo ACD-{String(nid).padStart(5, "0")}</Link>
      <PageHeader title="Renegociar acordo" description="O novo acordo parte do saldo em dívida do anterior, com multas e juros de mora calculados pelo servidor." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Card padded={false}>
            <div className="p-5 pb-3"><CardHeader title="Saldo em dívida do acordo anterior" description="Capital em falta + multa + juros de mora até hoje." /></div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead><tr className="border-y bg-subtle text-xs text-muted">
                {["Prestação", "Vencimento", "Dias de atraso", "Capital", "Multa", "Juros", "Total"].map((h, i) => <th key={h} className={cn("px-4 py-2 font-medium", i >= 3 ? "text-right" : "text-left")}>{h}</th>)}
              </tr></thead>
              <tbody>
                {bal.lines.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-4 py-2">{l.installmentNumber ?? "Único"}</td>
                    <td className="px-4 py-2 text-muted">{formatDate(l.dueDate)}</td>
                    <td className={cn("tabular px-4 py-2", l.daysLate > 0 && "text-danger-600")}>{l.daysLate}</td>
                    <td className="tabular px-4 py-2 text-right">{formatMoney(l.principal)}</td>
                    <td className="tabular px-4 py-2 text-right">{formatMoney(l.penalty)}</td>
                    <td className="tabular px-4 py-2 text-right">{formatMoney(l.interest)}</td>
                    <td className="tabular px-4 py-2 text-right font-medium">{formatMoney(l.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t bg-subtle font-semibold">
                <td colSpan={3} className="px-4 py-2.5">Total</td>
                <td className="tabular px-4 py-2.5 text-right">{formatMoney(bal.principal)}</td>
                <td className="tabular px-4 py-2.5 text-right">{formatMoney(bal.penalty)}</td>
                <td className="tabular px-4 py-2.5 text-right">{formatMoney(bal.interest)}</td>
                <td className="tabular px-4 py-2.5 text-right">{formatMoney(bal.total)}</td>
              </tr></tfoot>
            </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Novas condições" />
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Field label="Desconto (%)"><Input type="number" min={0} max={99} step={0.5} value={rate} trailing="%" onChange={(e) => setRate(e.target.value)} /></Field>
              <Field label="Valor do desconto"><Input readOnly value={formatMoney(values?.discountAmount ?? 0)} className="tabular bg-subtle" /></Field>
              <Field label="Início" required><Input type="date" min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            </div>
            <div className="mt-5">
              <SegmentedControl value={mode} onChange={setMode} options={[{ value: "single", label: "Pagamento único" }, { value: "installments", label: "Em prestações" }]} />
            </div>
            {mode === "installments"
              ? <InstallmentPlanEditor totalAmount={total} startDate={startDate} onChange={setPlanState} disabled={!(Number(total) > 0)} emptyHint="A calcular o valor a pagar…" />
              : <Field label="Data limite de pagamento" required hint="Data acordada com o devedor para pagar o valor total." className="mt-4 w-72"><Input type="date" min={addDays(startDate, 1)} value={singleEnd} onChange={(e) => setSingleEnd(e.target.value)} /></Field>}
            <Field label="Observações" className="mt-5"><Textarea rows={2} className="min-h-[60px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-24">
          <CardHeader title="Novo acordo" />
          <p className="tabular mt-3 text-3xl font-semibold">{formatMoney(total)}</p>
          <p className="text-sm text-muted">{mode === "single" ? "Pagamento único" : `${n || "?"} prestações`} · saldo {formatMoney(bal.total)}</p>
          <p className="mt-4 rounded-lg bg-subtle p-3 text-xs text-muted">O acordo anterior passa a <b>Renegociado</b>. Pagamentos pendentes no acordo anterior têm de ser confirmados ou anulados antes.</p>
          <Button size="lg" className="mt-4 w-full" icon={<RefreshCcw className="h-4 w-4" />} disabled={!ok} loading={saving} onClick={save}>Criar renegociação</Button>
        </Card>
      </div>
    </>
  );
}

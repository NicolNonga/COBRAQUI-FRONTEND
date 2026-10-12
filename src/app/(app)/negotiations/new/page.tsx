"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Banknote, CalendarRange, Check, FolderKanban, Loader2, Percent, Users } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, SegmentedControl, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { DebtorPicker } from "@/components/shared/debtor-picker";
import { ProcessStateBadge } from "@/components/shared/status";
import { debtorService, negotiationService, processService } from "@/lib/api/services";
import { errorMessage, newIdempotencyKey } from "@/lib/api/http";
import type { Debtor, InstallmentInput, Process } from "@/types/models";
import { cn, formatDate, formatMoney, sumMoney, todayIso } from "@/lib/utils";
import { addDaysIso as addDays } from "@/lib/installments";
import { InstallmentPlanEditor, type PlanState } from "@/components/shared/installment-plan";

function Section({ n, icon, title, description, children, done }: { n: number; icon: ReactNode; title: string; description: string; children: ReactNode; done?: boolean }) {
  return (
    <Card>
      <div className="flex gap-4">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", done ? "bg-success-500 text-white" : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300")}>
          {done ? <Check className="h-4 w-4" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className="text-muted [&_svg]:h-4 [&_svg]:w-4">{icon}</span><h2 className="text-[15px] font-semibold">{title}</h2></div>
          <p className="mt-0.5 text-[13px] text-muted">{description}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </Card>
  );
}

export default function NewNegotiationPage() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const today = todayIso();
  const idemKey = useRef(newIdempotencyKey());

  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loadingProc, setLoadingProc] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [singleEnd, setSingleEnd] = useState("");
  const [discountRate, setDiscountRate] = useState("0");
  const [values, setValues] = useState<{ discountAmount: string; totalAmount: string } | null>(null);
  const [mode, setMode] = useState<"single" | "installments">("single");
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [approvalLimit, setApprovalLimit] = useState<number | null>(null);
  useEffect(() => { negotiationService.settings().then((c) => setApprovalLimit(Number(c.approvalDiscountLimitPercent))).catch(() => null); }, []);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // devedor vindo da URL (?debtorId=&processId=)
  useEffect(() => {
    const id = params.get("debtorId");
    if (id) debtorService.get(Number(id)).then(setDebtor).catch(() => null);
  }, [params]);

  // processos abertos do devedor
  useEffect(() => {
    setProcesses([]); setPicked([]);
    if (!debtor) return;
    setLoadingProc(true);
    processService.list({ debtorId: debtor.id, open: true, perPage: 100 })
      .then((r) => {
        setProcesses(r.data);
        // os processos já presos a um acordo activo não podem entrar noutro: ficam de fora da selecção
        const free = r.data.filter((p) => !p.inNegotiation);
        const pre = Number(params.get("processId"));
        setPicked(pre && free.some((p) => p.id === pre) ? [pre] : free.map((p) => p.id));
      })
      .catch((e) => toast("error", "Não foi possível carregar os processos", errorMessage(e)))
      .finally(() => setLoadingProc(false));
  }, [debtor]); // eslint-disable-line react-hooks/exhaustive-deps

  const freeProcesses = useMemo(() => processes.filter((p) => !p.inNegotiation), [processes]);
  const lockedCount = processes.length - freeProcesses.length;

  const debtAmount = useMemo(() => sumMoney(processes.filter((p) => picked.includes(p.id)).map((p) => p.totalAmount)), [processes, picked]);

  // desconto/total calculados pelo backend
  useEffect(() => {
    if (!(Number(debtAmount) > 0)) { setValues(null); return; }
    const rate = Number(discountRate);
    if (isNaN(rate) || rate < 0 || rate >= 100) return;
    const t = setTimeout(() => {
      negotiationService.calculateValues(debtAmount, String(rate)).then(setValues).catch(() => setValues(null));
    }, 250);
    return () => clearTimeout(t);
  }, [debtAmount, discountRate]);

  const total = values?.totalAmount ?? "0.00";
  const n = mode === "single" ? 0 : planState?.count ?? 0;
  const plan = planState?.plan ?? [];
  const endDate = mode === "single" ? singleEnd : planState?.endDate ?? "";
  const datesOk = effectiveDate <= today && startDate >= effectiveDate && !!endDate && endDate > startDate;
  const planOk = mode === "single" || !!planState?.ok;
  const canSave = !!debtor && picked.length > 0 && Number(total) > 0 && datesOk && planOk;

  async function save() {
    if (!canSave || !values) return;
    setSaving(true);
    try {
      const r = await negotiationService.create({
        debtAmount, discountRate: String(Number(discountRate)), discountAmount: values.discountAmount, totalAmount: values.totalAmount, finalAmount: values.totalAmount,
        effectiveDate, startDate, endDate, isInstallmentment: mode === "installments", isParcelaIgual: mode === "installments" ? !!planState?.isEqual : false,
        totalInstallments: mode === "installments" ? n : undefined, processes: picked.map((id) => ({ id })),
        installmentments: mode === "installments" ? plan : undefined,
        notes: notes.trim() || undefined,
      }, idemKey.current);
      toast("success", r.message, r.data.status === "PENDING_APPROVAL" ? "O desconto excede o limite: o acordo aguarda aprovação do gestor." : "O acordo já está em vigor.");
      router.push(`/negotiations/${r.data.id}`);
    } catch (e) {
      toast("error", "Não foi possível criar o acordo", errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <>
      <Link href="/negotiations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--text)]"><ArrowLeft className="h-4 w-4" /> Negociações</Link>
      <PageHeader title="Nova negociação" description="Defina as condições do acordo de pagamento. Os valores são calculados e validados pelo servidor." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Section n={1} icon={<Users />} title="Devedor e processos" description="Seleccione o devedor e os processos de cobrança a incluir." done={!!debtor && picked.length > 0}>
            <DebtorPicker value={debtor} onChange={setDebtor} />
            {debtor && (
              <div className="mt-4 overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-subtle text-xs text-muted">
                    <th className="w-10 pl-4"><Checkbox checked={picked.length === freeProcesses.length && freeProcesses.length > 0} indeterminate={picked.length > 0 && picked.length < freeProcesses.length} onChange={(v) => setPicked(v ? freeProcesses.map((p) => p.id) : [])} /></th>
                    <th className="px-3 py-2 text-left font-medium">Processo</th><th className="px-3 py-2 text-left font-medium">Facturas</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th><th className="px-4 py-2 text-right font-medium">Em dívida</th>
                  </tr></thead>
                  <tbody>
                    {loadingProc && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
                    {!loadingProc && processes.map((p) => {
                      const locked = !!p.inNegotiation;
                      const on = picked.includes(p.id);
                      const toggle = () => { if (!locked) setPicked((x) => (on ? x.filter((y) => y !== p.id) : [...x, p.id])); };
                      return (
                        <tr key={p.id} onClick={toggle} className={cn("border-b last:border-0", locked ? "cursor-not-allowed opacity-60" : "cursor-pointer", on ? "bg-brand-50/40 dark:bg-brand-500/5" : !locked && "hover:bg-subtle")}>
                          <td className="pl-4"><Checkbox checked={on} disabled={locked} onChange={toggle} /></td>
                          <td className="px-3 py-2.5 font-mono text-xs">PRC-{String(p.id).padStart(5, "0")}</td>
                          <td className="px-3 py-2.5 text-muted">{p.invoicesCount ?? 0}</td>
                          <td className="px-3 py-2.5">
                            {locked
                              ? <Badge tone="warning">Já em acordo</Badge>
                              : <ProcessStateBadge code={p.processState?.code} name={p.processState?.name} />}
                          </td>
                          <td className="tabular px-4 py-2.5 text-right font-medium">{formatMoney(p.totalAmount)}</td>
                        </tr>
                      );
                    })}
                    {!loadingProc && processes.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Este devedor não tem processos de cobrança abertos. <Link href="/processes" className="text-brand-600 hover:underline">Ver processos</Link></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {lockedCount > 0 && (
              <p className="mt-2 text-xs text-muted">
                {lockedCount === 1 ? "1 processo está" : `${lockedCount} processos estão`} num acordo activo (ou à espera de aprovação) e não {lockedCount === 1 ? "pode" : "podem"} entrar noutro. Cancele ou quebre esse acordo em <Link href="/negotiations" className="text-brand-600 hover:underline">Negociações</Link> para o libertar.
              </p>
            )}
          </Section>

          <Section n={2} icon={<Percent />} title="Condições" description="Desconto e datas do acordo." done={!!values && datesOk}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor da dívida"><Input value={formatMoney(debtAmount)} readOnly className="tabular bg-subtle" /></Field>
              <Field label="Desconto (%)" hint={approvalLimit !== null ? (Number(discountRate) > approvalLimit ? `Acima de ${approvalLimit}%: o acordo fica a aguardar aprovação do gestor.` : `Até ${approvalLimit}% o acordo entra logo em vigor; acima disso precisa de aprovação.`) : "Acima do limite definido, o acordo precisa de aprovação."}>
                <Input type="number" min={0} max={99} step={0.5} value={discountRate} trailing="%" className="tabular" onChange={(e) => setDiscountRate(e.target.value)} />
              </Field>
              <Field label="Valor do desconto"><Input value={formatMoney(values?.discountAmount ?? 0)} readOnly className="tabular bg-subtle" /></Field>
              <Field label="Valor a pagar"><Input value={formatMoney(total)} readOnly className="tabular bg-subtle font-semibold" /></Field>
              <Field label="Data efectiva" required hint="Data em que o acordo foi celebrado (não pode ser futura).">
                <Input type="date" max={today} value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </Field>
              <Field label="Início da vigência" required><Input type="date" min={effectiveDate} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[0, 5, 10, 15, 20, 30].map((p) => (
                <button key={p} type="button" onClick={() => setDiscountRate(String(p))} className={cn("rounded-full border px-3 py-1 text-xs font-medium", Number(discountRate) === p ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "hover:bg-soft")}>{p}%</button>
              ))}
            </div>
          </Section>

          <Section n={3} icon={<CalendarRange />} title="Plano de pagamento" description="Pagamento único ou em prestações. As datas de vencimento são definidas por si, conforme combinado com o devedor." done={planOk && !!debtor}>
            <SegmentedControl value={mode} onChange={setMode} options={[{ value: "single", label: "Pagamento único" }, { value: "installments", label: "Em prestações" }]} />

            {mode === "single" ? (
              <Field label="Data limite de pagamento" required hint="Data acordada com o devedor para pagar o valor total." className="mt-4 w-72"><Input type="date" min={addDays(startDate, 1)} value={singleEnd} onChange={(e) => setSingleEnd(e.target.value)} /></Field>
            ) : (
              <InstallmentPlanEditor totalAmount={total} startDate={startDate} onChange={setPlanState}
                disabled={!debtor || !picked.length || !(Number(total) > 0)}
                emptyHint={!debtor ? "Seleccione um devedor para criar o plano." : "Seleccione os processos a incluir."} />
            )}
            <Field label="Observações (opcional)" className="mt-5"><Textarea rows={2} className="min-h-[64px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condições acordadas, contacto com o devedor…" /></Field>
          </Section>
        </div>

        <div className="xl:sticky xl:top-24 xl:self-start">
          <Card className="overflow-hidden p-0" padded={false}>
            <div className="bg-ink-950 p-5 text-white dark:bg-brand-900">
              <p className="text-xs text-white/60">Valor a pagar</p>
              <p className="tabular mt-1 text-[28px] font-semibold tracking-tight">{formatMoney(total)}</p>
              <p className="mt-1 text-sm text-white/60">{!debtor ? "Seleccione um devedor" : mode === "single" ? "Pagamento único" : n ? `${n} prestações` : "Defina o número de prestações"}</p>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <CardHeader title="Resumo" />
              {[
                ["Devedor", debtor?.name ?? "—"],
                ["Processos", `${picked.length}`],
                ["Dívida", formatMoney(debtAmount)],
                ["Desconto", `−${formatMoney(values?.discountAmount ?? 0)} (${Number(discountRate || 0).toLocaleString("pt-PT")}%)`],
                ["Vigência", endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : "—"],
              ].map(([l, v]) => <div key={l} className="flex justify-between gap-4"><span className="text-muted">{l}</span><span className="tabular truncate text-right font-medium">{v}</span></div>)}
              {!datesOk && debtor && <p className="flex items-start gap-2 rounded-lg bg-warning-50 p-2.5 text-xs text-warning-700 dark:bg-warning-500/10"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Verifique as datas: a data efectiva não pode ser futura e o início não pode ser anterior a ela.</p>}
              <div className="pt-3">
                <Button size="lg" className="w-full" disabled={!canSave} loading={saving} onClick={save} icon={<Banknote className="h-4 w-4" />}>Criar acordo</Button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted"><FolderKanban className="h-3.5 w-3.5" /> Os processos ficam associados a este acordo.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

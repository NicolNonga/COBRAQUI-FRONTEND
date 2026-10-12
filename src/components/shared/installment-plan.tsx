"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Field, Input, SegmentedControl } from "@/components/ui/form";
import type { InstallmentInput } from "@/types/models";
import { negotiationService } from "@/lib/api/services";
import { cn, formatMoney } from "@/lib/utils";
import { PCT_TOTAL, amountsFromPct, fromCents, fromPctUnits, redistribute, splitEqual, suggestDates, toCents, toPctUnits } from "@/lib/installments";

type Row = { dueDate: string; pct: number /* unidades: 1% = 10 000 */; penalty: string };
export interface PlanState {
  plan: InstallmentInput[];
  /** vencimento da última prestação (fim do acordo) */
  endDate: string;
  isEqual: boolean;
  count: number;
  ok: boolean;
}

const pctOf = (amountCents: number, totalCents: number) => (totalCents ? ((amountCents / totalCents) * 100).toFixed(4) : "0");

/**
 * Plano de prestações definido pelo utilizador:
 *  - escolhe se as prestações são iguais ou com quotas diferentes;
 *  - iguais → o valor a pagar é dividido por igual (cêntimos que sobram na última);
 *  - diferentes → indica a PERCENTAGEM de cada prestação e o valor é calculado a partir dela;
 *    ao alterar uma percentagem, as restantes são recalculadas para somar 100%;
 *  - a soma das prestações é sempre igual ao valor a pagar (os cêntimos do arredondamento
 *    ficam na última prestação, como no backend);
 *  - as datas de vencimento são do utilizador (1.º vencimento + intervalo opcional);
 *  - a multa por atraso geral reflecte-se em todas as prestações e mostra o valor em kwanzas.
 */
export function InstallmentPlanEditor({ totalAmount, startDate, disabled, emptyHint, defaultCount = "", onChange }: {
  totalAmount: string; startDate: string; disabled?: boolean; emptyHint?: string; defaultCount?: number | ""; onChange: (s: PlanState) => void;
}) {
  const totalC = toCents(totalAmount);
  const [count, setCount] = useState<number | "">(defaultCount);
  const [equalMode, setEqualMode] = useState<"equal" | "custom">("equal");
  const [firstDue, setFirstDue] = useState("");
  const [gap, setGap] = useState<number | "">("");
  const [penalty, setPenalty] = useState("2");
  const [rows, setRows] = useState<Row[]>([]);
  const [fixedPct, setFixedPct] = useState<Set<number>>(new Set());
  const [manualDate, setManualDate] = useState<Set<number>>(new Set());
  const n = Number(count) || 0;
  const [maxPenalty, setMaxPenalty] = useState<number | null>(null);
  useEffect(() => {
    negotiationService.settings().then((c) => {
      const max = Number(c.maxPenaltyPercent);
      setMaxPenalty(max);
      if (Number(penalty) > max) applyPenalty(String(max));
    }).catch(() => setMaxPenalty(null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // (re)cria as linhas quando muda o nº de prestações ou o tipo — quotas iguais por omissão
  useEffect(() => {
    if (disabled || !(totalC > 0) || n < 1) { setRows([]); return; }
    const pcts = splitEqual(PCT_TOTAL, n);
    setFixedPct(new Set()); setManualDate(new Set());
    setRows((prev) => pcts.map((pct, i) => ({ pct, dueDate: prev[i]?.dueDate ?? "", penalty: prev[i]?.penalty ?? (penalty || "0") })));
  }, [disabled, totalC > 0, n, equalMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // datas sugeridas a partir do 1.º vencimento + intervalo (as escritas à mão mantêm-se)
  useEffect(() => {
    setRows((prev) => {
      const dates = suggestDates(firstDue, gap, prev.map((r) => r.dueDate), manualDate);
      return prev.map((r, i) => ({ ...r, dueDate: dates[i] }));
    });
  }, [firstDue, gap, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /** valores em cêntimos: iguais → divisão exacta; diferentes → derivados das percentagens */
  const amounts = useMemo(
    () => (equalMode === "equal" ? splitEqual(totalC, rows.length) : amountsFromPct(totalC, rows.map((r) => r.pct))),
    [equalMode, totalC, rows],
  );

  const applyPenalty = (v: string) => { setPenalty(v); setRows((prev) => prev.map((r) => ({ ...r, penalty: v }))); };
  const editPct = (k: number, value: string) => {
    const fixed = new Set(fixedPct).add(k);
    const next = redistribute(PCT_TOTAL, rows.map((r, i) => (i === k ? Math.min(PCT_TOTAL, Math.max(0, toPctUnits(value))) : r.pct)), fixed);
    setFixedPct(fixed);
    setRows(rows.map((r, i) => ({ ...r, pct: next[i] })));
  };
  const resetPcts = () => { const eq = splitEqual(PCT_TOTAL, rows.length); setFixedPct(new Set()); setRows(rows.map((r, i) => ({ ...r, pct: eq[i] }))); };
  const editDate = (k: number, value: string) => {
    if (k === 0) { setFirstDue(value); return; }
    setManualDate(new Set(manualDate).add(k));
    setRows(rows.map((r, i) => (i === k ? { ...r, dueDate: value } : r)));
  };
  const editPenalty = (k: number, value: string) => setRows(rows.map((r, i) => (i === k ? { ...r, penalty: value } : r)));

  const planSumC = amounts.reduce((s, a) => s + a, 0);
  const pctSum = rows.reduce((s, r) => s + r.pct, 0);
  // como o backend: a última prestação é de ajuste e não conta para "iguais"
  const allEqual = amounts.length > 1 && amounts.slice(0, -1).every((a) => a === amounts[0]);

  const issues = useMemo(() => {
    const out: string[] = [];
    if (!rows.length) return out;
    if (rows.some((r) => !r.dueDate)) out.push("Indique a data de vencimento de todas as prestações.");
    else {
      if (startDate && rows[0].dueDate < startDate) out.push("O 1.º vencimento não pode ser anterior ao início da vigência.");
      if (rows.some((r, i) => i > 0 && r.dueDate <= rows[i - 1].dueDate)) out.push("Cada prestação tem de vencer depois da anterior.");
    }
    if (equalMode === "custom") {
      if (rows.some((r) => r.pct <= 0)) out.push("Todas as prestações têm de ter uma percentagem maior que zero.");
      if (pctSum !== PCT_TOTAL) out.push(`A soma das percentagens é ${fromPctUnits(pctSum)}% — tem de ser exactamente 100%.`);
      if (allEqual) out.push("Escolheu quotas diferentes, mas as prestações estão todas iguais: altere uma percentagem ou escolha \"Prestações iguais\".");
    }
    if (amounts.some((a) => a <= 0)) out.push("Todas as prestações têm de ter um valor maior que zero.");
    if (planSumC !== totalC) out.push(`A soma das prestações difere do valor a pagar em ${formatMoney(((totalC - planSumC) / 100).toFixed(2))}.`);
    if (rows.some((r) => r.penalty === "" || isNaN(Number(r.penalty)) || Number(r.penalty) < 0)) out.push("A multa por atraso tem de ser um número igual ou maior que zero.");
    if (maxPenalty !== null && rows.some((r) => Number(r.penalty) > maxPenalty)) out.push(`A multa por atraso não pode passar de ${maxPenalty.toLocaleString("pt-PT")}% (limite definido pela empresa).`);
    return out;
  }, [rows, amounts, startDate, planSumC, pctSum, totalC, equalMode, allEqual, maxPenalty]);

  const plan: InstallmentInput[] = useMemo(() => rows.map((r, i) => ({
    installmentNumber: i + 1, installmentAmount: fromCents(amounts[i] ?? 0), installmentPercentage: pctOf(amounts[i] ?? 0, totalC), dueDate: r.dueDate, penaltyPercentage: r.penalty || "0",
  })), [rows, amounts, totalC]);

  useEffect(() => {
    onChange({ plan, endDate: rows[rows.length - 1]?.dueDate ?? "", isEqual: rows.length <= 1 || equalMode === "equal", count: n, ok: n > 0 && rows.length === n && issues.length === 0 });
  }, [plan, issues, equalMode, n]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nº de prestações" required>
          <Input type="number" min={1} max={60} placeholder="Ex: 6" value={count} disabled={disabled}
            onChange={(e) => setCount(e.target.value === "" ? "" : Math.min(60, Math.max(1, Number(e.target.value))))} />
        </Field>
        <Field label="Valor das prestações" className="lg:col-span-3">
          <SegmentedControl value={equalMode} onChange={setEqualMode} options={[{ value: "equal", label: "Prestações iguais" }, { value: "custom", label: "Percentagens diferentes" }]} />
        </Field>
        <Field label="1.º vencimento" required hint="Data acordada com o devedor.">
          <Input type="date" min={startDate} value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
        </Field>
        <Field label="Intervalo entre prestações (dias)" hint="Opcional. Preenche as datas seguintes: cada prestação vence este nº de dias depois da anterior (ex.: 30 = mensal).">
          <Input type="number" min={1} max={365} placeholder="Ex: 30" value={gap} onChange={(e) => setGap(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))} />
        </Field>
        <Field label="Multa por atraso" className="sm:col-span-2" hint={`Percentagem cobrada sobre a prestação se for paga depois do vencimento${maxPenalty !== null ? ` (máximo ${maxPenalty.toLocaleString("pt-PT")}%)` : ""}. Aplica-se a todas as prestações; pode ajustar cada uma na tabela.`}>
          <Input type="number" min={0} max={maxPenalty ?? undefined} step={0.5} value={penalty} trailing="%" className="max-w-[160px]" onChange={(e) => applyPenalty(e.target.value)} />
        </Field>
      </div>

      <p className="mt-3 text-xs text-muted">
        {equalMode === "equal"
          ? `Prestações iguais: ${formatMoney(totalAmount)} dividido por igual; se sobrarem cêntimos, ficam na última prestação.`
          : `Percentagens diferentes: indique a quota de cada prestação e o valor é calculado sobre ${formatMoney(totalAmount)}. Ao alterar uma percentagem, as restantes são recalculadas para somar 100%; as que alterou ficam marcadas.`}
      </p>

      {/* scroll horizontal (colunas) e vertical (muitas prestações), com cabeçalho fixo */}
      <div className="mt-3 max-h-[460px] overflow-auto rounded-xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 z-10"><tr className="border-b bg-subtle text-xs text-muted [&>th]:bg-subtle">
            <th className="px-4 py-2 text-left font-medium">Nº</th>
            <th className="px-4 py-2 text-left font-medium">Vencimento</th>
            <th className="px-4 py-2 text-right font-medium">% do valor a pagar</th>
            <th className="px-4 py-2 text-right font-medium">Valor</th>
            <th className="px-4 py-2 text-left font-medium">Multa por atraso</th>
            <th className="px-4 py-2 text-right font-medium">Multa se atrasar</th>
          </tr></thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={k} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{k + 1}</td>
                <td className="px-4 py-2">
                  <Input type="date" value={r.dueDate} min={k ? rows[k - 1].dueDate || startDate : startDate} className="h-8 w-40" invalid={!r.dueDate} onChange={(e) => editDate(k, e.target.value)} />
                </td>
                <td className="px-4 py-2 text-right">
                  {equalMode === "equal"
                    ? <span className="tabular text-muted">{pctOf(amounts[k] ?? 0, totalC).replace(/\.?0+$/, "")}%</span>
                    : <Input type="number" step="0.01" min="0" max="100" trailing="%" defaultValue={fromPctUnits(r.pct)} key={`${k}-${r.pct}`}
                        className={cn("tabular ml-auto h-8 w-28 text-right", fixedPct.has(k) && "border-brand-400 bg-brand-50/50 dark:bg-brand-500/10")}
                        onBlur={(e) => { if (toPctUnits(e.target.value) !== r.pct) editPct(k, e.target.value); }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />}
                </td>
                <td className="tabular px-4 py-2 text-right font-medium">{formatMoney(fromCents(amounts[k] ?? 0))}</td>
                <td className="px-4 py-2"><Input type="number" min={0} step={0.5} value={r.penalty} trailing="%" className="h-8 w-24" onChange={(e) => editPenalty(k, e.target.value)} /></td>
                <td className="tabular px-4 py-2 text-right text-muted">{formatMoney((((amounts[k] ?? 0) * Number(r.penalty || 0)) / 10000).toFixed(2))}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">{disabled ? emptyHint ?? "Complete os passos anteriores." : "Indique o número de prestações."}</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-10"><tr className="border-t bg-subtle [&>td]:bg-subtle">
              <td colSpan={2} className="px-4 py-2.5 text-sm font-medium">Total do plano</td>
              <td className={cn("tabular px-4 py-2.5 text-right font-semibold", pctSum !== PCT_TOTAL && "text-danger-600")}>{fromPctUnits(pctSum)}%</td>
              <td className={cn("tabular px-4 py-2.5 text-right font-semibold", planSumC !== totalC && "text-danger-600")}>{formatMoney(fromCents(planSumC))}</td>
              <td colSpan={2} className="px-4 py-2.5 text-right">
                {equalMode === "custom" && fixedPct.size > 0 && <button type="button" onClick={resetPcts} className="text-xs text-brand-600 hover:underline">Repor percentagens iguais</button>}
              </td>
            </tr></tfoot>
          )}
        </table>
      </div>
      {issues.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-danger-600">
          {issues.map((m) => <li key={m} className="flex items-start gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{m}</li>)}
        </ul>
      )}
    </>
  );
}

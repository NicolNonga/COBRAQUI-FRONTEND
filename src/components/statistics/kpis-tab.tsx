"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/display";
import { AreaChart } from "@/components/charts/charts";
import { ErrorBanner } from "@/components/shared/process-list";
import { useQuery } from "@/hooks/use-query";
import { reportService } from "@/lib/api/reports";
import { cn, formatNumber } from "@/lib/utils";
import { AgingStack, dateS, Explain, FilterBar, filtersToParams, initialFilters, KpiTile, money, moneyShort, pctS, PdfButton, plural, toneFor, type FiltersState } from "./shared";

export function KpisTab() {
  const [f, setF] = useState<FiltersState>(initialFilters("90d"));
  const params = filtersToParams(f, { agent: false });
  const { data: k, loading, error, reload } = useQuery(() => reportService.kpis(params), [JSON.stringify(params)]);
  const cur = k?.currency.code ?? "AOA";
  const [showHow, setShowHow] = useState(false);

  return (
    <>
      <FilterBar value={f} onChange={setF} agent={false} actions={<PdfButton report="kpis" params={params} label="Relatório em PDF" />} />
      {error && <ErrorBanner message={error} onRetry={reload} />}
      {k && <p className="mb-4 text-sm text-muted">Período de {dateS(k.period.from)} a {dateS(k.period.to)} ({k.period.days} dias) · valores em {k.currency.code}</p>}

      {/* indicadores essenciais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile loading={loading && !k} label="DSO · prazo médio de recebimento" verdict
          value={k?.dso === null || !k ? "—" : `${formatNumber(k.dso)} dias`} tone={toneFor(k?.dso ?? null, 45, 90)}
          hint={k?.dso === null ? "Sem facturação no período" : "Dias de facturação ainda por receber"}
          help="DSO = saldo a receber no fim do período ÷ valor facturado no período × dias do período. Quanto menor, mais depressa a carteira se converte em dinheiro." />
        <KpiTile loading={loading && !k} label="Índice de inadimplência" verdict
          value={pctS(k?.delinquency.rate)} tone={toneFor(k?.delinquency.rate ?? null, 10, 25)}
          hint={k ? `${formatNumber(k.delinquency.overdueCount)} de ${plural(k.delinquency.maturedCount, "factura vencida", "facturas vencidas")} no período por pagar (${pctS(k.delinquency.countRate)} em quantidade)` : undefined}
          help="Valor ainda em aberto das facturas que venceram no período ÷ valor total dessas facturas. Mede quanto do que devia ter sido pago não foi." />
        <KpiTile loading={loading && !k} label="CEI · eficiência da cobrança" verdict
          value={pctS(k?.cei)} tone={toneFor(k?.cei ?? null, 80, 50, true)}
          hint="Do que era cobrável no período, quanto se cobrou (100% = tudo)"
          help="CEI = (saldo inicial + facturado − saldo final) ÷ (saldo inicial + facturado − saldo final ainda não vencido) × 100. Não depende do volume de vendas: mede a eficiência real da equipa." />
        <KpiTile loading={loading && !k} label="Custo por cobrança" verdict
          value={pctS(k?.costToCollect)} tone={toneFor(k?.costToCollect ?? null, 10, 25)}
          hint={k ? (k.costToCollect === null ? "Sem valor recuperado no período" : `Custa ${money(k.costToCollect, cur)} recuperar ${money(100, cur)}`) : undefined}
          help="Custos da operação lançados no período (separador Custos) ÷ valor recuperado no período × 100. Com filtro de credor, os custos gerais repartem-se pelo peso do credor no recuperado." />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile loading={loading && !k} label="Saldo a receber" tone="brand" value={k ? moneyShort(k.receivable.end, cur) : "—"}
          hint={k ? <>Vencido {moneyShort(k.receivable.overdue, cur)} · a vencer {moneyShort(k.receivable.currentNotDue, cur)}</> : undefined}
          help="Facturas emitidas (não anuladas) − pagamentos confirmados − descontos concedidos em acordos, no último dia do período." />
        <KpiTile loading={loading && !k} label="Facturado no período" value={k ? moneyShort(k.sales, cur) : "—"} hint={k ? plural(k.salesCount, "factura", "facturas") : undefined} />
        <KpiTile loading={loading && !k} label="Recuperado no período" tone="success" value={k ? moneyShort(k.recovered, cur) : "—"}
          hint={k ? plural(k.recoveredCount, "pagamento confirmado", "pagamentos confirmados") : undefined} />
        <KpiTile loading={loading && !k} label={`Perdas prováveis (> ${k?.delinquency.lossThresholdDays ?? 90} dias)`} tone="danger"
          value={k ? moneyShort(k.delinquency.lossAmount, cur) : "—"}
          hint={k ? `${pctS(k.delinquency.lossRate)} do valor em aberto · ${plural(k.delinquency.lossCount, "factura", "facturas")}` : undefined}
          help="Valor em aberto hoje de facturas vencidas há mais de 90 dias: a probabilidade de recuperação cai muito a partir daqui." />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader title="Aging list" description={k ? `${money(k.aging.totalOutstanding, cur)} em aberto hoje em ${plural(k.aging.invoices, "factura", "facturas")} · ${pctS(k.aging.overduePct)} vencido` : "Valor em aberto por faixa de atraso"} />
          <div className="mt-5">{k ? <AgingStack buckets={k.aging.buckets} currency={cur} /> : <Skeleton className="h-24" />}</div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Custos e margem" description="Operação de cobrança no período" />
          {k ? (
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Custos lançados</dt><dd className="tabular font-medium">{money(k.costs, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Comissões geradas</dt><dd className="tabular font-medium">{money(k.commissions, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Custo por pagamento</dt><dd className="tabular font-medium">{k.costPerPayment === null ? "—" : money(k.costPerPayment, cur)}</dd></div>
              <div className="flex justify-between border-t pt-2.5"><dt className="font-medium">Margem</dt>
                <dd className={cn("tabular font-semibold", k.margin >= 0 ? "text-success-700 dark:text-success-300" : "text-danger-700 dark:text-danger-300")}>{money(k.margin, cur)}</dd></div>
              {k.costs === 0 && <p className="pt-1 text-xs text-muted">Ainda não há custos lançados neste período. Registe-os no separador <b>Custos</b> para obter o custo por cobrança.</p>}
            </dl>
          ) : <Skeleton className="mt-4 h-28" />}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Evolução mensal" description="Facturado vs. recuperado e indicadores por mês (últimos 6 meses)" />
        {!k ? <Skeleton className="mt-4 h-64" /> : k.trend.length < 2 ? (
          <EmptyState title="Poucos dados" description="São precisos pelo menos dois meses para ver a evolução." />
        ) : (
          <>
            <div className="mt-4 flex gap-5 text-xs">
              <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full bg-brand-500" /> Facturado</span>
              <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full bg-success-500" /> Recuperado</span>
            </div>
            <AreaChart height={220} data={k.trend.map((m) => ({ label: m.label, sales: m.sales, recovered: m.recovered }))}
              series={[{ key: "sales", label: "Facturado", color: "var(--color-brand-500)" }, { key: "recovered", label: "Recuperado", color: "var(--color-success-500)" }]}
              format={(v) => moneyShort(v, cur)} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-y bg-subtle text-xs text-muted">
                  <th className="px-4 py-2 text-left font-medium">Mês</th><th className="px-4 py-2 text-right font-medium">Saldo a receber</th>
                  <th className="px-4 py-2 text-right font-medium">Facturado</th><th className="px-4 py-2 text-right font-medium">Recuperado</th>
                  <th className="px-4 py-2 text-right font-medium">DSO</th><th className="px-4 py-2 text-right font-medium">CEI</th><th className="px-4 py-2 text-right font-medium">Custo por cobrança</th>
                </tr></thead>
                <tbody>
                  {k.trend.map((m) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{m.label}{m.partial && <span className="ml-1.5 text-xs font-normal text-muted">(em curso)</span>}</td>
                      <td className="tabular px-4 py-2.5 text-right">{money(m.receivable, cur)}</td>
                      <td className="tabular px-4 py-2.5 text-right">{money(m.sales, cur)}</td>
                      <td className="tabular px-4 py-2.5 text-right">{money(m.recovered, cur)}</td>
                      <td className="tabular px-4 py-2.5 text-right">{m.dso === null ? "—" : `${m.dso} d`}</td>
                      <td className="tabular px-4 py-2.5 text-right">{pctS(m.cei)}</td>
                      <td className="tabular px-4 py-2.5 text-right">{pctS(m.costToCollect)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <button onClick={() => setShowHow((v) => !v)} className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
        <ChevronDown className={cn("h-4 w-4 transition-transform", showHow && "rotate-180")} /> Como são calculados os indicadores
      </button>
      {showHow && (
        <Explain>
          <p><b>Saldo a receber</b> numa data = facturas emitidas até essa data (sem as anuladas) − pagamentos confirmados − descontos concedidos em acordos em vigor ou concluídos. Só entram valores na moeda base.</p>
          <p className="mt-2"><b>Valor em aberto por factura</b> (aging): sem acordo, o valor da factura; com acordo, o que falta pagar do acordo, repartido pelas facturas na proporção do valor de cada uma. Num acordo quebrado o desconto perde-se.</p>
          <p className="mt-2"><b>Referências:</b> DSO até 45 dias é bom e acima de 90 dias é crítico; inadimplência até 10% é boa e acima de 25% é crítica; CEI a partir de 80% é bom e até 50% é crítico; custo por cobrança até 10% é bom e acima de 25% é crítico.</p>
        </Explain>
      )}
    </>
  );
}

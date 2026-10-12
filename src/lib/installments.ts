/**
 * Cálculo do plano de prestações no ecrã (em cêntimos, sem erros de vírgula flutuante).
 * As regras espelham a validação do backend:
 *  - prestações iguais: todas com o mesmo valor; a ÚLTIMA absorve os cêntimos que sobram;
 *  - soma das prestações = valor a pagar, exactamente.
 */
export const toCents = (v: string | number) => Math.round(Number(v || 0) * 100);
export const fromCents = (c: number) => (c / 100).toFixed(2);

/** divide em n partes iguais (arredondado para baixo); a última leva o resto */
export function splitEqual(totalCents: number, n: number): number[] {
  if (n <= 0) return [];
  const part = Math.floor(totalCents / n);
  const parts = Array.from({ length: n }, () => part);
  parts[n - 1] += totalCents - part * n;
  return parts;
}

/**
 * Valores diferentes: as prestações alteradas pelo utilizador ficam fixas e o que falta
 * para o total é repartido em partes iguais pelas restantes.
 */
export function redistribute(totalCents: number, amounts: number[], fixed: Set<number>): number[] {
  const free = amounts.map((_, i) => i).filter((i) => !fixed.has(i));
  if (!free.length) return amounts;
  const fixedSum = amounts.reduce((s, a, i) => (fixed.has(i) ? s + a : s), 0);
  const rest = Math.max(0, totalCents - fixedSum);
  const parts = splitEqual(rest, free.length);
  const out = [...amounts];
  free.forEach((idx, k) => (out[idx] = parts[k]));
  return out;
}

export const addDaysIso = (iso: string, d: number) => {
  const x = new Date(`${iso}T12:00:00`);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};

/**
 * Datas: o utilizador indica o 1.º vencimento; com um intervalo, as seguintes são sugeridas
 * (1.º + intervalo × k). Datas escritas à mão na tabela nunca são substituídas.
 */
export function suggestDates(first: string, intervalDays: number | "", current: string[], manual: Set<number>): string[] {
  return current.map((d, i) => {
    if (manual.has(i)) return d;
    if (i === 0) return first;
    if (!first || !intervalDays) return "";
    return addDaysIso(first, Number(intervalDays) * i);
  });
}

/* ─────────────────────── Percentagens (4 casas decimais) ───────────────────────
 * O utilizador define a QUOTA de cada prestação em percentagem; o valor é derivado.
 * Unidade interna: 1% = 10 000 unidades, logo 100% = PCT_TOTAL. Evita erros de vírgula.
 */
export const PCT_TOTAL = 1_000_000;
export const toPctUnits = (v: string | number) => Math.round(Number(v || 0) * 10_000);
export const fromPctUnits = (u: number) => (u / 10_000).toFixed(4).replace(/\.?0+$/, '');

/**
 * Valores a partir das percentagens, com soma EXACTAMENTE igual ao valor a pagar:
 * cada prestação leva a sua quota arredondada para baixo e os cêntimos que sobram
 * ficam na última prestação (mesma regra do backend).
 */
export function amountsFromPct(totalCents: number, pctUnits: number[]): number[] {
  if (!pctUnits.length) return [];
  const parts = pctUnits.map((u) => Math.floor((totalCents * u) / PCT_TOTAL));
  const used = parts.reduce((s, a) => s + a, 0);
  parts[parts.length - 1] += totalCents - used;
  return parts;
}

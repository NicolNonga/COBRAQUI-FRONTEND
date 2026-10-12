"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Bell, Copy, Eye, Handshake, Mail, Megaphone, MessageSquare, PhoneCall, Plus, Save, Trash2, TrendingUp } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input, SegmentedControl, Select, Textarea } from "@/components/ui/form";
import { Drawer } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useQuery } from "@/hooks/use-query";
import { ladderService, policyService } from "@/lib/api/services";
import Link from "next/link";
import { channelAllowed, checkLadder } from "@/lib/ladder-policy";
import { errorMessage } from "@/lib/api/http";
import type { CollectionPolicy, DebtorChannel, Ladder, LadderAction, LadderRecipients, LadderStep, Priority } from "@/types/models";
import { cn, formatMoney } from "@/lib/utils";

/** Variáveis da mensagem: nome em português e um exemplo do valor real que entra no lugar. */
const VAR_META: Record<string, { label: string; sample: string }> = {
  debtorName: { label: "Nome do devedor", sample: "João Manuel" },
  processId: { label: "Nº do processo", sample: "PRC-00012" },
  day: { label: "Dia da régua", sample: "3" },
  totalAmount: { label: "Valor em dívida", sample: "250 000,00 Kz" },
  invoicesCount: { label: "Nº de facturas", sample: "2" },
};
const renderSample = (t: string, day: number) =>
  t.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (m, v: string) => (v === "day" ? String(day) : VAR_META[v]?.sample ?? m));

export const ladderActionMeta: Record<LadderAction, { label: string; icon: typeof Bell; cls: string }> = {
  CONTACT_REMINDER: { label: "Lembrete de contacto", icon: PhoneCall, cls: "bg-brand-50 text-brand-600 dark:bg-brand-500/15" },
  NEGOTIATION_SUGGESTION: { label: "Sugerir negociação", icon: Handshake, cls: "bg-success-50 text-success-600 dark:bg-success-500/15" },
  ESCALATION: { label: "Escalar ao gestor", icon: TrendingUp, cls: "bg-danger-50 text-danger-600 dark:bg-danger-500/15" },
  CUSTOM_ALERT: { label: "Alerta personalizado", icon: Megaphone, cls: "bg-warning-50 text-warning-600 dark:bg-warning-500/15" },
};
/** Cores do anel e do ícone de cada tipo de passo na linha temporal */
const actionRing: Record<LadderAction, string> = {
  CONTACT_REMINDER: "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10",
  NEGOTIATION_SUGGESTION: "border-warning-200 bg-warning-50 text-warning-600 dark:border-warning-500/30 dark:bg-warning-500/10",
  CUSTOM_ALERT: "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10",
  ESCALATION: "border-danger-200 bg-danger-50 text-danger-600 dark:border-danger-500/30 dark:bg-danger-500/10",
};

/**
 * Régua em linha temporal: um círculo com o ícone de cada passo, ligados por uma linha,
 * e um cartão com o título, o que acontece e o dia (D+N) à direita.
 */
export function LadderTimeline({ steps, max, compact }: { steps: Pick<LadderStep, "dayOffset" | "actionType" | "recipients" | "title" | "fulfillmentDays" | "debtorChannel">[]; max?: number; compact?: boolean }) {
  const sorted = [...steps].sort((a, b) => a.dayOffset - b.dayOffset);
  const shown = max ? sorted.slice(0, max) : sorted;
  if (!sorted.length) return <p className="text-sm text-muted">Sem passos definidos.</p>;
  return (
    <ol className={compact ? "space-y-2" : "space-y-3"}>
      {shown.map((s, i) => {
        const m = ladderActionMeta[s.actionType];
        const last = i === shown.length - 1 && shown.length === sorted.length;
        const toDebtor = s.debtorChannel && s.debtorChannel !== "NONE" ? `${debtorChannelLabel[s.debtorChannel]} ao devedor + ` : "";
        const detail = `${toDebtor}${m.label.toLowerCase()} · ${recipientsLabel[s.recipients]}${s.fulfillmentDays != null ? ` · prazo ${s.fulfillmentDays} dia(s)` : ""}`;
        const Icons = s.debtorChannel === "EMAIL_SMS" ? [Mail] : [];
        const v = stepVisual(s);
        return (
          <li key={i} className="relative flex items-center gap-3 sm:gap-4">
            {!last && <span aria-hidden className={cn("absolute left-[19px] w-px bg-[var(--border)] sm:left-[23px]", compact ? "top-10 -bottom-2" : "top-12 -bottom-3")} />}
            <span className={cn("relative z-10 flex shrink-0 items-center justify-center rounded-full border", v.ring, compact ? "h-10 w-10" : "h-10 w-10 sm:h-12 sm:w-12")}>
              <v.icon className={compact ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={1.8} />
            </span>
            <div className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-subtle", compact ? "px-3.5 py-2.5" : "px-4 py-3.5 sm:px-5")}>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-semibold", compact ? "text-[13.5px]" : "text-[15px]")}>{s.title || <span className="text-muted">Sem título</span>}</p>
                <p className={cn("flex items-center gap-1.5 truncate text-muted", compact ? "text-xs" : "text-[13px]")}>
                  {Icons.map((I, k) => <I key={k} className="h-3.5 w-3.5 shrink-0 text-brand-600" />)}
                  <span className="truncate first-letter:uppercase">{detail}</span>
                </p>
              </div>
              <span className={cn("tabular shrink-0 rounded-lg border surface font-mono font-semibold", compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm")}>D+{s.dayOffset}</span>
            </div>
          </li>
        );
      })}
      {max && sorted.length > max && <li className="pl-14 text-xs text-muted">+ {sorted.length - max} passo(s)</li>}
    </ol>
  );
}

export const debtorChannelLabel: Record<DebtorChannel, string> = { NONE: "Não enviar", EMAIL: "Email", SMS: "SMS", EMAIL_SMS: "Email + SMS" };
const CHANNEL_RING = "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10";
/**
 * Ícone principal de um passo: se envia mensagem ao devedor, mostra o canal (💬 SMS, ✉ email);
 * caso contrário, o ícone do tipo de acção interna (chamada, negociação, escalar…).
 */
export function stepVisual(s: { actionType: LadderAction; debtorChannel?: DebtorChannel | null }): { icon: typeof Bell; ring: string } {
  if (s.debtorChannel === "SMS" || s.debtorChannel === "EMAIL_SMS") return { icon: MessageSquare, ring: CHANNEL_RING };
  if (s.debtorChannel === "EMAIL") return { icon: Mail, ring: CHANNEL_RING };
  return { icon: ladderActionMeta[s.actionType].icon, ring: actionRing[s.actionType] };
}
const channelIcons = (c?: DebtorChannel) => (c === "EMAIL" ? [Mail] : c === "SMS" ? [MessageSquare] : c === "EMAIL_SMS" ? [MessageSquare, Mail] : []);

export const recipientsLabel: Record<LadderRecipients, string> = { AGENT: "Agente responsável", MANAGER: "Gestor do agente", BOTH: "Agente e gestor" };
const priorityLabel: Record<Priority, string> = { low: "Baixa", medium: "Média", high: "Alta" };

const blankStep = (day: number): LadderStep => ({
  dayOffset: day, actionType: "CONTACT_REMINDER", recipients: "AGENT", priority: "medium", title: "",
  messageTemplate: "Contactar {{debtorName}} (processo {{processId}}, dia {{day}}). Em dívida: {{totalAmount}}.", fulfillmentDays: 2,
  debtorChannel: "NONE", debtorSubject: null, debtorMessageTemplate: null,
});
const DEFAULT_DEBTOR_SUBJECT = "Aviso de pagamento em atraso — {{processId}}";
const DEFAULT_DEBTOR_MESSAGE = "Caro(a) {{debtorName}}, consta em atraso o valor de {{totalAmount}} ({{invoicesCount}} factura(s)). Por favor regularize ou contacte-nos para acordar um plano de pagamento.";

/** Editor de régua: passos ordenados por dia, com variáveis de mensagem. */
export function LadderEditor({ ladder, onSaved }: { ladder?: Ladder | null; onSaved?: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { data: opts } = useQuery(() => ladderService.options().catch(() => ({ actions: [] as string[], recipients: [] as string[], variables: ["debtorName", "processId", "day", "totalAmount", "invoicesCount"], debtorMessagesMode: "log" as const })));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<LadderStep[]>([blankStep(0)]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const { data: policy, loading: policyLoading } = useQuery(() => policyService.get().catch(() => null));
  const [seeded, setSeeded] = useState(false);

  // nova régua: começa com os passos obrigatórios da régua master já colocados
  useEffect(() => {
    if (ladder || !policy || seeded) return;
    setSeeded(true);
    const first = policy.rules[0]?.actionType ?? "CONTACT_REMINDER";
    const base = policy.skeleton?.length
      ? policy.skeleton.map((k) => ({ ...blankStep(k.dayOffset), actionType: k.actionType, fulfillmentDays: k.fulfillmentDays ?? blankStep(0).fulfillmentDays }))
      : [{ ...blankStep(policy.rules.find((r) => r.actionType === first)?.minDay ?? 0), actionType: first }];
    setSteps(base);
  }, [policy, ladder, seeded]);

  useEffect(() => {
    if (ladder) { setName(ladder.name); setDescription(ladder.description ?? ""); setSteps(ladder.steps?.length ? ladder.steps.map((s) => ({ ...s })) : [blankStep(0)]); }
  }, [ladder]);

  const set = (i: number, patch: Partial<LadderStep>) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => { const a = [...steps]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); setSteps(a); };
  const dupDays = new Set(steps.map((s) => s.dayOffset).filter((d, i, a) => a.indexOf(d) !== i));
  const violations = policy ? checkLadder(policy, steps) : [];
  const valid = !!policy && violations.length === 0 && name.trim() && steps.length > 0 && steps.every((s) => s.title.trim() && s.messageTemplate.trim() && s.dayOffset >= 0
    && (!s.debtorChannel || s.debtorChannel === "NONE" || !!s.debtorMessageTemplate?.trim()));

  async function save() {
    if (!valid) return;
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || undefined, steps: [...steps].sort((a, b) => a.dayOffset - b.dayOffset).map(({ id: _id, ...s }) => ({
      ...s, fulfillmentDays: s.fulfillmentDays ?? null, debtorChannel: s.debtorChannel ?? "NONE",
      debtorSubject: s.debtorChannel && s.debtorChannel !== "NONE" ? s.debtorSubject || null : null,
      debtorMessageTemplate: s.debtorChannel && s.debtorChannel !== "NONE" ? s.debtorMessageTemplate || null : null,
    })) };
    try {
      if (ladder) {
        const r = await ladderService.update(ladder.id, { ...payload, expectedVersion: ladder.version });
        toast("success", r.message); onSaved?.();
      } else {
        const r = await ladderService.create(payload);
        toast("success", "Régua criada", "Reveja a pré-visualização e active-a quando estiver pronta.");
        router.push(`/ladders/${r.id}`);
      }
    } catch (e) { toast("error", "Não foi possível guardar a régua", errorMessage(e)); } finally { setSaving(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome da régua" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Régua padrão PME" /></Field>
            <Field label="Descrição"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quando usar esta régua" /></Field>
          </div>
        </Card>

        <ol className="relative space-y-3 before:absolute before:top-6 before:bottom-6 before:left-[27px] before:w-px before:bg-[var(--border)]">
          {steps.map((s, i) => {
            const m = ladderActionMeta[s.actionType];
            return (
              <li key={i} className="relative flex gap-4">
                <span className={cn("relative z-10 mt-4 flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border ring-4 ring-[var(--bg)]", stepVisual(s).ring)}>
                  {(() => { const V = stepVisual(s).icon; return <V className="mb-0.5 h-3.5 w-3.5" />; })()}
                  <span className="tabular text-sm leading-none font-bold">D+{s.dayOffset}</span>
                </span>
                <Card className="flex-1">
                  <div className="grid gap-3 sm:grid-cols-[110px_1fr_1fr]">
                    <Field label="Dia" error={dupDays.has(s.dayOffset) ? "Dia repetido" : undefined} hint={(() => { const r = policy?.rules.find((x) => x.actionType === s.actionType); return r ? `Entre D+${r.minDay} e D+${r.maxDay}` : undefined; })()}><Input type="number" min={0} value={s.dayOffset} onChange={(e) => set(i, { dayOffset: Math.max(0, Number(e.target.value) || 0) })} /></Field>
                    <Field label="Acção"><Select value={s.actionType} onChange={(e) => set(i, { actionType: e.target.value as LadderAction })}>{(Object.keys(ladderActionMeta) as LadderAction[]).filter((a) => !policy || a === s.actionType || policy.rules.some((r) => r.actionType === a)).map((a) => <option key={a} value={a}>{ladderActionMeta[a].label}</option>)}</Select></Field>
                    <Field label="Destinatário"><Select value={s.recipients} onChange={(e) => set(i, { recipients: e.target.value as LadderRecipients })}>{(Object.keys(recipientsLabel) as LadderRecipients[]).map((r) => <option key={r} value={r}>{recipientsLabel[r]}</option>)}</Select></Field>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_160px]">
                    <Field label="Título" required><Input value={s.title} onChange={(e) => set(i, { title: e.target.value })} placeholder="Ex: Primeiro contacto" /></Field>
                    <Field label="Prioridade"><Select value={s.priority} onChange={(e) => set(i, { priority: e.target.value as Priority })}>{(Object.keys(priorityLabel) as Priority[]).map((p) => <option key={p} value={p}>{priorityLabel[p]}</option>)}</Select></Field>
                    <Field label="Prazo p/ cumprir" hint={(() => { const m = policy?.rules.find((x) => x.actionType === s.actionType)?.maxFulfillmentDays; return m != null ? `Obrigatório, máx. ${m} dias` : "Vazio = só informativo"; })()}><Input type="number" min={0} value={s.fulfillmentDays ?? ""} trailing="dias" onChange={(e) => set(i, { fulfillmentDays: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} /></Field>
                  </div>
                  <Field label="Alerta interno (para o agente/gestor)" className="mt-3" hint="O que está entre {{ }} é preenchido automaticamente com os dados de cada processo quando a régua corre.">
                    <Textarea rows={2} className="min-h-[64px] font-mono text-[13px]" value={s.messageTemplate} onChange={(e) => set(i, { messageTemplate: e.target.value })} />
                  </Field>
                  {s.messageTemplate && (
                    <p className="mt-2 rounded-lg bg-subtle px-3 py-2 text-[13px]"><span className="text-xs text-muted">Exemplo de como fica: </span>{renderSample(s.messageTemplate, s.dayOffset)}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted">Inserir:</span>
                    {(opts?.variables ?? []).map((v) => (
                      <button key={v} type="button" title={`Insere {{${v}}}`} onClick={() => set(i, { messageTemplate: `${s.messageTemplate}{{${v}}}` })}
                        className="rounded-md bg-soft px-2 py-0.5 text-[11px] font-medium text-muted hover:text-[var(--text)]">+ {VAR_META[v]?.label ?? v}</button>
                    ))}
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="icon-sm" title="Subir" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm" title="Descer" disabled={i === steps.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm" title="Duplicar" onClick={() => setSteps([...steps.slice(0, i + 1), { ...s, id: undefined, dayOffset: s.dayOffset + 1 }, ...steps.slice(i + 1)])}><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm" title="Remover" disabled={steps.length === 1} onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <DebtorMessageFields step={s} variables={opts?.variables ?? []} policy={policy ?? null} testMode={(opts?.debtorMessagesMode ?? "log") !== "send"} onChange={(patch) => set(i, patch)} />
                  {violations.filter((v) => v.dayOffset === s.dayOffset).map((v) => (
                    <p key={v.code + v.message} className="mt-2 flex items-start gap-1.5 text-xs text-danger-600"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{v.message.replace(/^Dia \d+: /, "")}</p>
                  ))}
                </Card>
              </li>
            );
          })}
        </ol>
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setSteps([...steps, blankStep((steps[steps.length - 1]?.dayOffset ?? 0) + 7)])}>Adicionar passo</Button>
      </div>

      <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardHeader title={name.trim() || "Nova régua"} description="Como a régua vai ficar" />
          <div className="mt-4"><LadderTimeline steps={steps} compact /></div>
        </Card>
        <MasterPanel policy={policy ?? null} loading={policyLoading} violations={violations} />
        <Card>
          <CardHeader title="Como funciona" />
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>• O <b>dia</b> conta-se desde a entrada do processo em cobrança (0 = dia de entrada).</li>
            <li>• Cada passo gera um alerta para o destinatário, com a mensagem preenchida.</li>
            <li>• Com <b>prazo</b>, o agente tem de registar um contacto no processo dentro desse prazo; caso contrário fica em atraso e o gestor é avisado.</li>
            <li>• A régua nasce <b>inactiva</b>: reveja a pré-visualização e active-a.</li>
          </ul>
        </Card>
        <Button size="lg" className="w-full" icon={<Save className="h-4 w-4" />} disabled={!valid} loading={saving} onClick={save}>{ladder ? "Guardar nova versão" : "Criar régua"}</Button>
        {ladder && <Button variant="secondary" className="w-full" icon={<Eye className="h-4 w-4" />} onClick={() => setPreview(true)}>Pré-visualizar (versão guardada)</Button>}
      </div>
      {ladder && <LadderPreviewDrawer ladderId={preview ? ladder.id : null} onClose={() => setPreview(false)} />}
    </div>
  );
}

export function LadderPreviewDrawer({ ladderId, onClose }: { ladderId: number | null; onClose: () => void }) {
  const { data, loading, error } = useQuery(() => (ladderId ? ladderService.preview(ladderId) : Promise.resolve(null)), [ladderId]);
  return (
    <Drawer open={!!ladderId} onClose={onClose} width="max-w-3xl" title="Pré-visualização" description="Alertas que a régua geraria hoje para os seus processos abertos.">
      {loading && !data ? <p className="text-sm text-muted">A calcular…</p> : error ? <p className="text-sm text-danger-600">{error}</p> : !data?.length ? (
        <>
          <EmptyState icon={<Eye />} title="Nenhum alerta hoje" description="Hoje nenhum processo está num dia em que esta régua tenha uma etapa. Veja abaixo em que dia está cada processo e quando dispara a próxima." />
          <LadderCoverage ladderId={ladderId!} />
        </>
      ) : (
        <ul className="space-y-2">
          {data.map((r) => {
            const v = stepVisual(r);
            return (
              <li key={`${r.processId}-${r.stepId}`} className="flex gap-3 rounded-xl border p-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border", v.ring)}><v.icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{r.title}</p>
                    <Badge>Dia {r.day}</Badge>
                    {r.alreadyExecuted && <Badge tone="success">já enviado</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{r.debtorName} · PRC-{String(r.processId).padStart(5, "0")} · {formatMoney(r.totalAmount)} · {recipientsLabel[r.recipients]}</p>
                  <p className="mt-1.5 rounded-lg bg-subtle p-2 text-[13px]"><span className="text-xs text-muted">Alerta interno: </span>{r.message}</p>
                  {r.debtorMessage && (
                    <div className="mt-1.5 rounded-lg border border-brand-200 bg-brand-50/60 p-2 text-[13px] dark:border-brand-500/30 dark:bg-brand-500/10">
                      <p className="mb-0.5 flex items-center gap-1.5 text-xs text-muted">
                        {channelIcons(r.debtorChannel).map((I, k) => <I key={k} className="h-3.5 w-3.5 text-brand-600" />)}
                        Ao devedor ({r.debtorChannel ? debtorChannelLabel[r.debtorChannel] : ""}
                        {r.debtorEmail && (r.debtorChannel === "EMAIL" || r.debtorChannel === "EMAIL_SMS") ? ` · ${r.debtorEmail}` : ""}
                        {r.debtorPhone && (r.debtorChannel === "SMS" || r.debtorChannel === "EMAIL_SMS") ? ` · ${r.debtorPhone}` : ""})
                      </p>
                      {r.debtorSubject && <p className="font-medium">{r.debtorSubject}</p>}
                      <p>{r.debtorMessage}</p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}

/** Explica a pré-visualização vazia: processos do dono da régua, o dia de cada um e a próxima etapa. */
function LadderCoverage({ ladderId }: { ladderId: number }) {
  const { data, loading } = useQuery(() => ladderService.coverage(ladderId).catch(() => null), [ladderId]);
  if (loading && !data) return <p className="mt-2 text-sm text-muted">A analisar os processos…</p>;
  if (!data) return null;
  if (!data.processes.length)
    return (
      <div className="mt-2 rounded-xl border border-dashed px-4 py-5 text-sm text-muted">
        <b className="text-[var(--text)]">Não há processos abertos atribuídos ao dono desta régua.</b> A régua só actua nos processos atribuídos a quem a criou.
        Atribua um processo a esse utilizador em <b>Processos → Atribuir</b>.
      </div>
    );
  return (
    <div className="mt-2 overflow-hidden rounded-xl border">
      <div className="border-b bg-subtle px-4 py-2 text-xs font-medium text-muted">Os seus processos abertos ({data.processes.length})</div>
      <ul className="divide-y text-sm">
        {data.processes.map((p) => {
          const daysToNext = p.nextStepDay != null ? p.nextStepDay - p.day : null;
          return (
            <li key={p.processId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="font-mono text-xs">PRC-{String(p.processId).padStart(5, "0")}</span>
              <span className="min-w-0 flex-1 truncate">{p.debtorName}</span>
              <Badge>Dia {p.day}</Badge>
              {p.hasActiveNegotiation && <Badge tone="info">Com acordo activo</Badge>}
              <span className="w-full text-xs text-muted sm:w-auto">
                {p.nextStepDay != null
                  ? `Próxima etapa: dia ${p.nextStepDay}${p.nextStepTitle ? ` (${p.nextStepTitle})` : ""} — daqui a ${daysToNext} dia(s)`
                  : p.lastStepDay != null
                    ? `Já passou a última etapa (dia ${p.lastStepDay}). Acrescente uma etapa no dia ${p.day} ou depois para voltar a actuar.`
                    : "A régua não tem etapas."}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t px-4 py-2 text-[11px] text-muted">O dia conta desde a entrada do processo em cobrança. Uma etapa dispara no seu dia (e até {data.catchUpDays} dia(s) depois, se a régua não tiver corrido).</p>
    </div>
  );
}

/** Secção "Mensagem ao devedor" de um passo: canal, assunto (email) e texto com variáveis. */
function DebtorMessageFields({ step: s, variables, testMode, policy, onChange }: { step: LadderStep; variables: string[]; testMode: boolean; policy: CollectionPolicy | null; onChange: (p: Partial<LadderStep>) => void }) {
  const channel = s.debtorChannel ?? "NONE";
  const email = channel === "EMAIL" || channel === "EMAIL_SMS";
  const setChannel = (c: DebtorChannel) => onChange({
    debtorChannel: c,
    ...(c !== "NONE" && !s.debtorMessageTemplate ? { debtorMessageTemplate: DEFAULT_DEBTOR_MESSAGE } : {}),
    ...((c === "EMAIL" || c === "EMAIL_SMS") && !s.debtorSubject ? { debtorSubject: DEFAULT_DEBTOR_SUBJECT } : {}),
  });
  return (
    <div className="mt-4 rounded-xl border border-dashed p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Mensagem ao devedor</p>
          <p className="text-xs text-muted">Enviada ao devedor neste dia, para o email/telefone da ficha dele.</p>
        </div>
        <SegmentedControl value={channel} onChange={setChannel} options={(["NONE", "EMAIL", "SMS", "EMAIL_SMS"] as DebtorChannel[]).filter((c) => !policy || c === channel || channelAllowed(policy.allowedDebtorChannels, c)).map((c) => ({ value: c, label: debtorChannelLabel[c] }))} />
      </div>
      {channel !== "NONE" && (
        <div className="mt-3 space-y-3">
          {testMode && (
            <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">
              Modo de teste: nada é enviado ao devedor. As mensagens ficam registadas nos logs do sistema e na Fila de envios.
            </p>
          )}
          {!testMode && (channel === "SMS" || channel === "EMAIL_SMS") && (
            <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">O SMS ainda não tem fornecedor configurado: fica registado nos logs do sistema.</p>
          )}
          {email && (
            <Field label="Assunto do email"><Input value={s.debtorSubject ?? ""} maxLength={150} onChange={(e) => onChange({ debtorSubject: e.target.value })} /></Field>
          )}
          <Field label={channel === "SMS" ? "Texto do SMS" : "Texto da mensagem"} required>
            <Textarea rows={3} className="min-h-[72px] text-[13px]" value={s.debtorMessageTemplate ?? ""} onChange={(e) => onChange({ debtorMessageTemplate: e.target.value })} />
          </Field>
          {channel !== "EMAIL" && (s.debtorMessageTemplate?.length ?? 0) > 160 && (
            <p className="text-xs text-warning-700">O texto tem {s.debtorMessageTemplate?.length} caracteres: num SMS pode ser dividido em várias mensagens.</p>
          )}
          {s.debtorMessageTemplate && (
            <p className="rounded-lg bg-subtle px-3 py-2 text-[13px]"><span className="text-xs text-muted">Exemplo: </span>{renderSample(s.debtorMessageTemplate, s.dayOffset)}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Inserir:</span>
            {variables.map((v) => (
              <button key={v} type="button" title={`Insere {{${v}}}`} onClick={() => onChange({ debtorMessageTemplate: `${s.debtorMessageTemplate ?? ""}{{${v}}}` })}
                className="rounded-md bg-soft px-2 py-0.5 text-[11px] font-medium text-muted hover:text-[var(--text)]">+ {VAR_META[v]?.label ?? v}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Resumo da régua master ao lado do editor: o que é permitido e o que a régua actual ainda infringe. */
function MasterPanel({ policy, loading, violations }: { policy: CollectionPolicy | null; loading: boolean; violations: { code: string; message: string }[] }) {
  if (loading && !policy) return <Card><p className="text-sm text-muted">A carregar a régua master…</p></Card>;
  if (!policy) return (
    <Card className="border-danger-200">
      <p className="text-sm text-danger-700">A régua master ainda não foi definida. Peça ao administrador para a configurar antes de criar réguas.</p>
    </Card>
  );
  const ok = violations.length === 0;
  return (
    <Card className={ok ? "border-success-200 dark:border-success-500/30" : "border-danger-200 dark:border-danger-500/30"}>
      <CardHeader title="Régua master" description={ok ? "Esta régua cumpre os limites." : `${violations.length} ${violations.length === 1 ? "problema a corrigir" : "problemas a corrigir"}`}
        action={<Link href="/ladders/policy" className="text-xs text-brand-600 hover:underline">Ver limites</Link>} />
      {!ok && (
        <ul className="mt-3 space-y-1.5 text-[13px] text-danger-700 dark:text-danger-300">
          {violations.map((v) => <li key={v.code + v.message} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{v.message}</li>)}
        </ul>
      )}
      <ul className="mt-3 space-y-1 text-xs text-muted">
        <li>• Máximo {policy.maxSteps} passos, até ao dia {policy.maxCollectionDays}.</li>
        <li>• Mensagens ao devedor: {policy.allowedDebtorChannels.length ? policy.allowedDebtorChannels.map((c) => (c === "EMAIL" ? "email" : "SMS")).join(" e ") : "não permitidas"}{policy.minDaysBetweenDebtorMessages ? `, a cada ${policy.minDaysBetweenDebtorMessages}+ dias` : ""}.</li>
        {policy.maxContactsPerProcess != null && <li>• Máx. {policy.maxContactsPerProcess} contactos por processo.</li>}
      </ul>
    </Card>
  );
}

/** Aviso nas listas/detalhe quando a régua deixou de cumprir a master (está suspensa). */
export function PolicyNotice({ ladder }: { ladder: Pick<Ladder, "policyCompliant" | "policyViolations"> }) {
  if (ladder.policyCompliant !== false) return null;
  return (
    <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300">
      <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> Régua suspensa: não cumpre a régua master</p>
      <ul className="mt-1.5 space-y-0.5 text-[13px]">{(ladder.policyViolations ?? []).slice(0, 5).map((v) => <li key={v.message}>• {v.message}</li>)}</ul>
      <p className="mt-1.5 text-xs">Edite a régua para a corrigir e volte a activá-la.</p>
    </div>
  );
}

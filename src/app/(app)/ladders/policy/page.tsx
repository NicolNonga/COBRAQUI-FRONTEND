"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, Save, ShieldCheck } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader, Skeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Switch } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { useAuth } from "@/components/shared/auth-provider";
import { ErrorBanner } from "@/components/shared/process-list";
import { useQuery } from "@/hooks/use-query";
import { policyService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import { P } from "@/lib/permissions";
import { actionLabelPt } from "@/lib/ladder-policy";
import type { CollectionPolicy, LadderAction, PolicyRule } from "@/types/models";
import { formatDate } from "@/lib/utils";

const ACTIONS: LadderAction[] = ["CONTACT_REMINDER", "NEGOTIATION_SUGGESTION", "ESCALATION", "CUSTOM_ALERT"];
const num = (v: string): number | null => (v === "" ? null : Math.max(0, Math.floor(Number(v) || 0)));

export default function PolicyPage() {
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const editable = can(P.POLICY_MANAGE);
  const { data, error, reload } = useQuery(() => policyService.get());
  const [f, setF] = useState<CollectionPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data) setF({ ...data, rules: data.rules.map((r) => ({ ...r })), allowedDebtorChannels: [...data.allowedDebtorChannels] }); }, [data]);

  if (error) return <><ErrorBanner message={error} onRetry={reload} /></>;
  if (!f || !data) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>;

  const set = (p: Partial<CollectionPolicy>) => setF({ ...f, ...p });
  const rule = (a: LadderAction) => f.rules.find((r) => r.actionType === a);
  const setRule = (a: LadderAction, patch: Partial<PolicyRule> | null) => {
    const rest = f.rules.filter((r) => r.actionType !== a);
    if (patch === null) return set({ rules: rest });
    const cur = rule(a) ?? { actionType: a, minDay: 0, maxDay: Math.min(f.maxCollectionDays, 30), maxFulfillmentDays: null, required: false };
    set({ rules: [...rest, { ...cur, ...patch }].sort((x, y) => ACTIONS.indexOf(x.actionType) - ACTIONS.indexOf(y.actionType)) });
  };
  const toggleChannel = (c: "EMAIL" | "SMS", on: boolean) => set({ allowedDebtorChannels: on ? [...new Set([...f.allowedDebtorChannels, c])] : f.allowedDebtorChannels.filter((x) => x !== c) });

  const problems: string[] = [];
  if (!f.name.trim()) problems.push("Dê um nome à régua master.");
  if (!f.rules.length) problems.push("Permita pelo menos um tipo de passo.");
  for (const r of f.rules) {
    if (r.minDay > r.maxDay) problems.push(`${actionLabelPt[r.actionType]}: o dia mínimo é maior que o máximo.`);
    if (r.maxDay > f.maxCollectionDays) problems.push(`${actionLabelPt[r.actionType]}: o dia máximo passa a duração máxima da cobrança (${f.maxCollectionDays}).`);
  }

  async function save() {
    if (!f || problems.length) return;
    try {
      const ok = await confirm({
        title: "Guardar a régua master?", tone: "primary", confirmLabel: "Guardar e aplicar",
        description: "As alterações aplicam-se a todas as réguas. As que deixarem de cumprir os novos limites são suspensas até serem corrigidas, e os donos e gestores são avisados.",
        onConfirm: async () => {
          const { updatedAt: _u, skeleton: _s, version, ...payload } = f;
          const r = await policyService.update({ ...payload, description: payload.description?.trim() || null, expectedVersion: version });
          toast(r.suspended ? "info" : "success", r.message, `${r.revalidated} régua(s) verificadas${r.restored ? ` · ${r.restored} reposta(s)` : ""}.`);
        },
      });
      if (ok) reload();
    } catch (e) { toast("error", "Não foi possível guardar", errorMessage(e)); } finally { setSaving(false); }
  }

  return (
    <>
      <Link href="/ladders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--text)]"><ArrowLeft className="h-4 w-4" /> Régua de cobrança</Link>
      <PageHeader
        title={<span className="flex items-center gap-3">Régua master <Badge>v{data.version}</Badge></span>}
        description="Os limites que todas as réguas dos gestores e técnicos têm de cumprir. Nenhuma régua é aceite fora destes limites."
        actions={editable ? <Button icon={<Save className="h-4 w-4" />} loading={saving} disabled={!!problems.length} onClick={save}>Guardar régua master</Button>
          : <Badge tone="warning"><Lock className="mr-1 inline h-3 w-3" />Só leitura</Badge>} />

      {!editable && <p className="mb-4 rounded-xl bg-subtle px-4 py-3 text-sm text-muted">Só quem tem a permissão <b>Definir a régua master</b> pode alterar estes limites. Estes são os que as suas réguas têm de respeitar.</p>}
      {problems.length > 0 && editable && (
        <ul className="mb-4 space-y-1 rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300">
          {problems.map((p) => <li key={p}>• {p}</li>)}
        </ul>
      )}

      <fieldset disabled={!editable} className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Prazos e limites gerais" description="Valem para todas as réguas e processos." />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Nome"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
              <Field label="Descrição"><Input value={f.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="Opcional" /></Field>
              <Field label="Tolerância após o vencimento" hint="A factura só entra em cobrança N dias depois de vencer. 0 = no dia seguinte.">
                <Input type="number" min={0} value={f.graceDays} trailing="dias" onChange={(e) => set({ graceDays: num(e.target.value) ?? 0 })} />
              </Field>
              <Field label="Duração máxima da cobrança" hint="Nenhum passo pode ir além deste dia. Passado este prazo o gestor é avisado para decidir o encaminhamento.">
                <Input type="number" min={1} value={f.maxCollectionDays} trailing="dias" onChange={(e) => set({ maxCollectionDays: Math.max(1, num(e.target.value) ?? 1) })} />
              </Field>
              <Field label="Máximo de passos por régua"><Input type="number" min={1} max={50} value={f.maxSteps} onChange={(e) => set({ maxSteps: Math.min(50, Math.max(1, num(e.target.value) ?? 1)) })} /></Field>
              <Field label="Máximo de contactos por processo" hint="Vazio = sem limite. Depois do limite, o sistema recusa novos registos de contacto.">
                <Input type="number" min={1} value={f.maxContactsPerProcess ?? ""} placeholder="Sem limite" onChange={(e) => set({ maxContactsPerProcess: num(e.target.value) })} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Tipos de passo permitidos"
              description="Define, para cada tipo de passo, se as réguas o podem usar e em que dias. Um tipo desligado não pode ser usado em nenhuma régua." />
            <p className="mt-3 rounded-xl bg-subtle p-3 text-[13px] text-muted">
              <b className="text-[var(--text)]">O que é o &quot;dia&quot;:</b> é o dia da régua (<b className="text-[var(--text)]">D+0</b> = início da cobrança, ou seja {f.graceDays} dia(s) após o vencimento da factura),
              não uma data do calendário. A janela <b className="text-[var(--text)]">D+mínimo a D+máximo</b> diz em que altura da cobrança esse tipo de passo pode ser agendado.
              O <b className="text-[var(--text)]">prazo para cumprir</b> é o tempo que o agente tem, depois do passo disparar, para registar o contacto — se definir um valor aqui, cada passo desse tipo
              é obrigado a ter prazo e não pode passar deste máximo. <b className="text-[var(--text)]">Obrigatório</b> significa que nenhuma régua pode ser gravada sem um passo deste tipo dentro da janela.
            </p>
            <div className="mt-4 divide-y">
              {ACTIONS.map((a) => {
                const r = rule(a);
                return (
                  <div key={a} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <Switch checked={!!r} onChange={(on) => setRule(a, on ? {} : null)} label={actionLabelPt[a]} />
                      <p className="font-medium">{actionLabelPt[a]}</p>
                      {!r && <span className="text-xs text-muted">não permitido em nenhuma régua</span>}
                      {r?.required && <Badge tone="brand">obrigatório em todas as réguas</Badge>}
                    </div>
                    {r && (
                      <>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr_auto] sm:items-end">
                          <Field label="A partir do dia" hint="D+ mínimo"><Input type="number" min={0} value={r.minDay} onChange={(e) => setRule(a, { minDay: num(e.target.value) ?? 0 })} /></Field>
                          <Field label="Até ao dia" hint="D+ máximo"><Input type="number" min={0} value={r.maxDay} onChange={(e) => setRule(a, { maxDay: num(e.target.value) ?? 0 })} /></Field>
                          <Field label="Prazo para registar o contacto" hint="Vazio = o passo pode não ter prazo">
                            <Input type="number" min={0} value={r.maxFulfillmentDays ?? ""} trailing="dias" placeholder="Sem exigência" onChange={(e) => setRule(a, { maxFulfillmentDays: num(e.target.value) })} />
                          </Field>
                          <Checkbox checked={r.required} onChange={(v) => setRule(a, { required: v })} label="Obrigatório" className="pb-2" />
                        </div>
                        {/* leitura em português do que estes três números querem dizer */}
                        <p className="mt-2 text-[13px] text-muted">
                          Um passo <b className="text-[var(--text)]">{actionLabelPt[a].toLowerCase()}</b> pode ser agendado {r.minDay === r.maxDay
                            ? <>apenas no <b className="text-[var(--text)]">dia D+{r.minDay}</b></>
                            : <>entre o <b className="text-[var(--text)]">dia D+{r.minDay}</b> e o <b className="text-[var(--text)]">dia D+{r.maxDay}</b></>} da cobrança
                          {r.maxFulfillmentDays != null
                            ? <>, e o agente tem de registar o contacto em <b className="text-[var(--text)]">{r.maxFulfillmentDays} dia(s)</b> após o passo disparar.</>
                            : <>, sem prazo obrigatório para registar o contacto.</>}
                          {r.required && <> Toda a régua tem de incluir um passo deste tipo nesta janela.</>}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="Mensagens ao devedor" description="Que canais as réguas podem usar e com que frequência." />
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <Checkbox checked={f.allowedDebtorChannels.includes("EMAIL")} onChange={(v) => toggleChannel("EMAIL", v)} label="Email" />
              <Checkbox checked={f.allowedDebtorChannels.includes("SMS")} onChange={(v) => toggleChannel("SMS", v)} label="SMS" />
              <Field label="Intervalo mínimo entre mensagens" className="w-64">
                <Input type="number" min={0} value={f.minDaysBetweenDebtorMessages} trailing="dias" onChange={(e) => set({ minDaysBetweenDebtorMessages: num(e.target.value) ?? 0 })} />
              </Field>
            </div>
            <p className="mt-3 text-xs text-muted">Sem nenhum canal marcado, as réguas não podem enviar mensagens ao devedor (só alertas internos).</p>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader title="Em resumo" />
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>• A cobrança começa <b className="text-[var(--text)]">{f.graceDays}</b> dia(s) após o vencimento.</li>
              <li>• Dura no máximo <b className="text-[var(--text)]">{f.maxCollectionDays}</b> dias.</li>
              <li>• Até <b className="text-[var(--text)]">{f.maxSteps}</b> passos por régua e <b className="text-[var(--text)]">{f.maxContactsPerProcess ?? "∞"}</b> contactos por processo.</li>
              <li>• Mensagens ao devedor: <b className="text-[var(--text)]">{f.allowedDebtorChannels.length ? f.allowedDebtorChannels.map((c) => (c === "EMAIL" ? "email" : "SMS")).join(" e ") : "nenhuma"}</b>{f.minDaysBetweenDebtorMessages ? `, com ${f.minDaysBetweenDebtorMessages} dias de intervalo` : ""}.</li>
              <li>• Obrigatórios: <b className="text-[var(--text)]">{f.rules.filter((r) => r.required).map((r) => actionLabelPt[r.actionType]).join(", ") || "nenhum"}</b>.</li>
            </ul>
            <p className="mt-4 text-[11px] text-muted">Última alteração: {formatDate(data.updatedAt)}</p>
          </Card>
          <Card>
            <p className="flex items-start gap-2 text-sm text-muted"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              Ao guardar, todas as réguas são verificadas. As que não cumprirem ficam suspensas e os donos e gestores são avisados; as que voltarem a cumprir são repostas.</p>
          </Card>
        </div>
      </fieldset>
    </>
  );
}

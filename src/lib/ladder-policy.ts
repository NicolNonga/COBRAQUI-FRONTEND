import type { CollectionPolicy, LadderAction, PolicyViolation } from "@/types/models";

/** Espelho (no browser) das regras do backend: mostra os problemas em tempo real; o servidor volta a validar. */
export const actionLabelPt: Record<LadderAction, string> = {
  CONTACT_REMINDER: "Lembrete de contacto",
  NEGOTIATION_SUGGESTION: "Sugerir negociação",
  ESCALATION: "Escalar ao gestor",
  CUSTOM_ALERT: "Alerta personalizado",
};

export interface StepLike { dayOffset: number; actionType: string; fulfillmentDays?: number | null; debtorChannel?: string | null }

export const channelAllowed = (allowed: readonly string[], channel?: string | null) => {
  if (!channel || channel === "NONE") return true;
  if (channel === "EMAIL_SMS") return allowed.includes("EMAIL") && allowed.includes("SMS");
  return allowed.includes(channel);
};

export function checkLadder(policy: CollectionPolicy, steps: StepLike[]): PolicyViolation[] {
  const out: PolicyViolation[] = [];
  if (steps.length > policy.maxSteps) out.push({ code: "TOO_MANY_STEPS", message: `A régua tem ${steps.length} passos; a régua master permite no máximo ${policy.maxSteps}.` });
  const rules = new Map(policy.rules.map((r) => [r.actionType as string, r]));
  const sorted = [...steps].sort((a, b) => a.dayOffset - b.dayOffset);
  const label = (a: string) => actionLabelPt[a as LadderAction] ?? a;
  for (const s of sorted) {
    const d = s.dayOffset;
    if (d > policy.maxCollectionDays) out.push({ code: "DAY_AFTER_LIMIT", dayOffset: d, message: `Dia ${d}: passa a duração máxima da cobrança (${policy.maxCollectionDays} dias).` });
    const rule = rules.get(s.actionType);
    if (!rule) out.push({ code: "ACTION_NOT_ALLOWED", dayOffset: d, message: `Dia ${d}: o tipo "${label(s.actionType)}" não é permitido pela régua master.` });
    else {
      if (d < rule.minDay || d > rule.maxDay) out.push({ code: "DAY_OUT_OF_WINDOW", dayOffset: d, message: `Dia ${d}: "${label(s.actionType)}" só pode ocorrer entre o dia ${rule.minDay} e o dia ${rule.maxDay}.` });
      if (rule.maxFulfillmentDays != null) {
        if (s.fulfillmentDays == null) out.push({ code: "FULFILLMENT_REQUIRED", dayOffset: d, message: `Dia ${d}: defina o prazo de cumprimento (máximo ${rule.maxFulfillmentDays} dias).` });
        else if (s.fulfillmentDays > rule.maxFulfillmentDays) out.push({ code: "FULFILLMENT_TOO_LONG", dayOffset: d, message: `Dia ${d}: prazo de ${s.fulfillmentDays} dias; o máximo é ${rule.maxFulfillmentDays}.` });
      }
    }
    if (!channelAllowed(policy.allowedDebtorChannels, s.debtorChannel)) out.push({ code: "CHANNEL_NOT_ALLOWED", dayOffset: d, message: `Dia ${d}: o canal escolhido para o devedor não é permitido pela régua master.` });
  }
  if (policy.minDaysBetweenDebtorMessages > 0) {
    const msgs = sorted.filter((s) => s.debtorChannel && s.debtorChannel !== "NONE");
    for (let i = 1; i < msgs.length; i++) {
      const gap = msgs[i].dayOffset - msgs[i - 1].dayOffset;
      if (gap < policy.minDaysBetweenDebtorMessages) out.push({ code: "MESSAGES_TOO_CLOSE", dayOffset: msgs[i].dayOffset, message: `Dia ${msgs[i].dayOffset}: só ${gap} dia(s) após a mensagem do dia ${msgs[i - 1].dayOffset}; intervalo mínimo ao devedor: ${policy.minDaysBetweenDebtorMessages} dias.` });
    }
  }
  for (const r of policy.rules.filter((x) => x.required)) {
    if (!sorted.some((s) => s.actionType === r.actionType && s.dayOffset >= r.minDay && s.dayOffset <= r.maxDay))
      out.push({ code: "REQUIRED_STEP_MISSING", message: `Falta um passo "${label(r.actionType)}" entre o dia ${r.minDay} e o dia ${r.maxDay} (obrigatório).` });
  }
  return out;
}

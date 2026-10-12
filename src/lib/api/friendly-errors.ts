// Traduz erros da API para mensagens claras para o utilizador.
// O detalhe técnico (código, estado HTTP, requestId) fica na consola e no ApiError, nunca no ecrã.

const TECHNICAL = /\b(must|should|property|cannot|undefined|null|NaN|exception|error:|constraint|sql|query|syntax|econn|enotfound|fetch|json|unexpected token|stack|typeorm|postgres|relation|column|violates|\w+Id\b|is not allowed|each value)\b|[a-z]+[A-Z][a-zA-Z]+\s*[=:]|→|=>|\{|\}|\[|\]/i;

export const looksTechnical = (msg: string) => !msg || msg.length > 220 || TECHNICAL.test(msg);

/** Mensagens conhecidas do backend que, embora em português, são pouco claras. */
const REWRITES: [RegExp, string][] = [
  [/Transição inválida/i, "Esta acção já não é possível no estado actual do registo. Actualize a página para ver o estado mais recente."],
  [/isParcelaIgual/i, "O tipo de prestações não corresponde aos valores: escolha \"Prestações iguais\" se forem todas iguais, ou altere algum valor."],
  [/alterad[oa] em simultâneo|versão/i, "Este registo foi alterado por outra pessoa entretanto. Actualize a página e repita a operação."],
  [/Registo duplicado/i, "Já existe um registo com estes dados."],
  [/Referência inexistente/i, "Um dos dados escolhidos já não existe. Actualize a página e tente novamente."],
  [/viola uma regra de integridade/i, "Algum valor indicado não é permitido. Reveja os dados e tente novamente."],
  [/Idempotency|Idempotent/i, "Este pedido já foi enviado. Aguarde um momento antes de repetir."],
  [/Credenciais inválidas|invalid credentials/i, "Email ou palavra-passe incorrectos. Verifique os dados e tente novamente."],
  [/token.*(expirado|inválido)|jwt/i, "A sua sessão expirou. Inicie sessão novamente."],
];

/** Erros de validação do class-validator (em inglês) → português simples, por campo. */
const FIELD_NAMES: Record<string, string> = {
  email: "o email", password: "a palavra-passe", newPassword: "a nova palavra-passe", currentPassword: "a palavra-passe actual", amount: "o valor", name: "o nome",
  nif: "o NIF", phone_number: "o telefone", phoneNumber: "o telefone", reference: "a referência", reason: "o motivo", paidOn: "a data de pagamento",
  dueDate: "a data de vencimento", issue_date: "a data de emissão", effectiveDate: "a data efectiva", startDate: "a data de início", endDate: "a data de fim",
  discountRate: "a percentagem de desconto", exchangeRate: "a taxa de câmbio", rate: "a taxa", title: "o título", messageTemplate: "a mensagem",
  refencence_number: "o número da factura", proof: "o comprovativo", file: "o ficheiro",
};
function translateValidation(detail: string): string | null {
  const m = /^([\w.[\]]+)\s+(.*)$/.exec(detail.trim());
  if (!m) return null;
  const field = m[1].split(".").pop()!.replace(/\[\d+\]/g, "");
  const label = FIELD_NAMES[field];
  if (!label) return null;
  const rule = m[2];
  if (/email/i.test(rule)) return `Indique um email válido.`;
  if (/should not be empty|must be a string|required/i.test(rule)) return `Preencha ${label}.`;
  if (/must match|must be a number|decimal|numeric|integer|must not be less|must be a positive/i.test(rule)) return `Verifique ${label}: o valor indicado não é válido.`;
  if (/date/i.test(rule)) return `Verifique ${label}: a data não é válida.`;
  if (/longer than|shorter|length/i.test(rule)) return `${label[0].toUpperCase()}${label.slice(1)} tem um tamanho inválido.`;
  return `Verifique ${label}.`;
}

export interface FriendlyInput { status: number; code?: string; message?: string; details?: unknown; requestId?: string; isLogin?: boolean }

export function friendlyMessage({ status, code, message = "", details, requestId, isLogin }: FriendlyInput): string {
  const ref = requestId ? ` (ref. ${requestId.slice(0, 8)})` : "";

  if (status === 0) return "Não foi possível ligar ao servidor. Verifique a sua ligação à internet e tente novamente.";
  if (status >= 500 || code === "INTERNAL_ERROR" || code === "MISCONFIGURATION")
    return `Ocorreu um problema do nosso lado. Tente novamente dentro de instantes; se continuar, contacte o suporte${ref}.`;
  if (status === 401) return isLogin ? "Email ou palavra-passe incorrectos. Verifique os dados e tente novamente." : "A sua sessão expirou. Inicie sessão novamente.";
  // o backend explica o motivo (permissão em falta, regra dos quatro olhos…) — mostrar tal como vem
  if (status === 403 && message && !looksTechnical(message) && !/^forbidden( resource)?$/i.test(message.trim())) return message;
  if (status === 403) return "Não tem permissão para fazer esta operação. Se precisar, peça acesso ao seu gestor.";
  if (status === 413) return "O ficheiro é demasiado grande. Escolha um ficheiro mais pequeno.";
  if (status === 415) return "Este tipo de ficheiro não é aceite. Use PDF, PNG, JPG ou Excel, conforme indicado.";
  if (status === 429) return "Fez muitas tentativas seguidas. Aguarde um momento e tente novamente.";

  for (const [re, txt] of REWRITES) if (re.test(message)) return txt;

  if (code === "VALIDATION_ERROR" || status === 400) {
    const list = Array.isArray(details) ? details.filter((d): d is string => typeof d === "string") : [];
    const translated = list.map((d) => (looksTechnical(d) ? translateValidation(d) : d)).filter(Boolean) as string[];
    if (translated.length) return [...new Set(translated)].slice(0, 2).join(" ");
    if (message && !looksTechnical(message) && message !== "Dados inválidos") return message;
    return "Alguns dados não estão correctos. Reveja os campos assinalados e tente novamente.";
  }
  // rota inexistente (ex.: API desactualizada) — não é um registo apagado
  if (status === 404 && /^Cannot (GET|POST|PUT|PATCH|DELETE) /i.test(message))
    return "Esta funcionalidade ainda não está disponível no servidor. Contacte o administrador do sistema.";
  if (status === 404 || code === "NOT_FOUND")
    return message && !looksTechnical(message) ? message : "O registo que procura já não existe ou foi removido.";
  if (status === 409 || code === "CONFLICT")
    return message && !looksTechnical(message) ? message : "Esta operação entra em conflito com dados existentes. Actualize a página e tente novamente.";

  // regras de negócio (422): o backend já escreve frases claras em português
  if (message && !looksTechnical(message)) return message;
  return "Não foi possível concluir a operação. Reveja os dados e tente novamente.";
}

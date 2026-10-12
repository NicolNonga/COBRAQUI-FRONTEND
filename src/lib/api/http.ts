/* eslint-disable @typescript-eslint/no-explicit-any */
// Cliente HTTP da API Cobra Aqui (NestJS).
// - Sessão em cookie HttpOnly (o token nunca fica acessível ao JavaScript), x-request-id devolvido nos erros
// - Idempotency-Key para operações financeiras (evita duplicados por duplo clique / retry)
// - Erros no formato { code, message, details, statusCode, requestId }
import { config } from "@/lib/config";
import { friendlyMessage, looksTechnical } from "@/lib/api/friendly-errors";
import { canPromptReLogin, emitSessionExpired } from "@/lib/api/session";

/** Erro da API. `message` é sempre uma frase para o utilizador; `technical` guarda a mensagem original do servidor. */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown, public requestId?: string, public technical?: string) {
    super(message);
  }
}

function fail(status: number, data: any, requestId?: string, path?: string): never {
  const technical = typeof data === "string" ? data : data?.message;
  const isLogin = !!path && /^\/?auth$/.test(path);
  const msg = friendlyMessage({ status, code: data?.code, message: technical, details: data?.details, requestId, isLogin });
  if (typeof console !== "undefined") console.warn("[API]", status, data?.code ?? "", technical ?? "", { details: data?.details, requestId, path });
  throw new ApiError(status, msg, data?.code, data?.details, requestId, technical);
}

// versões anteriores guardavam o token em localStorage (legível por qualquer XSS): apagar o que ficou
if (typeof window !== "undefined") { try { window.localStorage.removeItem("cobraqui.token"); } catch { /* sem acesso */ } }

type QueryValue = string | number | boolean | undefined | null | (string | number)[];
export type Query = Record<string, QueryValue>;

export function buildUrl(path: string, query?: Query) {
  const url = new URL(`${config.apiUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  Object.entries(query ?? {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  return url.toString();
}

export const newIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface RequestOptions { query?: Query; body?: unknown; idempotencyKey?: string | true }

function handleAuthFailure(status: number, path?: string) {
  if (typeof window === "undefined") return;
  // palavra-passe errada no próprio login (ou no modal de re-entrada) não é "sessão expirada"
  if (status === 401 && path && /^\/?auth$/.test(path)) return;
  if (status === 401 && !window.location.pathname.startsWith("/login")) {
    // sessão activa que expirou: pede as credenciais num modal (não perde o trabalho em curso)
    if (canPromptReLogin()) return emitSessionExpired();
    window.localStorage.removeItem("cobraqui.user");
    document.cookie = "cobraqui_session=; path=/; max-age=0";
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey === true ? newIdempotencyKey() : opts.idempotencyKey;

  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), { method, headers, body, credentials: "include" });
  } catch {
    fail(0, null, undefined, path);
  }
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    handleAuthFailure(res.status, path);
    fail(res.status, data, data?.requestId ?? res.headers.get("x-request-id") ?? undefined, path);
  }
  return data as T;
}

export const http = {
  get: <T = any>(path: string, query?: Query) => request<T>("GET", path, { query }),
  post: <T = any>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}) => request<T>("POST", path, { ...opts, body }),
  put: <T = any>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}) => request<T>("PUT", path, { ...opts, body }),
  patch: <T = any>(path: string, body?: unknown, opts: Omit<RequestOptions, "body"> = {}) => request<T>("PATCH", path, { ...opts, body }),
  delete: <T = any>(path: string) => request<T>("DELETE", path),
};

/** Descarrega um ficheiro protegido (comprovativos, relatórios de erros, logótipos). */
async function fetchFile(path: string) {
  let res: Response;
  try { res = await fetch(buildUrl(path), { credentials: "include" }); } catch { return fail(0, null, undefined, path); }
  if (!res.ok) {
    handleAuthFailure(res.status, path);
    let data: any = null;
    try { data = await res.json(); } catch { /* binário */ }
    if (res.status === 404) fail(404, { code: "NOT_FOUND", message: "O ficheiro já não está disponível." }, data?.requestId, path);
    fail(res.status, data, data?.requestId ?? res.headers.get("x-request-id") ?? undefined, path);
  }
  return res;
}

export async function downloadProtected(path: string, fallbackName: string) {
  const res = await fetchFile(path);
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  // preferir filename*=UTF-8'' (nomes com acentos) ao filename="…" ASCII
  const name = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1] ?? /filename="?([^";]+)"?/i.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = decodeURIComponent(name);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Abre um ficheiro protegido numa nova aba (pré-visualização de PDF/imagem). */
/** Descarrega um ficheiro protegido e devolve um URL local (blob:) — lembre-se de revogar. */
export async function blobUrlProtected(path: string) {
  const res = await fetchFile(path);
  return URL.createObjectURL(await res.blob());
}

export async function openProtected(path: string) {
  const res = await fetchFile(path);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
}

/** Converte objecto em FormData (ignora undefined/null; booleanos e números como texto). */
export function toFormData(obj: Record<string, unknown>) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (v instanceof Blob) fd.append(k, v);
    else fd.append(k, String(v));
  });
  return fd;
}

/** Mensagem para mostrar ao utilizador. Erros que não vêm da API (bugs do browser) também ficam legíveis. */
export const errorMessage = (e: unknown) => {
  if (e instanceof ApiError) return e.message;
  if (typeof console !== "undefined") console.error(e);
  const m = e instanceof Error ? e.message : "";
  return m && !looksTechnical(m) ? m : "Algo correu mal. Tente novamente; se o problema continuar, actualize a página.";
};

// Gestão documental — o backend ainda NÃO tem este módulo.
// Os documentos ficam apenas em memória nesta sessão do browser (perdem-se ao recarregar).
// Quando existir a API (ex.: /documents), substituir as funções abaixo por chamadas http.
import type { DocumentCategory, DocumentFile, ListParams, Paginated } from "@/types/models";

export const DOCUMENTS_BACKEND_READY = false;

export const documentCategories: { value: DocumentCategory; label: string }[] = [
  { value: "invoice", label: "Facturas" },
  { value: "contract", label: "Contratos" },
  { value: "agreement", label: "Acordos de pagamento" },
  { value: "receipt", label: "Comprovativos" },
  { value: "notice", label: "Notificações e cartas" },
  { value: "power_of_attorney", label: "Procurações" },
  { value: "identification", label: "Identificação" },
  { value: "legal", label: "Jurídico" },
  { value: "other", label: "Outros" },
];

const store: DocumentFile[] = [];
const nowIso = () => new Date().toISOString();
const nextId = () => store.reduce((m, d) => Math.max(m, d.id), 0) + 1;
function actor() {
  try {
    const u = JSON.parse(window.localStorage.getItem("cobraqui.user") ?? "null") as { id: number; fullName: string | null; email: string } | null;
    return u ? { id: u.id, fullName: u.fullName ?? u.email } : { id: 0, fullName: "—" };
  } catch { return { id: 0, fullName: "—" }; }
}

export interface DocumentQuery extends ListParams { category?: string; folder?: "all" | "recent" | "favorites"; debtorId?: number; ext?: string }
export interface UploadMeta { category: DocumentCategory; debtorId: number | null; debtorName?: string; tags: string[]; description?: string }

export const documentService = {
  async list(q: DocumentQuery): Promise<Paginated<DocumentFile>> {
    let rows = [...store].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (q.folder === "favorites") rows = rows.filter((d) => d.favorite);
    if (q.folder === "recent") rows = rows.slice(0, 12);
    if (q.category) rows = rows.filter((d) => d.category === q.category);
    if (q.debtorId) rows = rows.filter((d) => d.debtorId === Number(q.debtorId));
    if (q.ext) rows = rows.filter((d) => (q.ext === "image" ? ["jpg", "jpeg", "png"].includes(d.extension) : q.ext === "office" ? ["docx", "xlsx", "doc", "xls"].includes(d.extension) : d.extension === q.ext));
    const s = String(q.search ?? "").toLowerCase().trim();
    if (s) rows = rows.filter((d) => [d.name, d.link?.label, ...d.tags, d.uploadedBy.fullName].some((v) => String(v ?? "").toLowerCase().includes(s)));
    const perPage = Number(q.perPage ?? 24);
    const lastPage = Math.max(1, Math.ceil(rows.length / perPage));
    const currentPage = Math.min(Math.max(1, Number(q.page ?? 1)), lastPage);
    return { data: rows.slice((currentPage - 1) * perPage, currentPage * perPage), meta: { total: rows.length, perPage, currentPage, lastPage, firstPage: 1 } };
  },
  async stats() {
    const byCategory: Record<string, number> = {};
    store.forEach((d) => (byCategory[d.category] = (byCategory[d.category] ?? 0) + 1));
    return { total: store.length, size: store.reduce((s, d) => s + d.size, 0), byCategory, favorites: store.filter((d) => d.favorite).length };
  },
  async upload(files: File[], meta: UploadMeta): Promise<DocumentFile[]> {
    const who = actor();
    return files.map((f) => {
      const doc: DocumentFile = {
        id: nextId(), name: f.name, extension: (f.name.split(".").pop() ?? "").toLowerCase(), mimeType: f.type || "application/octet-stream", size: f.size,
        category: meta.category, tags: meta.tags, favorite: false, description: meta.description,
        link: meta.debtorId ? { type: "debtor", id: meta.debtorId, label: meta.debtorName ?? `Devedor #${meta.debtorId}` } : null,
        debtorId: meta.debtorId, uploadedBy: who, version: 1,
        versions: [{ version: 1, size: f.size, uploadedBy: who.fullName, createdAt: nowIso(), note: "Versão inicial" }],
        url: URL.createObjectURL(f), createdAt: nowIso(), updatedAt: nowIso(),
      };
      store.push(doc);
      return doc;
    });
  },
  async newVersion(id: number, file: File, note: string): Promise<DocumentFile> {
    const d = store.find((x) => x.id === id)!;
    d.version += 1;
    d.versions.unshift({ version: d.version, size: file.size, uploadedBy: actor().fullName, createdAt: nowIso(), note: note || undefined });
    d.size = file.size; d.updatedAt = nowIso(); d.url = URL.createObjectURL(file);
    return { ...d };
  },
  async update(id: number, patch: Partial<Pick<DocumentFile, "name" | "category" | "tags" | "description">>): Promise<DocumentFile> {
    const d = store.find((x) => x.id === id)!;
    Object.assign(d, patch, { updatedAt: nowIso() });
    return { ...d };
  },
  async toggleFavorite(id: number) {
    const d = store.find((x) => x.id === id);
    if (d) d.favorite = !d.favorite;
  },
  async remove(ids: number[]) {
    ids.forEach((id) => { const i = store.findIndex((x) => x.id === id); if (i >= 0) store.splice(i, 1); });
  },
  async download(doc: DocumentFile) {
    if (!doc.url) return;
    const a = document.createElement("a");
    a.href = doc.url; a.download = doc.name; a.click();
  },
};

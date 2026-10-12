"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Download, File, FileImage, FileSpreadsheet, FileText, History, Info, Layers, Link2, MoreHorizontal, Pencil, Star, Trash2, UploadCloud, X,
} from "lucide-react";
import { Avatar, Badge, DescriptionList, Tabs } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Drawer, Dropdown, MenuItem, MenuSeparator, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm";
import { DebtorPicker } from "@/components/shared/debtor-picker";
import { ActivityTimeline } from "@/components/shared/audit";
import { documentCategories, documentService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { Debtor, DocumentCategory, DocumentFile } from "@/types/models";
import { cn, formatDate, timeAgo } from "@/lib/utils";

export const categoryLabel = (c: DocumentCategory) => documentCategories.find((x) => x.value === c)?.label ?? c;

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1).replace(".", ",")} MB`;
  return `${(n / 1024 ** 3).toFixed(2).replace(".", ",")} GB`;
}

const extStyle = (ext: string) => {
  if (ext === "pdf") return { Icon: FileText, cls: "bg-red-50 text-red-600 dark:bg-red-500/15", label: "PDF" };
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return { Icon: FileImage, cls: "bg-violet-50 text-violet-600 dark:bg-violet-500/15", label: "IMG" };
  if (["xlsx", "xls", "csv"].includes(ext)) return { Icon: FileSpreadsheet, cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15", label: "XLS" };
  if (["docx", "doc"].includes(ext)) return { Icon: FileText, cls: "bg-sky-50 text-sky-600 dark:bg-sky-500/15", label: "DOC" };
  return { Icon: File, cls: "bg-soft text-muted", label: ext.toUpperCase() };
};

export function FileIcon({ ext, size = "md" }: { ext: string; size?: "sm" | "md" | "lg" }) {
  const s = extStyle(ext);
  const box = { sm: "h-8 w-8 rounded-lg", md: "h-10 w-10 rounded-xl", lg: "h-14 w-14 rounded-2xl" }[size];
  const ic = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-7 w-7" }[size];
  return <span className={cn("flex shrink-0 items-center justify-center", box, s.cls)}><s.Icon className={ic} /></span>;
}

/** Pré-visualização: ficheiro real (imagem/PDF carregado na sessão) ou uma representação estilizada. */
export function DocPreview({ doc, className }: { doc: DocumentFile; className?: string }) {
  const s = extStyle(doc.extension);
  if (doc.url && s.label === "IMG") return <img src={doc.url} alt={doc.name} className={cn("h-full w-full object-contain", className)} />;
  if (doc.url && s.label === "PDF") return <iframe src={doc.url} title={doc.name} className={cn("h-full w-full", className)} />;
  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-subtle", className)}>
      <div className="relative w-[58%] max-w-[220px] rounded-md bg-white p-4 shadow-card ring-1 ring-black/5 dark:bg-ink-800" style={{ aspectRatio: "1 / 1.3" }}>
        <span className={cn("absolute top-3 right-3 rounded px-1.5 py-0.5 text-[9px] font-bold", s.cls)}>{s.label}</span>
        <div className="mb-3 h-2 w-1/2 rounded bg-slate-300/80" />
        {[90, 75, 85, 60, 80, 70, 40].map((w, i) => <div key={i} className="mb-1.5 h-1.5 rounded bg-slate-200" style={{ width: `${w}%` }} />)}
        <div className="mt-3 grid grid-cols-3 gap-1">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-1.5 rounded bg-slate-200" />)}</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Upload ───────────────────────── */
export function UploadModal({ open, onClose, onDone, initialFiles, defaultDebtor }: {
  open: boolean; onClose: () => void; onDone: () => void; initialFiles?: File[]; defaultDebtor?: Debtor | null;
}) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<DocumentCategory>("invoice");
  const [debtor, setDebtor] = useState<Debtor | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [desc, setDesc] = useState("");
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFiles(initialFiles ?? []); setDebtor(defaultDebtor ?? null); setTags([]); setTagInput(""); setDesc("");
    const first = initialFiles?.[0]?.name.toLowerCase() ?? "";
    setCategory(/comprov|recibo|transfer/.test(first) ? "receipt" : /contrat/.test(first) ? "contract" : /acordo/.test(first) ? "agreement" : "invoice");
  }, [open, initialFiles, defaultDebtor]);

  const add = (list: FileList | null) => list && setFiles((f) => [...f, ...Array.from(list)]);
  const addTag = () => { const t = tagInput.trim(); if (t && !tags.includes(t)) setTags([...tags, t]); setTagInput(""); };
  const total = files.reduce((s, f) => s + f.size, 0);

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Carregar documentos" description="Organize os ficheiros por categoria e associe-os a um devedor para os encontrar facilmente." icon={<UploadCloud className="h-5 w-5" />}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button disabled={!files.length} loading={busy} onClick={async () => {
          setBusy(true);
          try {
            await documentService.upload(files, { category, debtorId: debtor?.id ?? null, debtorName: debtor?.name, tags, description: desc || undefined });
            toast("success", `${files.length} documento(s) carregado(s)`, debtor ? `Associados a ${debtor.name}` : categoryLabel(category));
            onDone(); onClose();
          } catch (e) { toast("error", "Falha no carregamento", errorMessage(e)); } finally { setBusy(false); }
        }}>Carregar {files.length > 0 && `(${files.length})`}</Button>
      </>}>
      <div className="space-y-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors",
            over ? "border-brand-500 bg-brand-50/60 dark:bg-brand-500/10" : "hover:border-brand-300 hover:bg-subtle")}>
          <UploadCloud className="h-6 w-6 text-muted" />
          <p className="text-sm"><span className="font-semibold text-brand-600">Seleccione ficheiros</span> ou arraste-os para aqui</p>
          <p className="text-xs text-muted">PDF, imagens, Word e Excel · até 25 MB por ficheiro</p>
          <input ref={inputRef} type="file" multiple className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        </div>

        {files.length > 0 && (
          <div className="overflow-hidden rounded-xl border">
            <div className="flex justify-between border-b bg-subtle px-4 py-2 text-xs text-muted"><span>{files.length} ficheiro(s)</span><span>{formatBytes(total)}</span></div>
            <ul className="scroll-thin max-h-48 divide-y overflow-y-auto">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2">
                  <FileIcon ext={(f.name.split(".").pop() ?? "").toLowerCase()} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                  <span className="text-xs text-muted">{formatBytes(f.size)}</span>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-1 text-muted hover:bg-soft"><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" required>
            <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {documentCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Associar ao devedor" hint="Recomendado: o documento aparece na ficha do devedor.">
            <DebtorPicker value={debtor} onChange={setDebtor} />
          </Field>
          <Field label="Etiquetas" className="sm:col-span-2">
            <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border surface px-2 py-1.5 focus-within:border-brand-500 focus-within:shadow-focus">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md bg-soft px-2 py-0.5 text-xs">{t}<button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-3 w-3" /></button></span>
              ))}
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder={tags.length ? "" : "Ex: assinado, prestação 1 — Enter para adicionar"}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }} onBlur={addTag}
                className="min-w-[120px] flex-1 bg-transparent text-sm outline-none" />
            </div>
          </Field>
          <Field label="Descrição (opcional)" className="sm:col-span-2"><Textarea rows={2} className="min-h-[60px]" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Notas internas sobre o documento" /></Field>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Detalhe ───────────────────────── */
export function DocumentDrawer({ doc, onClose, onChanged }: { doc: DocumentFile | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<"info" | "versions" | "history">("info");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", category: "other" as DocumentCategory, description: "" });
  const [current, setCurrent] = useState<DocumentFile | null>(null);
  const [del, setDel] = useState(false);
  const versionRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCurrent(doc); setTab("info"); setEditing(false); if (doc) setForm({ name: doc.name, category: doc.category, description: doc.description ?? "" }); }, [doc]);
  const d = current;

  return (
    <Drawer open={!!doc} onClose={onClose} width="max-w-2xl" title={d?.name ?? ""}
      description={d && <span className="flex items-center gap-2">{categoryLabel(d.category)} · {formatBytes(d.size)} · v{d.version}</span>}
      footer={d && <>
        <Button variant="outline-danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDel(true)} className="mr-auto">Eliminar</Button>
        <Button variant="secondary" icon={<Layers className="h-4 w-4" />} onClick={() => versionRef.current?.click()}>Nova versão</Button>
        <Button icon={<Download className="h-4 w-4" />} onClick={() => documentService.download(d)}>Descarregar</Button>
      </>}>
      {d && (
        <div className="space-y-5">
          <input ref={versionRef} type="file" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            const upd = await documentService.newVersion(d.id, f, "Nova versão carregada");
            setCurrent(upd); onChanged(); toast("success", `Versão ${upd.version} carregada`);
          }} />
          <div className="h-72 overflow-hidden rounded-2xl border"><DocPreview doc={d} /></div>

          <Tabs value={tab} onChange={setTab} items={[{ value: "info", label: "Informação" }, { value: "versions", label: "Versões", count: d.versions.length }, { value: "history", label: "Histórico" }]} />

          {tab === "info" && (editing ? (
            <div className="space-y-4">
              <Field label="Nome do ficheiro"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Categoria">
                <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as DocumentCategory })}>
                  {documentCategories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Descrição"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button onClick={async () => { const upd = await documentService.update(d.id, form); setCurrent(upd); setEditing(false); onChanged(); toast("success", "Documento actualizado"); }}>Guardar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex justify-end"><Button variant="ghost" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>Editar dados</Button></div>
              <DescriptionList items={[
                { label: "Categoria", value: categoryLabel(d.category) },
                { label: "Tipo", value: `${d.extension.toUpperCase()} · ${formatBytes(d.size)}` },
                { label: "Associado a", value: d.link ? <LinkChip link={d.link} /> : "Sem associação" },
                { label: "Carregado por", value: <span className="flex items-center gap-2"><Avatar name={d.uploadedBy.fullName} size="xs" />{d.uploadedBy.fullName}</span> },
                { label: "Criado em", value: formatDate(d.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                { label: "Última alteração", value: timeAgo(d.updatedAt) },
              ]} />
              {d.tags.length > 0 && <div><p className="mb-2 text-xs font-medium text-muted">Etiquetas</p><div className="flex flex-wrap gap-1.5">{d.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div></div>}
              {d.description && <div><p className="mb-1 text-xs font-medium text-muted">Descrição</p><p className="text-sm">{d.description}</p></div>}
            </div>
          ))}

          {tab === "versions" && (
            <ol className="space-y-2">
              {d.versions.map((v, i) => (
                <li key={v.version} className={cn("flex items-center gap-3 rounded-xl border p-3", i === 0 && "border-brand-200 bg-brand-50/40 dark:bg-brand-500/5")}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-soft font-mono text-xs font-semibold">v{v.version}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{v.note ?? `Versão ${v.version}`} {i === 0 && <Badge tone="brand" className="ml-1">Actual</Badge>}</p>
                    <p className="text-xs text-muted">{v.uploadedBy} · {formatDate(v.createdAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {formatBytes(v.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon-sm" title="Descarregar" onClick={() => documentService.download(d)}><Download className="h-4 w-4" /></Button>
                </li>
              ))}
            </ol>
          )}

          {tab === "history" && <div className="-mx-5"><ActivityTimeline entity="document" entityId={d.id} /></div>}
        </div>
      )}
      <ConfirmDialog open={del} onClose={() => setDel(false)} title="Eliminar documento?" confirmLabel="Eliminar"
        description={<>O documento <b>{d?.name}</b> e todas as suas versões serão eliminados. A acção fica registada na auditoria.</>}
        onConfirm={async () => { if (!d) return; await documentService.remove([d.id]); setDel(false); toast("success", "Documento eliminado"); onChanged(); onClose(); }} />
    </Drawer>
  );
}

function LinkChip({ link }: { link: NonNullable<DocumentFile["link"]> }) {
  const href = link.type === "debtor" ? `/debtors/${link.id}` : link.type === "invoice" ? "/invoices" : link.type === "process" ? "/processes" : "/negotiations";
  const label = { debtor: "Devedor", invoice: "Factura", process: "Processo", negotiation: "Acordo" }[link.type];
  return <Link href={href} className="inline-flex items-center gap-1.5 text-brand-600 hover:underline"><Link2 className="h-3.5 w-3.5" />{label}: {link.label}</Link>;
}

/* ───────────────────────── Listagem (grelha / lista) ───────────────────────── */
export function DocumentCollection({ docs, view, selected, onSelect, onOpen, onChanged, empty }: {
  docs: DocumentFile[]; view: "grid" | "list"; selected: number[]; onSelect: (ids: number[]) => void; onOpen: (d: DocumentFile) => void; onChanged: () => void; empty?: ReactNode;
}) {
  const toggle = (id: number) => onSelect(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const confirm = useConfirm();
  if (!docs.length) return <>{empty}</>;

  const menu = (d: DocumentFile) => (
    <Dropdown trigger={<Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>}>
      <MenuItem icon={<Info />} onClick={() => onOpen(d)}>Detalhes</MenuItem>
      <MenuItem icon={<Download />} onClick={() => documentService.download(d)}>Descarregar</MenuItem>
      <MenuItem icon={<Star />} onClick={async () => { await documentService.toggleFavorite(d.id); onChanged(); }}>{d.favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}</MenuItem>
      <MenuItem icon={<History />} onClick={() => onOpen(d)}>Versões e histórico</MenuItem>
      <MenuSeparator />
      <MenuItem icon={<Trash2 />} danger onClick={async () => {
        const ok = await confirm({ title: "Eliminar documento?", confirmLabel: "Eliminar",
          description: <><b>{d.name}</b> e todas as suas versões serão eliminados. Esta acção não pode ser revertida.</>,
          onConfirm: () => documentService.remove([d.id]) }).catch(() => false);
        if (ok) onChanged();
      }}>Eliminar</MenuItem>
    </Dropdown>
  );

  if (view === "grid")
    return (
      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {docs.map((d) => {
          const sel = selected.includes(d.id);
          return (
            <div key={d.id} onClick={() => onOpen(d)}
              className={cn("group relative cursor-pointer overflow-hidden rounded-2xl border surface transition-all hover:shadow-pop", sel && "ring-2 ring-brand-500")}>
              <div className="h-36 border-b"><DocPreview doc={d} /></div>
              <div className={cn("absolute top-2.5 left-2.5 transition-opacity", sel ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                <span className="flex rounded-md surface p-1 shadow-card"><Checkbox checked={sel} onChange={() => toggle(d.id)} /></span>
              </div>
              {d.favorite && <Star className="absolute top-3 right-3 h-4 w-4 fill-accent-400 text-accent-500" />}
              <div className="flex items-start gap-2.5 p-3">
                <FileIcon ext={d.extension} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={d.name}>{d.name}</p>
                  <p className="truncate text-xs text-muted">{d.link?.label ?? categoryLabel(d.category)}</p>
                  <p className="mt-1 text-[11px] text-muted">{formatBytes(d.size)} · {timeAgo(d.updatedAt)}{d.version > 1 && ` · v${d.version}`}</p>
                </div>
                <span onClick={(e) => e.stopPropagation()}>{menu(d)}</span>
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-subtle text-xs text-muted">
          <th className="w-10 pl-4"><Checkbox checked={docs.every((d) => selected.includes(d.id))} indeterminate={docs.some((d) => selected.includes(d.id)) && !docs.every((d) => selected.includes(d.id))}
            onChange={(v) => onSelect(v ? [...new Set([...selected, ...docs.map((d) => d.id)])] : selected.filter((id) => !docs.some((d) => d.id === id)))} /></th>
          <th className="px-4 py-2.5 text-left font-medium">Nome</th>
          <th className="px-4 py-2.5 text-left font-medium">Categoria</th>
          <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">Associado a</th>
          <th className="hidden px-4 py-2.5 text-left font-medium lg:table-cell">Carregado por</th>
          <th className="px-4 py-2.5 text-right font-medium">Tamanho</th>
          <th className="hidden px-4 py-2.5 text-left font-medium md:table-cell">Alterado</th>
          <th />
        </tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} onClick={() => onOpen(d)} className={cn("cursor-pointer border-b last:border-0", selected.includes(d.id) ? "bg-brand-50/50 dark:bg-brand-500/10" : "hover:bg-subtle")}>
              <td className="pl-4" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.includes(d.id)} onChange={() => toggle(d.id)} /></td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <FileIcon ext={d.extension} size="sm" />
                  <div className="min-w-0">
                    <p className="flex max-w-[320px] items-center gap-1.5 truncate font-medium">{d.name}{d.favorite && <Star className="h-3.5 w-3.5 shrink-0 fill-accent-400 text-accent-500" />}</p>
                    <div className="flex gap-1">{d.version > 1 && <span className="font-mono text-[11px] text-muted">v{d.version}</span>}{d.tags.slice(0, 2).map((t) => <span key={t} className="text-[11px] text-muted">#{t}</span>)}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2.5"><Badge>{categoryLabel(d.category)}</Badge></td>
              <td className="hidden max-w-[200px] truncate px-4 py-2.5 text-muted md:table-cell">{d.link?.label ?? "—"}</td>
              <td className="hidden px-4 py-2.5 lg:table-cell"><span className="flex items-center gap-2 text-muted"><Avatar name={d.uploadedBy.fullName} size="xs" />{d.uploadedBy.fullName}</span></td>
              <td className="tabular px-4 py-2.5 text-right text-muted">{formatBytes(d.size)}</td>
              <td className="hidden px-4 py-2.5 whitespace-nowrap text-muted md:table-cell">{timeAgo(d.updatedAt)}</td>
              <td className="pr-3 text-right" onClick={(e) => e.stopPropagation()}>{menu(d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

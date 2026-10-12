"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Clock, Download, FileText, FolderOpen, HardDrive, LayoutGrid, List, Star, Trash2, UploadCloud, Folder } from "lucide-react";
import { Card, EmptyState, PageHeader, Progress } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { SearchInput, SegmentedControl, Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { DocumentCollection, DocumentDrawer, UploadModal, formatBytes } from "@/components/shared/documents";
import { useListState, useQuery } from "@/hooks/use-query";
import { documentCategories, documentService } from "@/lib/api/services";
import type { DocumentFile } from "@/types/models";
import { cn, formatNumber } from "@/lib/utils";

const QUOTA = 10 * 1024 ** 3; // 10 GB por organização (ilustrativo)
type FolderKey = "all" | "recent" | "favorites";

export default function DocumentsPage() {
  const toast = useToast();
  const params = useSearchParams();
  const list = useListState({ perPage: 24 });
  const [folder, setFolder] = useState<FolderKey>("all");
  const [category, setCategory] = useState("");
  const [ext, setExt] = useState("");
  const [view, setView] = useState<"grid" | "list">("list");
  const [selected, setSelected] = useState<number[]>([]);
  const [open, setOpen] = useState<DocumentFile | null>(null);
  const [upload, setUpload] = useState<{ open: boolean; files?: File[] }>({ open: false });
  const [dragging, setDragging] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => { try { const v = localStorage.getItem("cobraqui.docs.view"); if (v === "grid" || v === "list") setView(v); } catch {} }, []);
  useEffect(() => { if (params.get("upload")) setUpload({ open: true }); }, [params]);
  useEffect(() => { list.setPage(1); setSelected([]); }, [folder, category, ext]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, reload } = useQuery(
    () => documentService.list({ folder, category: category || undefined, ext: ext || undefined, search: list.debounced, page: list.page, perPage: list.perPage }),
    [folder, category, ext, list.debounced, list.page],
  );
  const { data: stats, reload: reloadStats } = useQuery(() => documentService.stats());
  const refresh = () => { reload(); reloadStats(); };

  const folderBtn = (active: boolean) => cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
    active ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "text-muted hover:bg-soft hover:text-[var(--text)]");
  const title = category ? documentCategories.find((c) => c.value === category)?.label : folder === "recent" ? "Recentes" : folder === "favorites" ? "Favoritos" : "Todos os documentos";

  return (
    <div
      onDragEnter={(e) => { if (e.dataTransfer.types.includes("Files")) setDragging(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) setUpload({ open: true, files: Array.from(e.dataTransfer.files) }); }}
      className="relative"
    >
      <PageHeader title="Documentos" description="Facturas, contratos, acordos e comprovativos — organizados e ligados a cada devedor."
        actions={<Button icon={<UploadCloud className="h-4 w-4" />} onClick={() => setUpload({ open: true })}>Carregar documentos</Button>} />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Pastas */}
        <aside className="space-y-6">
          <nav className="space-y-0.5">
            <button className={folderBtn(folder === "all" && !category)} onClick={() => { setFolder("all"); setCategory(""); }}><FolderOpen className="h-4 w-4" /><span className="flex-1">Todos</span><span className="tabular text-xs">{stats?.total ?? ""}</span></button>
            <button className={folderBtn(folder === "recent" && !category)} onClick={() => { setFolder("recent"); setCategory(""); }}><Clock className="h-4 w-4" /><span className="flex-1">Recentes</span></button>
            <button className={folderBtn(folder === "favorites" && !category)} onClick={() => { setFolder("favorites"); setCategory(""); }}><Star className="h-4 w-4" /><span className="flex-1">Favoritos</span><span className="tabular text-xs">{stats?.favorites ?? ""}</span></button>
          </nav>
          <div>
            <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase">Categorias</p>
            <nav className="space-y-0.5">
              {documentCategories.map((c) => (
                <button key={c.value} className={folderBtn(category === c.value)} onClick={() => { setFolder("all"); setCategory(c.value); }}>
                  <Folder className="h-4 w-4" /><span className="flex-1 truncate">{c.label}</span><span className="tabular text-xs">{stats?.byCategory[c.value] ?? 0}</span>
                </button>
              ))}
            </nav>
          </div>
          {stats && (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-sm font-medium"><HardDrive className="h-4 w-4 text-muted" /> Armazenamento</p>
              <Progress value={stats.size / QUOTA} className="mt-3" />
              <p className="mt-2 text-xs text-muted">{formatBytes(stats.size)} de {formatBytes(QUOTA)} utilizados</p>
            </Card>
          )}
        </aside>

        {/* Conteúdo */}
        <Card padded={false} className="min-w-0">
          <div className="flex min-h-[60px] flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            {selected.length > 0 ? (
              <div className="flex w-full flex-wrap items-center gap-3">
                <span className="text-sm font-medium"><span className="tabular text-brand-600">{selected.length}</span> seleccionado(s)</span>
                <button className="text-sm text-muted hover:text-[var(--text)]" onClick={() => setSelected([])}>Limpar</button>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />}
                    onClick={() => data?.data.filter((d) => selected.includes(d.id)).forEach((d, i) => setTimeout(() => documentService.download(d), i * 250))}>Descarregar</Button>
                  <Button size="sm" variant="outline-danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDel(true)}>Eliminar</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold">{title}</h2>
                  <span className="tabular text-[13px] text-muted">{formatNumber(data?.meta.total ?? 0)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SearchInput value={list.search} onChange={list.setSearch} placeholder="Nome, devedor, etiqueta…" className="sm:w-60" />
                  <Select value={ext} onChange={(e) => setExt(e.target.value)} className="w-36">
                    <option value="">Todos os tipos</option><option value="pdf">PDF</option><option value="image">Imagens</option><option value="office">Word / Excel</option>
                  </Select>
                  <SegmentedControl value={view} onChange={(v) => { setView(v); try { localStorage.setItem("cobraqui.docs.view", v); } catch {} }}
                    options={[{ value: "list", label: <List className="h-4 w-4" /> }, { value: "grid", label: <LayoutGrid className="h-4 w-4" /> }]} />
                </div>
              </>
            )}
          </div>

          <div className={cn(loading && "opacity-60 transition-opacity")}>
            <DocumentCollection docs={data?.data ?? []} view={view} selected={selected} onSelect={setSelected} onOpen={setOpen} onChanged={refresh}
              empty={!loading && <EmptyState icon={<FileText />} title="Nenhum documento" description="Arraste ficheiros para esta página ou use o botão Carregar documentos."
                action={<Button size="sm" icon={<UploadCloud className="h-4 w-4" />} onClick={() => setUpload({ open: true })}>Carregar</Button>} />} />
          </div>

          {data && data.meta.lastPage > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3 text-[13px] text-muted">
              <span>Página {data.meta.currentPage} de {data.meta.lastPage}</span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={data.meta.currentPage <= 1} onClick={() => list.setPage(data.meta.currentPage - 1)}>Anterior</Button>
                <Button variant="secondary" size="sm" disabled={data.meta.currentPage >= data.meta.lastPage} onClick={() => list.setPage(data.meta.currentPage + 1)}>Seguinte</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {dragging && (
        <div onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-brand-600/10 backdrop-blur-[2px]">
          <div className="pointer-events-none rounded-3xl border-2 border-dashed border-brand-500 surface px-12 py-10 text-center shadow-pop">
            <UploadCloud className="mx-auto h-10 w-10 text-brand-600" />
            <p className="mt-3 text-lg font-semibold">Largue os ficheiros para carregar</p>
            <p className="text-sm text-muted">Poderá escolher a categoria e o devedor a seguir</p>
          </div>
        </div>
      )}

      <UploadModal open={upload.open} initialFiles={upload.files} onClose={() => setUpload({ open: false })} onDone={refresh} />
      <DocumentDrawer doc={open} onClose={() => setOpen(null)} onChanged={refresh} />
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} title={`Eliminar ${selected.length} documento(s)?`} confirmLabel="Eliminar"
        description="Os documentos seleccionados e as suas versões serão eliminados. A acção fica registada na auditoria."
        onConfirm={async () => { await documentService.remove(selected); setConfirmDel(false); setSelected([]); toast("success", "Documentos eliminados"); refresh(); }} />
    </div>
  );
}

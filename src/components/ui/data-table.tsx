"use client";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { Pagination } from "@/types/models";
import { cn, formatNumber } from "@/lib/utils";
import { Checkbox } from "./form";
import { EmptyState, Skeleton } from "./display";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  hideOnMobile?: boolean;
}

interface Props<T extends { id: number }> {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  meta?: Pagination;
  onPage?: (page: number) => void;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: number[];
  onSelectedChange?: (ids: number[]) => void;
  toolbar?: ReactNode;
  bulkActions?: ReactNode;
  empty?: { title: string; description?: string; action?: ReactNode; icon?: ReactNode };
  className?: string;
  dense?: boolean;
  /** mostra o botão "Recarregar" na barra da tabela */
  onRefresh?: () => void;
}

export function DataTable<T extends { id: number }>({
  columns, rows, loading, meta, onPage, onRowClick, selectable, selected = [], onSelectedChange, toolbar, bulkActions, empty, className, dense, onRefresh,
}: Props<T>) {
  const data = rows ?? [];
  const allOnPage = data.length > 0 && data.every((r) => selected.includes(r.id));
  const someOnPage = data.some((r) => selected.includes(r.id));
  const toggleAll = () =>
    onSelectedChange?.(allOnPage ? selected.filter((id) => !data.some((r) => r.id === id)) : [...new Set([...selected, ...data.map((r) => r.id)])]);
  const toggle = (id: number) => onSelectedChange?.(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const align = (a?: string) => (a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left");

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border surface shadow-card", className)}>
      {/* barra de progresso enquanto (re)carrega com dados já no ecrã */}
      {loading && !!rows?.length && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-brand-100 dark:bg-brand-500/20" role="progressbar" aria-label="A carregar">
          <div className="h-full w-1/3 animate-[table-progress_1.1s_ease-in-out_infinite] rounded-full bg-brand-500" />
        </div>
      )}
      {(toolbar || onRefresh || (selectable && selected.length > 0)) && (
        <div className="flex min-h-[60px] flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {selectable && selected.length > 0 ? (
            <div className="flex w-full flex-wrap items-center gap-3">
              <span className="text-sm font-medium"><span className="tabular text-brand-600">{selected.length}</span> seleccionado(s)</span>
              <button className="text-sm text-muted hover:text-[var(--text)]" onClick={() => onSelectedChange?.([])}>Limpar</button>
              <div className="ml-auto flex flex-wrap gap-2">{bulkActions}</div>
            </div>
          ) : (
            <>
              {toolbar ?? <span />}
              {onRefresh && (
                <button type="button" onClick={onRefresh} disabled={loading} title="Recarregar dados" aria-label="Recarregar dados"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 self-end rounded-lg border surface px-3 text-[13px] font-medium text-muted transition-colors hover:text-[var(--text)] disabled:cursor-wait sm:ml-2 sm:self-auto">
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  <span className="hidden sm:inline">{loading ? "A carregar…" : "Recarregar"}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="scroll-thin overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-subtle">
              {selectable && (
                <th className="w-10 pl-4">
                  <Checkbox checked={allOnPage} indeterminate={!allOnPage && someOnPage} onChange={toggleAll} />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={cn("px-4 py-2.5 text-xs font-medium whitespace-nowrap text-muted", align(c.align), c.hideOnMobile && "hidden md:table-cell", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !rows?.length
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {selectable && <td className="pl-4"><Skeleton className="h-4 w-4" /></td>}
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-4 py-4", c.hideOnMobile && "hidden md:table-cell")}><Skeleton className="h-4 w-full max-w-[160px]" /></td>
                    ))}
                  </tr>
                ))
              : data.map((row) => {
                  const isSel = selected.includes(row.id);
                  return (
                    <tr key={row.id} onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={cn("group border-b transition-colors last:border-0", onRowClick && "cursor-pointer",
                        isSel ? "bg-brand-50/60 dark:bg-brand-500/10" : "hover:bg-subtle", loading && "opacity-60")}>
                      {selectable && (
                        <td className="w-10 pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSel} onChange={() => toggle(row.id)} />
                        </td>
                      )}
                      {columns.map((c) => (
                        <td key={c.key} className={cn("px-4 whitespace-nowrap", dense ? "py-2.5" : "py-3.5", align(c.align), c.hideOnMobile && "hidden md:table-cell", c.className)}>
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!loading && data.length === 0 && <EmptyState title={empty?.title ?? "Sem resultados"} description={empty?.description ?? "Ajuste os filtros ou a pesquisa para encontrar o que procura."} action={empty?.action} icon={empty?.icon} />}
      </div>

      {meta && meta.total > 0 && (
        <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-[13px] text-muted">
          <span className="tabular">
            {formatNumber((meta.currentPage - 1) * meta.perPage + 1)}–{formatNumber(Math.min(meta.currentPage * meta.perPage, meta.total))} de {formatNumber(meta.total)}
          </span>
          <div className="flex items-center gap-1">
            <PageBtn disabled={meta.currentPage <= 1} onClick={() => onPage?.(meta.currentPage - 1)}><ChevronLeft className="h-4 w-4" /></PageBtn>
            {pageList(meta.currentPage, meta.lastPage).map((p, i) =>
              p === "…" ? <span key={`e${i}`} className="px-1.5">…</span> : (
                <PageBtn key={p} active={p === meta.currentPage} onClick={() => onPage?.(p)}>{p}</PageBtn>
              ),
            )}
            <PageBtn disabled={meta.currentPage >= meta.lastPage} onClick={() => onPage?.(meta.currentPage + 1)}><ChevronRight className="h-4 w-4" /></PageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function PageBtn({ children, onClick, disabled, active }: { children: ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={cn("tabular flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-medium transition-colors disabled:opacity-40",
        active ? "border surface text-[var(--text)] shadow-card" : "hover:bg-soft")}>
      {children}
    </button>
  );
}

function pageList(cur: number, last: number): (number | "…")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const s = Math.max(2, cur - 1), e = Math.min(last - 1, cur + 1);
  if (s > 2) out.push("…");
  for (let i = s; i <= e; i++) out.push(i);
  if (e < last - 1) out.push("…");
  out.push(last);
  return out;
}

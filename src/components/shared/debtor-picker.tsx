"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { debtorService } from "@/lib/api/services";
import type { Debtor } from "@/types/models";
import { cn } from "@/lib/utils";

export function DebtorPicker({ value, onChange, invalid }: { value: Debtor | null; onChange: (d: Debtor) => void; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => debtorService.search(q).then(setItems).catch(() => setItems([])).finally(() => setLoading(false)), 180);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-invalid={invalid || undefined}
        className={cn("flex h-10 w-full items-center gap-2.5 rounded-lg border surface px-3 text-left text-sm transition-[border,box-shadow] outline-none focus:border-brand-500 focus:shadow-focus",
          invalid && "border-danger-500", open && "border-brand-500 shadow-focus")}>
        {value ? <>
          <Avatar name={value.name} size="xs" />
          <span className="flex-1 truncate font-medium">{value.name}</span>
          <span className="font-mono text-xs text-muted">{value.nif ?? ""}</span>
        </> : <span className="flex-1 text-muted">Pesquisar devedor por nome ou NIF…</span>}
        <ChevronsUpDown className="h-4 w-4 text-muted" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 w-full animate-slide-up overflow-hidden rounded-xl border surface shadow-pop">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 text-muted" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex: João da Silva ou 5401234567" className="h-10 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <ul className="scroll-thin max-h-64 overflow-y-auto p-1">
            {loading && <li className="px-3 py-6 text-center text-sm text-muted">A pesquisar…</li>}
            {!loading && items.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Nenhum devedor encontrado.</li>}
            {!loading && items.map((d) => (
              <li key={d.id}>
                <button type="button" onClick={() => { onChange(d); setOpen(false); setQ(""); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-soft">
                  <Avatar name={d.name} size="xs" />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="font-mono text-xs text-muted">{d.nif}</span>
                  {value?.id === d.id && <Check className="h-4 w-4 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

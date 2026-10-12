"use client";
import { errorMessage } from "@/lib/api/http";
import { SESSION_RESTORED_EVENT } from "@/lib/api/session";
import { useCallback, useEffect, useRef, useState } from "react";

/** Hook simples de dados assíncronos (sem dependências externas). */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reqId = useRef(0);

  const run = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const r = await fnRef.current();
      if (id === reqId.current) setData(r);
    } catch (e) {
      if (id === reqId.current) setError(errorMessage(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);

  // depois de voltar a entrar (sessão expirada), recarrega o que tinha falhado
  const errorRef = useRef<string | null>(null);
  errorRef.current = error;
  useEffect(() => {
    const h = () => { if (errorRef.current) run(); };
    window.addEventListener(SESSION_RESTORED_EVENT, h);
    return () => window.removeEventListener(SESSION_RESTORED_EVENT, h);
  }, [run]);

  return { data, loading, error, reload: run, setData };
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Estado de listagem paginada com pesquisa. */
export function useListState(initial: { perPage?: number } = {}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  useEffect(() => setPage(1), [debounced]);
  return { page, setPage, search, setSearch, debounced, perPage: initial.perPage ?? 10 };
}

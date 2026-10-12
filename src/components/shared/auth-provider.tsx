"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/types/models";
import { authService } from "@/lib/api/services";
import { onSessionExpired, SESSION_RESTORED_EVENT, setSessionInteractive } from "@/lib/api/session";
import { useToast } from "@/components/ui/toast";
import { SessionExpiredModal } from "@/components/shared/session-expired-modal";

type SessionUser = User & { permissions: string[] };
interface AuthCtx {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
  isManager: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);
const USER_KEY = "cobraqui.user";
const setSessionCookie = (on: boolean) => {
  document.cookie = on ? `cobraqui_session=1; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax` : "cobraqui_session=; path=/; max-age=0";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const [expired, setExpired] = useState(false);
  // o aviso só aparece uma vez por expiração; a ref evita avisar dentro do render (o updater do setState corre em render)
  const expiredRef = useRef(false);

  const persist = (u: SessionUser | null) => {
    setUser(u);
    if (u) window.localStorage.setItem(USER_KEY, JSON.stringify(u));
    else window.localStorage.removeItem(USER_KEY);
  };

  const refresh = useCallback(async () => {
    const me = await authService.me();
    persist({ ...me, permissions: me.permissions ?? [] });
  }, []);

  useEffect(() => {
    // a sessão vive num cookie HttpOnly; aqui só existe um indicador (sem segredo) para saber se há sessão
    const hasSession = document.cookie.split("; ").some((c) => c.startsWith("cobraqui_session="));
    const cached = window.localStorage.getItem(USER_KEY);
    if (hasSession && cached) {
      try { setUser(JSON.parse(cached)); } catch { /* ignora cache corrompida */ }
      // actualiza perfil/permissões em segundo plano; 401 é tratado no cliente http
      refresh().catch(() => undefined).finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await authService.login(email, password);
    setSessionCookie(true);
    persist({ ...r.user, permissions: r.user.permissions ?? [] });
  }, []);

  // sessão expirada a meio do trabalho: avisa e pede as credenciais num modal que não se fecha
  useEffect(() => {
    if (!ready || !user) { setSessionInteractive(false); return; }
    setSessionInteractive(true);
    const off = onSessionExpired(() => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      setExpired(true);
      toast("error", "A sua sessão expirou", "Volte a entrar para continuar.");
    });
    return () => { off(); setSessionInteractive(false); };
  }, [ready, user, toast]);

  const reLogin = useCallback(async (email: string, password: string) => {
    const r = await authService.login(email, password);
    setSessionCookie(true);
    // outra conta? os dados em ecrã pertencem a outro utilizador: recarrega tudo
    if (user && r.user.id !== user.id) { persist({ ...r.user, permissions: r.user.permissions ?? [] }); window.location.reload(); return; }
    persist({ ...r.user, permissions: r.user.permissions ?? [] });
    expiredRef.current = false;
    setExpired(false);
    toast("success", "Sessão reposta", "Pode continuar. Se alguma acção não foi concluída, repita-a.");
    window.dispatchEvent(new Event(SESSION_RESTORED_EVENT));
  }, [user, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  // demorou demasiado: volta ao login normal (guardando a página para onde regressar)
  const giveUp = useCallback(() => {
    setSessionCookie(false);
    persist(null);
    expiredRef.current = false;
    setExpired(false);
    router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = useCallback(async () => {
    try { await authService.logout(); } catch { /* sessão já inválida */ }
    setSessionCookie(false);
    persist(null);
    router.replace("/login");
  }, [router]);

  const can = useCallback((p: string) => !!user?.permissions?.includes(p), [user]);

  return (
    <Ctx.Provider value={{ user, ready, login, logout, refresh, can, isManager: !!user?.role?.isManager }}>
      {children}
      {expired && user && <SessionExpiredModal email={user.email} onLogin={reLogin} onTimeout={giveUp} />}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth fora do AuthProvider");
  return c;
}

export const displayName = (u: { fullName?: string | null; email?: string } | null | undefined) => u?.fullName || u?.email || "—";

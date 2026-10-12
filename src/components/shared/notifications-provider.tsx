"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/shared/auth-provider";
import { notificationService } from "@/lib/api/services";
import { config } from "@/lib/config";
import { connectSocket, type SocketStatus } from "@/lib/realtime/socket";
import {
  desktopPermission, playChime, primeAudioOnFirstGesture, requestDesktopPermission, setSoundEnabled, showDesktopNotification, soundEnabled,
  type DesktopPermission,
} from "@/lib/realtime/alerts";
import type { AppNotification } from "@/types/models";

/** Evento emitido pelo gateway NestJS (NOTIFICATION_CREATED_EVENT). */
const EVENT = "notification-created";

interface Ctx {
  items: AppNotification[];
  unread: number;
  status: SocketStatus;
  /** muda sempre que chega uma notificação — páginas podem usá-lo para recarregar */
  version: number;
  reload: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  permission: DesktopPermission;
  enableDesktop: () => Promise<void>;
  sound: boolean;
  setSound: (on: boolean) => void;
}
const NotificationsCtx = createContext<Ctx | null>(null);

/**
 * Notificações em tempo real:
 *  - Socket.IO autenticado (JWT) → cada notificação nova chega no instante;
 *  - som de alerta + toast quando a aba está visível;
 *  - notificação do sistema (Notification API) quando a aba está em segundo plano;
 *  - contador no título da aba: "(3) Cobraqui";
 *  - se o socket cair, recarrega por HTTP a cada 60 s até voltar.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const [version, setVersion] = useState(0);
  const [permission, setPermission] = useState<DesktopPermission>("default");
  const [sound, setSoundState] = useState(true);
  const seen = useRef(new Set<string>());

  const reload = useCallback(() => {
    notificationService.list({ perPage: 8 }).then((r) => { setItems(r.data); r.data.forEach((n) => seen.current.add(String(n.id))); }).catch(() => undefined);
    notificationService.unreadCount().then(setUnread).catch(() => undefined);
  }, []);

  useEffect(() => { setPermission(desktopPermission()); setSoundState(soundEnabled()); primeAudioOnFirstGesture(); }, []);

  // ligação em tempo real enquanto houver sessão
  useEffect(() => {
    if (!user) return;
    reload();
    const sock = connectSocket({
      baseUrl: config.wsUrl,
      onStatus: setStatus,
      onEvent: (event, data) => {
        if (event !== EVENT || !data) return;
        const n = data as AppNotification;
        const key = String(n.id);
        if (seen.current.has(key)) return; // entrega "pelo menos uma vez": ignorar repetidas
        seen.current.add(key);
        setItems((prev) => [n, ...prev].slice(0, 20));
        setUnread((u) => u + 1);
        setVersion((v) => v + 1);
        playChime(n.priority);
        const title = n.title ?? "Nova notificação";
        if (document.visibilityState === "visible") toast(n.priority === "high" ? "info" : "success", title, n.message);
        else showDesktopNotification({ id: key, title, body: n.message, url: n.actionUrl });
      },
    });
    return () => sock.close();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // plano B: sem socket, actualizar por HTTP
  useEffect(() => {
    if (!user || status === "connected") return;
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [user, status, reload]);

  // ao voltar à aba, sincronizar (pode ter perdido eventos enquanto o portátil dormia)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible" && user) reload(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user, reload]);

  // contador no título da aba
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread > 0 ? `(${unread}) ${base}` : base;
  }, [unread]);

  const value: Ctx = {
    items, unread, status, version, reload,
    markRead: async (id) => {
      await notificationService.markRead(id).catch(() => undefined);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnread((u) => Math.max(0, u - (items.find((n) => n.id === id && !n.isRead) ? 1 : 0)));
    },
    markAllRead: async () => {
      await notificationService.markAllRead().catch(() => undefined);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    },
    permission,
    enableDesktop: async () => {
      const p = await requestDesktopPermission();
      setPermission(p);
      if (p === "granted") {
        toast("success", "Alertas activados", "Vai receber as notificações mesmo com a aba em segundo plano.");
        playChime();
      } else if (p === "denied") {
        toast("info", "Alertas bloqueados", "Permita as notificações para este site nas definições do browser.");
      }
    },
    sound,
    setSound: (on) => { setSoundEnabled(on); setSoundState(on); if (on) playChime(); },
  };
  return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}

export function useNotifications() {
  const c = useContext(NotificationsCtx);
  if (!c) throw new Error("useNotifications fora do NotificationsProvider");
  return c;
}

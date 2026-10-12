/**
 * Cliente Socket.IO mínimo (protocolo Engine.IO v4 sobre WebSocket nativo) — sem dependências.
 * Fala com o gateway NestJS (`@WebSocketGateway`, path /socket.io): autentica com o JWT no
 * pacote de ligação e recebe eventos `42["evento", dados]`.
 *
 * - responde aos pings do servidor ("2" → "3");
 * - se o servidor deixar de dar sinal (pingInterval + pingTimeout), fecha e volta a ligar;
 * - reconexão automática com espera crescente (1s, 2s, 4s… até 30s).
 */
export type SocketStatus = "connecting" | "connected" | "disconnected";

export interface RealtimeSocket {
  close(): void;
}

export function connectSocket(opts: {
  baseUrl: string;
  token?: () => string | null;
  onEvent: (event: string, data: unknown) => void;
  onStatus?: (s: SocketStatus) => void;
}): RealtimeSocket {
  let ws: WebSocket | null = null;
  let closedByUser = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let heartbeatMs = 45_000;

  const url = (() => {
    const u = new URL(opts.baseUrl);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.pathname = "/socket.io/";
    u.search = "?EIO=4&transport=websocket";
    return u.toString();
  })();

  const status = (s: SocketStatus) => opts.onStatus?.(s);
  const armWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => ws?.close(), heartbeatMs);
  };

  const scheduleReconnect = () => {
    if (closedByUser) return;
    clearTimeout(retryTimer);
    const delay = Math.min(30_000, 1000 * 2 ** attempt) + Math.random() * 500;
    attempt += 1;
    retryTimer = setTimeout(open, delay);
  };

  function open() {
    const token = opts.token?.() ?? null; // sem token: a sessão segue no cookie HttpOnly do handshake
    if (closedByUser) return;
    status("connecting");
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onmessage = (ev) => {
      const msg = String(ev.data);
      armWatchdog();
      switch (msg[0]) {
        case "0": {
          // handshake Engine.IO → pedir ligação ao namespace "/" com o token
          try {
            const h = JSON.parse(msg.slice(1)) as { pingInterval?: number; pingTimeout?: number };
            heartbeatMs = (h.pingInterval ?? 25_000) + (h.pingTimeout ?? 20_000);
          } catch { /* valores por omissão */ }
          ws?.send(`40${JSON.stringify(token ? { token } : {})}`);
          break;
        }
        case "2":
          ws?.send("3"); // pong
          break;
        case "4": {
          const kind = msg[1];
          if (kind === "0") { attempt = 0; status("connected"); }
          else if (kind === "1" || kind === "4") { ws?.close(); } // desligado pelo servidor / erro de ligação
          else if (kind === "2") {
            try {
              const [event, data] = JSON.parse(msg.slice(2)) as [string, unknown];
              opts.onEvent(event, data);
            } catch { /* evento mal formado: ignorar */ }
          }
          break;
        }
      }
    };
    ws.onclose = () => {
      clearTimeout(watchdog);
      ws = null;
      status("disconnected");
      scheduleReconnect();
    };
    ws.onerror = () => ws?.close();
  }

  open();
  return {
    close() {
      closedByUser = true;
      clearTimeout(retryTimer);
      clearTimeout(watchdog);
      ws?.close();
      ws = null;
    },
  };
}

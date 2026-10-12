/**
 * Alertas de notificação: som (gerado com Web Audio, sem ficheiros) e notificação do sistema
 * (Notification API) quando a aba não está visível.
 */

let ctx: AudioContext | null = null;

/** Os browsers só deixam tocar som depois de um gesto do utilizador: desbloqueia no primeiro clique/tecla. */
export function primeAudioOnFirstGesture() {
  if (typeof window === "undefined") return;
  const unlock = () => {
    try {
      ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      void ctx.resume();
    } catch { /* sem áudio */ }
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

const SOUND_KEY = "cobraqui.notifications.sound";
export const soundEnabled = () => {
  try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; }
};
export const setSoundEnabled = (on: boolean) => {
  try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch { /* ignore */ }
};

/** Toque curto de duas notas (agradável, ~0,35 s). Prioridade alta → três notas. */
export function playChime(priority: "low" | "medium" | "high" = "medium") {
  if (!soundEnabled()) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    const notes = priority === "high" ? [880, 1174.7, 1568] : [784, 1174.7];
    const t0 = ctx.currentTime + 0.01;
    notes.forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = t0 + i * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch { /* sem áudio disponível */ }
}

export type DesktopPermission = NotificationPermission | "unsupported";
export const desktopPermission = (): DesktopPermission =>
  typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported";

export async function requestDesktopPermission(): Promise<DesktopPermission> {
  if (desktopPermission() === "unsupported") return "unsupported";
  try { return await Notification.requestPermission(); } catch { return desktopPermission(); }
}

/** Notificação do sistema (aparece mesmo com a aba em segundo plano). Clicar foca a app e abre o link. */
export function showDesktopNotification(n: { id: string; title: string; body: string; url?: string | null }) {
  if (desktopPermission() !== "granted") return;
  try {
    const note = new Notification(n.title, { body: n.body, tag: `cobraqui-${n.id}`, icon: "/favicon.ico", silent: true });
    note.onclick = () => {
      window.focus();
      if (n.url) window.location.assign(n.url);
      note.close();
    };
  } catch { /* alguns browsers móveis não permitem new Notification() */ }
}

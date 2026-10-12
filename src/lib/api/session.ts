// Sessão expirada: em vez de ir direito ao login, a interface abre um modal para voltar a entrar
// sem perder o que o utilizador estava a fazer. Este módulo liga o cliente HTTP (que detecta o 401) ao modal.
type Listener = () => void;
const listeners = new Set<Listener>();
let interactive = false;

/** Só depois de a sessão ter sido confirmada no arranque: antes disso, um 401 vai para o login como sempre. */
export const setSessionInteractive = (v: boolean) => { interactive = v; };
export const canPromptReLogin = () => interactive && listeners.size > 0;
export const onSessionExpired = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const emitSessionExpired = () => listeners.forEach((l) => l());

/** disparado depois de o utilizador voltar a entrar (as listas que falharam recarregam-se sozinhas) */
export const SESSION_RESTORED_EVENT = "cobraqui:session-restored";
/** tempo que o modal espera antes de mandar o utilizador para o login */
export const RELOGIN_TIMEOUT_SECONDS = 5 * 60;

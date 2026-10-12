import type { ReactNode } from "react";
import { ShieldCheck, TrendingUp } from "lucide-react";
import { DotGrid } from "@/components/shared/dot-grid";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-screen overflow-hidden lg:grid-cols-[1fr_1.05fr]">
      <DotGrid />
      <div className="relative flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <p className="text-xs text-muted">© {new Date().getFullYear()} Cobraqui. Todos os direitos reservados.</p>
      </div>

      {/* Painel de marca */}
      <div className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_20%,rgba(34,144,227,0.55),transparent_70%),radial-gradient(45%_40%_at_20%_90%,rgba(246,174,60,0.30),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,.65)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div className="relative flex h-full flex-col justify-between p-14 text-white">
          <div className="max-w-md">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" /> Plataforma de recuperação de crédito
            </p>
            <h2 className="text-[34px] leading-tight font-semibold tracking-tight">Recupere mais, com menos esforço.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/65">
              Centralize devedores, facturas, processos e acordos de pagamento numa única plataforma — com visibilidade em tempo real para toda a equipa.
            </p>
          </div>

          {/* Pré-visualização do produto */}
          <div className="relative mx-auto w-full max-w-lg">
            <div className="rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/55">Recuperado este mês</p>
                  <p className="mt-1 text-2xl font-semibold tabular">Kz 48.320.500,00</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-400/15 px-2 py-1 text-xs font-medium text-emerald-300">
                  <TrendingUp className="h-3.5 w-3.5" /> +18,4%
                </span>
              </div>
              <svg viewBox="0 0 400 110" className="mt-4 w-full">
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4fb3ee" stopOpacity="0.55" />
                    <stop offset="1" stopColor="#4fb3ee" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 90 C40 82 60 70 100 72 S160 50 200 52 S260 30 300 34 S360 12 400 10 L400 110 L0 110Z" fill="url(#ag)" />
                <path d="M0 90 C40 82 60 70 100 72 S160 50 200 52 S260 30 300 34 S360 12 400 10" fill="none" stroke="#ffd84d" strokeWidth="2.5" />
              </svg>
            </div>
            <div className="absolute -bottom-6 -left-8 flex items-center gap-3 rounded-xl bg-white p-3 pr-5 text-ink-900 shadow-2xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ShieldCheck className="h-5 w-5" /></span>
              <div>
                <p className="text-xs text-slate-500">Acordo #2041 liquidado</p>
                <p className="text-sm font-semibold tabular">Kz 3.450.000,00</p>
              </div>
            </div>
          </div>

          <div className="flex gap-10 text-sm">
            {[["94%", "taxa de contacto"], ["3,2×", "mais acordos"], ["-41%", "dias em atraso"]].map(([v, l]) => (
              <div key={l}>
                <p className="text-xl font-semibold">{v}</p>
                <p className="text-white/50">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

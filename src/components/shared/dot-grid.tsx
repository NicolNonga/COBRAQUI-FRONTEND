/**
 * Fundo das páginas fora da aplicação (404, erro, autenticação): malha de pontos esbatida nos
 * bordos. Acompanha o tema — os pontos usam a cor das bordas, por isso funciona em claro e escuro.
 */
export function DotGrid({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_center,var(--border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)] ${className}`}
    />
  );
}

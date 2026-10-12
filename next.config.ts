import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const origin = (url: string) => { try { return new URL(url).origin; } catch { return ""; } };
const apiOrigin = origin(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333/api");
const wsOrigin = origin(process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3333");
const wsScheme = (o: string) => o.replace(/^http/, "ws");

// Política de conteúdo: só o próprio site e a API; sem frames de terceiros; sem plugins.
// 'unsafe-inline' em scripts é exigido pelo Next (scripts de hidratação e do tema); 'unsafe-eval' só no desenvolvimento.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${[apiOrigin, wsOrigin, wsScheme(wsOrigin)].filter(Boolean).join(" ")}`,
  "frame-src 'self' blob:",
  "object-src 'self' blob:", // o visualizador de PDF do navegador precisa disto
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

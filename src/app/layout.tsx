import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/shared/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Cobraqui — Gestão de Cobranças", template: "%s · Cobraqui" },
  description: "Plataforma de gestão de cobranças, devedores, processos e negociações.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f7f8fa" }, { media: "(prefers-color-scheme: dark)", color: "#0b0e17" }],
};

const themeScript = `try{var t=localStorage.getItem('cobraqui.theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches&&false))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

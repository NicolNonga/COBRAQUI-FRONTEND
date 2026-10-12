"use client";
import { useId } from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" fill="none" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}b`} x1="20" y1="20" x2="80" y2="55" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4FB3EE" />
          <stop offset="1" stopColor="#1580D8" />
        </linearGradient>
        <linearGradient id={`${id}y`} x1="20" y1="30" x2="75" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD84D" />
          <stop offset="1" stopColor="#F6AE3C" />
        </linearGradient>
      </defs>
      <path d="M28.6 24A28 28 0 0 1 75.4 53.8" stroke={`url(#${id}b)`} strokeWidth="10" />
      <path d="M22.5 31.5C17 45 21 56 30 65L50 85L72 61" stroke={`url(#${id}y)`} strokeWidth="10" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("text-[17px] font-semibold tracking-tight", light && "text-white")}>Cobraqui</span>
    </span>
  );
}

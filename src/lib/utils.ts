import clsx, { type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export function formatMoney(raw: number | string | null | undefined, code = "AOA", compact = false) {
  const value = Number(raw ?? 0) || 0;
  if (compact) {
    const abs = Math.abs(value);
    const sym = code === "AOA" ? "Kz" : code === "USD" ? "$" : code === "EUR" ? "€" : code;
    if (abs >= 1e9) return `${sym} ${(value / 1e9).toFixed(1).replace(".", ",")} mil M`;
    if (abs >= 1e6) return `${sym} ${(value / 1e6).toFixed(1).replace(".", ",")} M`;
    if (abs >= 1e3) return `${sym} ${(value / 1e3).toFixed(0)} mil`;
  }
  try {
    return new Intl.NumberFormat("pt-AO", { style: "currency", currency: code, minimumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

export const formatNumber = (n: number | string | null | undefined) => new Intl.NumberFormat("pt-AO").format(Number(n ?? 0));
export const formatPercent = (n: number, digits = 1) => `${(n * 100).toFixed(digits).replace(".", ",")}%`;

export function formatDate(iso: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-PT", opts).format(new Date(iso));
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return formatDate(iso);
}

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(";"), ...rows.map((r) => keys.map((k) => esc(r[k])).join(";"))].join("\n");
}

export function downloadFile(name: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** "12.5" → "12,5%" (percentagens que já vêm em 0–100 do backend) */
export const pct = (v: string | number | null | undefined, digits = 1) =>
  v === null || v === undefined || v === "" ? "—" : `${Number(v).toFixed(digits).replace(".", ",")}%`;

/** soma valores monetários em string com precisão de cêntimos */
export const sumMoney = (values: (string | number | null | undefined)[]) =>
  (values.reduce<number>((s, v) => s + Math.round(Number(v ?? 0) * 100), 0) / 100).toFixed(2);

export const toMoneyString = (v: number | string) => (Math.round(Number(v) * 100) / 100).toFixed(2);
export const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

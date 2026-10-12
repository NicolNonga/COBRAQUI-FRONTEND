"use client";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm";
import { AuthProvider } from "./auth-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>{children}</AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

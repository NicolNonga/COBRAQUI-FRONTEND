"use client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/display";
import { LadderEditor } from "@/components/shared/ladders";

export default function NewLadderPage() {
  return (
    <>
      <Link href="/ladders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-[var(--text)]"><ArrowLeft className="h-4 w-4" /> Régua de cobrança</Link>
      <PageHeader title="Nova régua de cobrança" description="Defina os passos por dia de processo." />
      <LadderEditor />
    </>
  );
}

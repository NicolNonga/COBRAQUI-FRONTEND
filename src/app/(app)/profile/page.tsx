"use client";
import { useState } from "react";
import { Lock, Mail, Phone, ShieldCheck } from "lucide-react";
import { Avatar, Badge, Card, CardHeader, DescriptionList, PageHeader } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { displayName, useAuth } from "@/components/shared/auth-provider";
import { authService } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import { formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);
  if (!user) return null;

  return (
    <>
      <PageHeader title="O meu perfil" description="Informação da conta, segurança e preferências." />
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <div className="flex flex-col items-center text-center">
            <Avatar name={displayName(user)} size="xl" />
            <p className="mt-4 text-lg font-semibold">{user.fullName ?? user.email}</p>
            <p className="text-sm text-muted">{user.email}</p>
            <div className="mt-3 flex gap-2"><Badge tone="brand"><ShieldCheck className="h-3 w-3" />{user.role?.name ?? "—"}</Badge>{user.category && <Badge>{user.category.name}</Badge>}</div>
          </div>
          <div className="mt-6 space-y-3 border-t pt-5 text-sm">
            <p className="flex items-center gap-3 text-muted"><Mail className="h-4 w-4" />{user.email}</p>
            <p className="flex items-center gap-3 text-muted"><Phone className="h-4 w-4" />{user.phoneNumber ?? "—"}</p>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Informação da conta" />
            <div className="mt-5"><DescriptionList items={[
              { label: "Nome", value: user.fullName ?? "—" }, { label: "Email", value: user.email },
              { label: "Organização", value: user.organization?.name ?? "Agência" }, { label: "Perfil", value: user.role?.name ?? "—" },
              { label: "Permissões", value: `${user.permissions?.length ?? 0} activas` }, { label: "Membro desde", value: formatDate(user.createdAt) },
            ]} /></div>
          </Card>

          <Card>
            <CardHeader title="Alterar palavra-passe" description="Recomendamos alterar a palavra-passe a cada 90 dias." />
            <form className="mt-5 grid gap-4 sm:grid-cols-3" onSubmit={async (e) => {
              e.preventDefault();
              if (pw.next.length < 8 || !/(?=.*[A-Za-z])(?=.*\d)/.test(pw.next) || pw.next !== pw.confirm) return toast("error", "Verifique a nova palavra-passe", "Mínimo 8 caracteres, com letras e números, e confirmação igual.");
              setSavingPw(true);
              try { const r = await authService.changePassword(pw.current, pw.next); toast("success", r.message); setPw({ current: "", next: "", confirm: "" }); }
              catch (err) { toast("error", "Não foi possível alterar a palavra-passe", errorMessage(err)); } finally { setSavingPw(false); }
            }}>
              <Field label="Palavra-passe actual"><Input type="password" leading={<Lock />} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
              <Field label="Nova palavra-passe"><Input type="password" leading={<Lock />} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
              <Field label="Confirmar"><Input type="password" leading={<Lock />} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
              <div className="sm:col-span-3"><Button type="submit" loading={savingPw} disabled={!pw.current || !pw.next}>Actualizar palavra-passe</Button></div>
            </form>
          </Card>

        </div>
      </div>
    </>
  );
}

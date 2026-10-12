"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Building2, User } from "lucide-react";
import { Drawer } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Field, FileDrop, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { catalogService, debtorService, organizationService, type DebtorPayload } from "@/lib/api/services";
import { errorMessage } from "@/lib/api/http";
import type { Debtor, DebtorType } from "@/types/models";
import { cn } from "@/lib/utils";

const empty = {
  is_company: true, typeDebtor_id: 0, organizationId: 0, social_reason: "", name: "", nif: "", email: "", phone_number: "", address: "",
  contact_person_name: "", contact_person_email: "", contact_person_contact: "", contact_person_position: "",
};
type FormState = typeof empty;
const PHONE = /^\+?[0-9 ]{6,20}$/;
const EMAIL = /^\S+@\S+\.\S+$/;

export function DebtorFormDrawer({ open, onClose, debtor, onSaved }: { open: boolean; onClose: () => void; debtor?: Debtor | null; onSaved: () => void }) {
  const [f, setF] = useState<FormState>(empty);
  const [logo, setLogo] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<DebtorType[]>([]);
  const [orgs, setOrgs] = useState<{ id: number; name: string }[]>([]);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setErrors({}); setLogo(null);
    Promise.all([catalogService.debtorTypesDropdown(), organizationService.dropdown()])
      .then(([t, o]) => {
        setTypes(t); setOrgs(o);
        setF(debtor ? {
          is_company: debtor.isCompany, typeDebtor_id: debtor.debtorTypeId, organizationId: debtor.organizationId, social_reason: debtor.socialReason ?? "",
          name: debtor.name, nif: debtor.nif ?? "", email: debtor.email, phone_number: debtor.phoneNumber, address: debtor.address,
          contact_person_name: debtor.contactPerson?.name ?? "", contact_person_email: debtor.contactPerson?.email ?? "",
          contact_person_contact: debtor.contactPerson?.contact ?? "", contact_person_position: debtor.contactPerson?.position ?? "",
        } : { ...empty, typeDebtor_id: t.find((x) => x.isCompany)?.id ?? t[0]?.id ?? 0, organizationId: o[0]?.id ?? 0 });
      })
      .catch((e) => toast("error", "Não foi possível carregar os catálogos", errorMessage(e)));
  }, [open, debtor, toast]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };
  const pickKind = (company: boolean) => {
    const t = types.find((x) => x.isCompany === company);
    setF((x) => ({ ...x, is_company: company, typeDebtor_id: t?.id ?? x.typeDebtor_id }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = "Indique o nome.";
    if (!f.nif.trim()) er.nif = "Indique o NIF / BI.";
    if (!EMAIL.test(f.email)) er.email = "Email inválido.";
    if (!PHONE.test(f.phone_number)) er.phone_number = "Telefone inválido (ex: +244 923 000 000).";
    if (!f.address.trim()) er.address = "Indique o endereço.";
    if (!f.organizationId) er.organizationId = "Seleccione o credor.";
    if (!f.typeDebtor_id) er.typeDebtor_id = "Seleccione o tipo.";
    if (!f.contact_person_name.trim()) er.contact_person_name = "Obrigatório.";
    if (!EMAIL.test(f.contact_person_email)) er.contact_person_email = "Email inválido.";
    if (!f.contact_person_contact.trim()) er.contact_person_contact = "Obrigatório.";
    if (!f.contact_person_position.trim()) er.contact_person_position = "Obrigatório.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      const payload: DebtorPayload = { ...f, social_reason: f.social_reason || undefined, file: logo };
      if (debtor) await debtorService.update(debtor.id, payload);
      else await debtorService.create(payload);
      toast("success", debtor ? "Devedor actualizado" : "Devedor criado", f.name);
      onSaved();
      onClose();
    } catch (err) {
      toast("error", "Não foi possível guardar", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const inp = (k: keyof FormState) => ({
    value: f[k] as string, invalid: !!errors[k], onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  });

  return (
    <Drawer open={open} onClose={onClose} title={debtor ? "Editar devedor" : "Novo devedor"}
      description={debtor ? debtor.name : "Registe uma empresa ou particular para iniciar a cobrança."}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="debtor-form" loading={saving}>{debtor ? "Guardar alterações" : "Criar devedor"}</Button>
      </>}>
      <form id="debtor-form" onSubmit={submit} className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {([true, false] as const).map((c) => (
            <button key={String(c)} type="button" onClick={() => pickKind(c)}
              className={cn("flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                f.is_company === c ? "border-brand-500 bg-brand-50/50 shadow-focus dark:bg-brand-500/10" : "hover:bg-subtle")}>
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", f.is_company === c ? "bg-brand-600 text-white" : "bg-soft text-muted")}>
                {c ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </span>
              <span>
                <span className="block text-sm font-medium">{c ? "Empresa" : "Particular"}</span>
                <span className="block text-xs text-muted">{c ? "Pessoa colectiva" : "Pessoa singular"}</span>
              </span>
            </button>
          ))}
        </div>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Informação do devedor</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de cliente" required error={errors.typeDebtor_id}>
              <Select value={f.typeDebtor_id || ""} placeholder="Seleccione" onChange={(e) => set("typeDebtor_id", Number(e.target.value))}>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Credor" required error={errors.organizationId}>
              <Select value={f.organizationId || ""} placeholder="Seleccione" onChange={(e) => set("organizationId", Number(e.target.value))}>
                {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </Field>
            {f.is_company && (
              <Field label="Razão social" className="sm:col-span-2">
                <Input placeholder="Comércio e Serviços, S.A." {...inp("social_reason")} />
              </Field>
            )}
            <Field label={f.is_company ? "Nome comercial" : "Nome completo"} required error={errors.name}>
              <Input placeholder={f.is_company ? "Nome da empresa" : "Nome do devedor"} {...inp("name")} />
            </Field>
            <Field label={f.is_company ? "NIF" : "Nº do BI / NIF"} required error={errors.nif}>
              <Input placeholder="5401234567" className="font-mono" {...inp("nif")} />
            </Field>
            <Field label="Email" required error={errors.email}><Input type="email" placeholder="email@exemplo.ao" {...inp("email")} /></Field>
            <Field label="Telefone" required error={errors.phone_number}><Input placeholder="+244 923 000 000" {...inp("phone_number")} /></Field>
            <Field label="Endereço" required error={errors.address} className="sm:col-span-2"><Input placeholder="Rua, bairro, município" {...inp("address")} /></Field>
            <Field label="Logótipo (opcional)" className="sm:col-span-2"><FileDrop accept=".png,.jpg,.jpeg" file={logo} onFile={setLogo} hint="PNG ou JPG" /></Field>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-subtle p-4">
          <div>
            <h3 className="text-sm font-semibold">Pessoa de contacto</h3>
            <p className="text-xs text-muted">Responsável para assuntos de pagamento (obrigatório).</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required error={errors.contact_person_name}><Input placeholder="Nome do contacto" {...inp("contact_person_name")} /></Field>
            <Field label="Cargo" required error={errors.contact_person_position}><Input placeholder="Director Financeiro" {...inp("contact_person_position")} /></Field>
            <Field label="Email" required error={errors.contact_person_email}><Input type="email" placeholder="contacto@empresa.ao" {...inp("contact_person_email")} /></Field>
            <Field label="Telefone" required error={errors.contact_person_contact}><Input placeholder="923 000 000" {...inp("contact_person_contact")} /></Field>
          </div>
        </section>
      </form>
    </Drawer>
  );
}

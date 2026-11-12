"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-data";
import { saveSettings } from "@/services/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import "./platform.css";

import {
  label,
  date,
  errorText,
  Notice,
  Loading,
  Status,
  PageTitle,
} from "./platform-shared";
const settingFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe un nombre")
    .max(120, "Usa hasta 120 caracteres"),
});
export function SettingsPage() {
  const { profile } = useAuth();
  const data = useSettings();
  const [saving, setSaving] = useState(false);
  const form = useForm<z.infer<typeof settingFormSchema>>({
    resolver: zodResolver(settingFormSchema),
    defaultValues: { name: "" },
  });
  const admin = profile?.role === "ADMINISTRADOR";
  useEffect(() => {
    if (data.settings) form.reset({ name: data.settings.name });
  }, [data.settings, form]);
  async function submit(values: z.infer<typeof settingFormSchema>) {
    if (!profile || !admin) return;
    setSaving(true);
    try {
      await saveSettings(values.name, profile.uid);
      toast.success("Configuración guardada");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="ADMINISTRACIÓN"
        title="Configuración"
        description="Información institucional de la plataforma y de tu cuenta."
      />
      <Notice error={data.error} />
      <div className="settings-grid">
        <Card>
          <CardHeader>
            <CardTitle>Identidad de la aplicación</CardTitle>
            <CardDescription>
              {admin
                ? "El nombre aparece en el menú lateral, el encabezado y la pestaña del navegador."
                : "Información institucional disponible para consulta."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.loading ? (
              <Loading />
            ) : (
              <form onSubmit={form.handleSubmit(submit)}>
                <FieldGroup>
                  <Field data-invalid={!!form.formState.errors.name}>
                    <FieldLabel htmlFor="application-name">
                      Nombre institucional de la aplicación
                    </FieldLabel>
                    <Input
                      id="application-name"
                      maxLength={120}
                      placeholder="Plataforma Institucional Colima 2027"
                      {...form.register("name")}
                      readOnly={!admin}
                      aria-invalid={!!form.formState.errors.name}
                    />
                    <FieldError>
                      {form.formState.errors.name?.message}
                    </FieldError>
                  </Field>
                  {data.settings?.updatedAt && (
                    <p className="muted small">
                      Última actualización: {date(data.settings.updatedAt)}
                    </p>
                  )}
                  {admin && (
                    <Button type="submit" disabled={saving}>
                      {saving ? "Guardando…" : "Guardar cambios"}
                    </Button>
                  )}
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mi cuenta</CardTitle>
            <CardDescription>
              Permisos asignados por el administrador.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="account-details">
              <div>
                <dt>Nombre</dt>
                <dd>
                  {profile?.firstName} {profile?.lastName}
                </dd>
              </div>
              <div>
                <dt>Correo institucional</dt>
                <dd>{profile?.email}</dd>
              </div>
              <div>
                <dt>Rol</dt>
                <dd>
                  <Badge variant="outline">{label(profile?.role ?? "")}</Badge>
                </dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <Status value={profile?.status ?? ""} />
                </dd>
              </div>
            </dl>
            <p className="muted small">
              Para modificar tu perfil o tus permisos, contacta al
              administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

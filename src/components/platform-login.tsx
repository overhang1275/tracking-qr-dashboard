"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import "./platform.css";
import { InstitutionalMark } from "./institutional-mark";
import { Notice } from "./platform-shared";

const loginSchema = z.object({
  email: z.string().email("Ingresa un correo válido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
const passwordUpdateSchema = z
  .object({
    password: z.string().min(8, "Usa al menos 8 caracteres").max(128),
    confirmPassword: z.string().min(8, "Confirma la contraseña"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden",
  });
export function LoginPage() {
  const {
    login,
    resetPassword,
    updatePassword,
    passwordRecovery,
    user,
    profile,
    configured,
    loading,
    error,
  } = useAuth();
  const router = useRouter();
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const passwordForm = useForm<z.infer<typeof passwordUpdateSchema>>({
    resolver: zodResolver(passwordUpdateSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  useEffect(() => {
    if (user && profile && !passwordRecovery) router.replace("/dashboard");
  }, [user, profile, passwordRecovery, router]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("password")) return;
    url.searchParams.delete("password");
    url.searchParams.delete("email");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);
  const showRecovery = recovery && !passwordRecovery;
  const title = passwordRecovery
    ? "Crear nueva contraseña"
    : showRecovery
      ? "Recuperar acceso"
      : "Bienvenido de nuevo";
  const description = passwordRecovery
    ? "Escribe y confirma tu nueva contraseña."
    : showRecovery
      ? "Escribe el correo asociado a tu cuenta."
      : "Ingresa tus credenciales para acceder a la plataforma.";
  async function submit(values: z.infer<typeof loginSchema>) {
    setBusy(true);
    setFormError(null);
    try {
      await login(values.email, values.password);
    } catch (error) {
      setFormError(
        error instanceof Error && error.message.includes("acceso institucional")
          ? error.message
          : "No se pudo iniciar sesión. Verifica tus credenciales y que tu cuenta esté activa.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    const email = form.getValues("email");
    if (!z.email().safeParse(email).success) {
      form.setError("email", {
        message: "Escribe tu correo para recuperar el acceso",
      });
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await resetPassword(email);
      toast.success(
        "Si la cuenta existe, recibirás un correo de recuperación.",
      );
      setRecovery(false);
    } catch {
      setFormError(
        "No fue posible solicitar la recuperación. Intenta de nuevo.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(values: z.infer<typeof passwordUpdateSchema>) {
    setBusy(true);
    setFormError(null);
    try {
      await updatePassword(values.password);
      toast.success("Contraseña actualizada");
      router.replace("/dashboard");
    } catch {
      setFormError(
        "No fue posible actualizar la contraseña. Solicita otro enlace de recuperación.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-intro">
        <div className="login-brand">
          <InstitutionalMark />
          <strong>
            GOBIERNO DEL
            <br />
            ESTADO DE COLIMA
          </strong>
        </div>
        <div>
          <p className="eyebrow">PLATAFORMA INSTITUCIONAL</p>
          <h1>
            Administración y consulta
            <br />
            de validaciones.
          </h1>
          <p>
            Administración, trazabilidad y seguimiento de documentos vehiculares
            en un solo lugar.
          </p>
          <div className="login-rule" />
          <span>COLIMA 2027 · CONTROL DOCUMENTAL</span>
        </div>
        <small>Uso exclusivo de personal autorizado.</small>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <Badge variant="outline">ACCESO INSTITUCIONAL</Badge>
          <h2>{title}</h2>
          <p>{description}</p>
          {!loading && !configured && (
            <Notice error="Supabase no está configurado. Solicita al administrador la conexión de la plataforma." />
          )}
          <Notice error={(passwordRecovery ? null : formError) || error} />
          {passwordRecovery ? (
            <form
              method="post"
              onSubmit={passwordForm.handleSubmit(changePassword)}
            >
              <FieldGroup>
                <Field data-invalid={!!passwordForm.formState.errors.password}>
                  <FieldLabel htmlFor="new-password">Nueva contraseña</FieldLabel>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register("password")}
                    aria-invalid={!!passwordForm.formState.errors.password}
                  />
                  <FieldError>
                    {passwordForm.formState.errors.password?.message}
                  </FieldError>
                </Field>
                <Field
                  data-invalid={!!passwordForm.formState.errors.confirmPassword}
                >
                  <FieldLabel htmlFor="confirm-password">
                    Confirmar contraseña
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register("confirmPassword")}
                    aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                  />
                  <FieldError>
                    {passwordForm.formState.errors.confirmPassword?.message}
                  </FieldError>
                </Field>
                <Button type="submit" disabled={busy || !configured}>
                  {busy ? "Actualizando…" : "Actualizar contraseña"}
                </Button>
              </FieldGroup>
            </form>
          ) : (
            <form
              method="post"
              onSubmit={
                showRecovery
                  ? (event) => {
                      event.preventDefault();
                      void recover();
                    }
                  : form.handleSubmit(submit)
              }
            >
              <FieldGroup>
                <Field data-invalid={!!form.formState.errors.email}>
                  <FieldLabel htmlFor="email">Correo institucional</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="nombre@colima.gob.mx"
                    {...form.register("email")}
                    aria-invalid={!!form.formState.errors.email}
                  />
                  <FieldError>
                    {form.formState.errors.email?.message}
                  </FieldError>
                </Field>
                {!showRecovery && (
                  <Field data-invalid={!!form.formState.errors.password}>
                    <div className="field-heading">
                      <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                      <button
                        type="button"
                        onClick={() => {
                          setRecovery(true);
                          setFormError(null);
                        }}
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      {...form.register("password")}
                      aria-invalid={!!form.formState.errors.password}
                    />
                    <FieldError>
                      {form.formState.errors.password?.message}
                    </FieldError>
                  </Field>
                )}
                <Button
                  type="submit"
                  disabled={busy || loading || !configured}
                >
                  {busy
                    ? "Procesando…"
                    : showRecovery
                      ? "Enviar instrucciones"
                      : "Iniciar sesión"}
                  <ArrowRight data-icon="inline-end" />
                </Button>
                {showRecovery && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRecovery(false)}
                  >
                    Volver al inicio de sesión
                  </Button>
                )}
              </FieldGroup>
            </form>
          )}
          <p className="login-help">
            <ShieldCheck />
            El acceso requiere un perfil institucional activo.
          </p>
        </div>
        <small>© 2027 Gobierno del Estado de Colima</small>
      </section>
    </div>
  );
}

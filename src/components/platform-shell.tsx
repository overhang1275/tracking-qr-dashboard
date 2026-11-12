"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Menu,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  PanelLeftClose,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-data";
import { DEFAULT_INSTITUTION_NAME } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import "./platform.css";
import { InstitutionalMark } from "./institutional-mark";

import {
  label,
  errorText,
  navigation,
  Notice,
  Loading,
} from "./platform-shared";
export function PlatformShell({ children }: { children: ReactNode }) {
  const { profile, user, loading, error, configured, logout } = useAuth();
  const { settings } = useSettings();
  const institutionName = settings?.name || DEFAULT_INSTITUTION_NAME;
  const router = useRouter();
  const path = usePathname().replace(/\/$/, "") || "/";
  const { resolvedTheme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const current = navigation.find((n) => n.href === path);
  const sectionName = current?.name ?? "Inicio";
  useEffect(() => {
    if (profile) document.title = `${sectionName} | ${institutionName}`;
  }, [sectionName, institutionName, profile]);
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  if (loading)
    return (
      <div className="auth-loading">
        <Loading />
      </div>
    );
  if (!configured)
    return (
      <div className="auth-loading">
        <Notice error="La conexión con Firebase no está configurada. Revisa las variables de entorno de la plataforma." />
      </div>
    );
  if (!profile)
    return (
      <div className="auth-loading">
        <Notice error={error} />
        <p>Redirigiendo al acceso…</p>
        <Link href="/login">Ir al acceso</Link>
      </div>
    );
  const canAccess =
    profile.role !== "VALIDADOR" &&
    !(path === "/usuarios" && profile.role !== "ADMINISTRADOR");
  async function handleLogout() {
    try {
      await logout();
      router.replace("/login");
    } catch (e) {
      toast.error(errorText(e));
    }
  }
  return (
    <TooltipProvider>
      <div
        className={`platform ${collapsed ? "sidebar-collapsed" : ""} ${mobile ? "mobile-nav-open" : ""}`}
      >
        {mobile && (
          <button
            className="nav-scrim"
            aria-label="Cerrar menú"
            onClick={() => setMobile(false)}
          />
        )}
        <aside className="sidebar">
          <Link
            href="/dashboard"
            className="brand"
            onClick={() => setMobile(false)}
          >
            <div className="brand-mark">
              <InstitutionalMark />
            </div>
            <span>
              COLIMA<span>PLATAFORMA INSTITUCIONAL</span>
            </span>
          </Link>
          <div className="sidebar-project">
            <span>CONTROL DOCUMENTAL</span>
            <strong>{institutionName}</strong>
            <small>Administración y seguimiento</small>
          </div>
          <nav aria-label="Navegación principal">
            {navigation
              .filter(
                (n) =>
                  profile.role !== "VALIDADOR" &&
                  !(n.href === "/usuarios" && profile.role !== "ADMINISTRADOR"),
              )
              .map((n) => (
                <Tooltip key={n.href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={n.href}
                      onClick={() => setMobile(false)}
                      className={
                        path === n.href ? "nav-item active" : "nav-item"
                      }
                      aria-current={path === n.href ? "page" : undefined}
                    >
                      <n.icon />
                      <span>{n.name}</span>
                      {path === n.href && (
                        <ChevronRight className="nav-chevron" />
                      )}
                    </Link>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right">{n.name}</TooltipContent>
                  )}
                </Tooltip>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="environment-dot" />
            <span>
              Conexión institucional
              <br />
              <small>Información en tiempo real</small>
            </span>
          </div>
          <Button
            variant="ghost"
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          >
            <PanelLeftClose />
            <span>Contraer menú</span>
          </Button>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumb">
              <Button
                variant="ghost"
                size="icon"
                className="mobile-menu"
                onClick={() => setMobile(!mobile)}
                aria-label="Abrir menú"
              >
                <Menu />
              </Button>
              <span className="institution-name" title={institutionName}>
                {institutionName}
              </span>
              <ChevronRight />
              <strong>{current?.name ?? "Inicio"}</strong>
            </div>
            <div className="topbar-actions">
              <Badge variant="outline">Ejercicio 2027</Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setTheme(resolvedTheme === "dark" ? "light" : "dark")
                    }
                    aria-label="Cambiar tema"
                  >
                    <Sun className="theme-sun" />
                    <Moon className="theme-moon" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cambiar tema</TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="user-button">
                    <span className="user-avatar">
                      {profile.firstName.charAt(0)}
                      {profile.lastName.charAt(0)}
                    </span>
                    <span className="user-name">
                      {profile.firstName} {profile.lastName}
                      <small>{label(profile.role)}</small>
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{profile.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => router.push("/configuracion")}
                    >
                      <UserRound />
                      Mi cuenta
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main id="main-content" className="main-content">
            {canAccess ? (
              children
            ) : (
              <Alert>
                <AlertTitle>Acceso restringido</AlertTitle>
                <AlertDescription>
                  Tu rol no tiene permisos para consultar esta sección.
                </AlertDescription>
              </Alert>
            )}
          </main>
          <footer className="platform-footer">
            <span>Gobierno del Estado de Colima</span>
            <span>Control y validación documental · 2027</span>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}

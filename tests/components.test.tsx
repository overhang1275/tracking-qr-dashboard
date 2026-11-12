import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import type {
  ValidationRecord,
  UserProfile,
  ApplicationSettings,
} from "@/types";
import type { ColumnDef } from "@tanstack/react-table";
const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  resetPassword: vi.fn(),
  configured: true,
  replace: vi.fn(),
  pathname: "/dashboard",
  profile: null as UserProfile | null,
  users: [] as UserProfile[],
  settings: null as ApplicationSettings | null,
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    login: mocks.login,
    resetPassword: mocks.resetPassword,
    user: mocks.profile ? { uid: mocks.profile.uid } : null,
    profile: mocks.profile,
    logout: vi.fn(),
    configured: mocks.configured,
    loading: false,
    error: null,
  }),
}));
vi.mock("@/hooks/use-data", () => ({
  useSettings: () => ({
    settings: mocks.settings,
    loading: false,
    error: null,
  }),
  useUsers: () => ({
    rows: mocks.users,
    loading: false,
    error: null,
    truncated: false,
  }),
  useValidations: () => ({
    rows: [],
    loading: false,
    error: null,
    truncated: false,
  }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => mocks.pathname,
}));
import {
  DataTable,
  Notice,
  validationColumns,
  useFilteredValidations,
  ValidationFilters,
} from "@/components/platform-shared";
import { PlatformShell } from "@/components/platform-shell";
import { UsersPage } from "@/components/platform-users";
import { LoginPage } from "@/components/platform-login";
const columns: ColumnDef<{ name: string }>[] = [
  { accessorKey: "name", header: "Nombre" },
];
describe("institutional UI", () => {
  beforeEach(() => {
    mocks.configured = true;
    mocks.profile = null;
    mocks.pathname = "/dashboard";
    mocks.users = [];
    mocks.settings = null;
    vi.clearAllMocks();
  });
  const admin: UserProfile = {
    uid: "admin-uid",
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.test",
    role: "ADMINISTRADOR",
    status: "active",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    createdBy: "bootstrap",
  };
  it("denies supervisor access to the trailing-slash users route", () => {
    mocks.profile = { ...admin, role: "SUPERVISOR" };
    mocks.pathname = "/usuarios/";
    render(
      <PlatformShell>
        <p>Directorio confidencial</p>
      </PlatformShell>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Acceso restringido");
    expect(
      screen.queryByText("Directorio confidencial"),
    ).not.toBeInTheDocument();
  });
  it("keeps the active navigation and breadcrumb on exported users routes", () => {
    mocks.profile = admin;
    mocks.pathname = "/usuarios/";
    render(
      <PlatformShell>
        <p>Directorio permitido</p>
      </PlatformShell>,
    );
    expect(screen.getByRole("link", { name: "Usuarios" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("banner")).toHaveTextContent("Usuarios");
    expect(screen.getByText("Directorio permitido")).toBeInTheDocument();
  });
  it("shows saved institutional names and updates the browser title", () => {
    mocks.profile = admin;
    mocks.settings = {
      name: "Autenticación Colima",
      updatedAt: 1,
      updatedBy: admin.uid,
    };
    const { rerender } = render(
      <PlatformShell>
        <p>Contenido</p>
      </PlatformShell>,
    );
    expect(screen.getByRole("banner")).toHaveTextContent(
      "Autenticación Colima",
    );
    expect(document.title).toBe("Resumen | Autenticación Colima");
    mocks.settings = {
      ...mocks.settings,
      name: "Control Vehicular Institucional",
    };
    rerender(
      <PlatformShell>
        <p>Contenido</p>
      </PlatformShell>,
    );
    expect(screen.getByRole("banner")).toHaveTextContent(
      "Control Vehicular Institucional",
    );
    expect(document.title).toBe("Resumen | Control Vehicular Institucional");
    expect(screen.queryByText("Autenticación Colima")).not.toBeInTheDocument();
  });
  it("includes account creation and singular directory count", () => {
    mocks.profile = admin;
    mocks.users = [admin];
    render(<UsersPage />);
    expect(
      screen.getByRole("button", { name: "Fecha de creación" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 usuario en el directorio consultado."),
    ).toBeInTheDocument();
  });
  it("shows an honest empty state", () => {
    render(<DataTable data={[]} columns={columns} />);
    expect(screen.getByText("Sin registros")).toBeInTheDocument();
    expect(screen.getByText("0 registros")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Página siguiente" }),
    ).toBeDisabled();
  });
  it("paginates and sorts actual records", () => {
    render(
      <DataTable
        data={Array.from({ length: 12 }, (_, i) => ({
          name: `Persona ${String(i + 1).padStart(2, "0")}`,
        }))}
        columns={columns}
      />,
    );
    expect(screen.getByText("1–10 de 12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(screen.getByText("11–12 de 12")).toBeInTheDocument();
    expect(screen.getByText("Persona 12")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filas por página"), {
      target: { value: "20" },
    });
    expect(screen.getByText("1–12 de 12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nombre" }));
    fireEvent.click(screen.getByRole("button", { name: "Nombre" }));
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("Persona 12");
  });
  it("shows complete validation columns and a smaller recent view", () => {
    const record: ValidationRecord = {
      id: "validation-123",
      userId: "staff-456",
      folio: "FOLIO-12",
      documentType: "soporte_vehicular",
      elementType: "escudo_invisible",
      reportedResult: "valid",
      timestamp: 1700000000000,
      application: "Colima 2027",
      appVersion: "1.2.0",
    };
    const view = render(
      <DataTable data={[record]} columns={validationColumns()} />,
    );
    expect(screen.getByText("validation-123")).toHaveAttribute(
      "title",
      "validation-123",
    );
    expect(screen.getByText("staff-456")).toHaveAttribute("title", "staff-456");
    expect(screen.getByText("Escudo invisible")).toBeInTheDocument();
    expect(screen.getByText("Colima 2027")).toBeInTheDocument();
    view.rerender(
      <DataTable
        data={[record]}
        columns={validationColumns(undefined, false)}
      />,
    );
    expect(screen.queryByText("validation-123")).not.toBeInTheDocument();
    expect(screen.queryByText("Colima 2027")).not.toBeInTheDocument();
    expect(screen.getByText("Escudo invisible")).toBeInTheDocument();
  });
  it("initializes date filters from the local calendar near midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 2, 23, 30));
    function DateFilters() {
      const state = useFilteredValidations();
      return <ValidationFilters state={state} />;
    }
    try {
      render(<DateFilters />);
      expect(screen.getByLabelText("Desde")).toHaveValue("2026-12-04");
      expect(screen.getByLabelText("Hasta")).toHaveValue("2027-01-02");
    } finally {
      vi.useRealTimers();
    }
  });
  it("renders connection failures as alerts", () => {
    render(<Notice error="Permiso denegado" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Permiso denegado");
  });
  it("prevents login when Firebase is missing", () => {
    mocks.configured = false;
    render(<LoginPage />);
    expect(
      screen.getByRole("button", { name: "Iniciar sesión" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Firebase no está configurado",
    );
  });
  it("validates credentials before contacting authentication", async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() =>
      expect(screen.getByText("Ingresa un correo válido")).toBeInTheDocument(),
    );
    expect(mocks.login).not.toHaveBeenCalled();
  });
  it("sends recovery only after collecting a valid email", async () => {
    render(<LoginPage />);
    fireEvent.click(
      screen.getByRole("button", { name: "¿Olvidaste tu contraseña?" }),
    );
    fireEvent.change(screen.getByLabelText("Correo institucional"), {
      target: { value: "staff@example.test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar instrucciones" }),
    );
    await waitFor(() =>
      expect(mocks.resetPassword).toHaveBeenCalledWith("staff@example.test"),
    );
  });
});

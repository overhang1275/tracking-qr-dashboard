"use client";

import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/hooks/use-auth";
import { useAuditLogs } from "@/hooks/use-data";
import { type ValidationRecord } from "@/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import "./platform.css";

import {
  label,
  date,
  Notice,
  Loading,
  Status,
  PageTitle,
  DataTable,
  useFilteredValidations,
  ValidationFilters,
  Scope,
} from "./platform-shared";
function OperationalLog() {
  const state = useFilteredValidations();
  const columns: ColumnDef<ValidationRecord>[] = [
    {
      accessorKey: "timestamp",
      header: "Fecha y hora",
      cell: ({ getValue }) => date(Number(getValue())),
    },
    {
      accessorKey: "userId",
      header: "Usuario",
      cell: ({ getValue }) => (
        <span className="mono">{String(getValue())}</span>
      ),
    },
    { accessorKey: "folio", header: "Folio" },
    {
      accessorKey: "elementType",
      header: "Elemento",
      cell: ({ getValue }) => label(String(getValue())),
    },
    {
      accessorKey: "reportedResult",
      header: "Resultado",
      cell: ({ getValue }) => <Status value={String(getValue())} />,
    },
    {
      accessorKey: "application",
      header: "Aplicación",
      cell: ({ row }) => (
        <span>
          {row.original.application}
          <small className="block muted">{row.original.appVersion}</small>
        </span>
      ),
    },
  ];
  return (
    <>
      <ValidationFilters state={state} />
      <Notice error={state.error} />
      {state.loading ? (
        <Loading />
      ) : (
        <DataTable data={state.rows} columns={columns} />
      )}
      <Scope count={state.rows.length} truncated={state.truncated} />
    </>
  );
}
function AdministrativeLog() {
  const data = useAuditLogs();
  const [search, setSearch] = useState("");
  const rows = data.rows.filter((r) =>
    `${r.actorUid} ${r.action} ${r.targetId} ${r.details}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    {
      accessorKey: "timestamp",
      header: "Fecha y hora",
      cell: ({ getValue }) => date(Number(getValue())),
    },
    {
      accessorKey: "actorUid",
      header: "Administrador",
      cell: ({ getValue }) => (
        <span className="mono">{String(getValue())}</span>
      ),
    },
    {
      accessorKey: "action",
      header: "Acción",
      cell: ({ getValue }) => (
        <Badge variant="outline">
          {(
            {
              "user.create": "Creación de usuario",
              "user.update": "Actualización de usuario",
              "settings.update": "Cambio de configuración",
            } as Record<string, string>
          )[String(getValue())] ?? String(getValue())}
        </Badge>
      ),
    },
    { accessorKey: "details", header: "Detalle" },
    {
      accessorKey: "targetId",
      header: "Referencia",
      cell: ({ getValue }) => (
        <span className="mono">{String(getValue())}</span>
      ),
    },
  ];
  return (
    <>
      <Input
        aria-label="Buscar eventos administrativos"
        placeholder="Buscar por administrador, acción o referencia…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Notice error={data.error} />
      {data.loading ? <Loading /> : <DataTable data={rows} columns={columns} />}
      <Scope count={rows.length} truncated={data.truncated} />
    </>
  );
}
export function AuditPage() {
  const { profile } = useAuth();
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="TRAZABILIDAD"
        title="Bitácora"
        description="Seguimiento de eventos operativos y cambios administrativos."
      />
      <Card>
        <CardHeader>
          <CardTitle>Registro de eventos</CardTitle>
          <CardDescription>
            Los eventos operativos proceden de las validaciones recibidas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="operations">
            <TabsList>
              <TabsTrigger value="operations">Eventos operativos</TabsTrigger>
              {profile?.role !== "VALIDADOR" && (
                <TabsTrigger value="admin">Cambios administrativos</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="operations" className="tab-content">
              <OperationalLog />
            </TabsContent>
            {profile?.role !== "VALIDADOR" && (
              <TabsContent value="admin" className="tab-content">
                <AdministrativeLog />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

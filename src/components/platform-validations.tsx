"use client";

import { useMemo, useState } from "react";
import { type ValidationRecord } from "@/types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import "./platform.css";

import {
  Notice,
  Loading,
  PageTitle,
  DataTable,
  validationColumns,
  ValidationDetail,
  useFilteredValidations,
  ValidationFilters,
  Scope,
} from "./platform-shared";
export function ValidationsPage() {
  const state = useFilteredValidations();
  const [selected, setSelected] = useState<ValidationRecord | null>(null);
  const columns = useMemo(() => validationColumns(setSelected), []);
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="CONTROL DOCUMENTAL"
        title="Validaciones"
        description="Consulta y verifica la actividad registrada desde la aplicación móvil."
      />
      <Card>
        <CardHeader>
          <CardTitle>Consulta de registros</CardTitle>
          <CardDescription>
            Filtra por documento, resultado y periodo de validación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ValidationFilters state={state} />
        </CardContent>
      </Card>
      <Notice error={state.error} />
      <Card>
        <CardHeader className="card-header-row">
          <div>
            <CardTitle>Historial de validaciones</CardTitle>
            <CardDescription>
              Selecciona un folio para consultar su detalle.
            </CardDescription>
          </div>
          <Badge variant="secondary">{state.rows.length} registros</Badge>
        </CardHeader>
        <CardContent>
          {state.loading ? (
            <Loading />
          ) : (
            <DataTable data={state.rows} columns={columns} />
          )}
          <Scope count={state.rows.length} truncated={state.truncated} />
        </CardContent>
      </Card>
      <ValidationDetail record={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

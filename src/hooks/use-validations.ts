"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Clear stale rows when the access scope or date range changes. */
import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { mapValidationRow } from "../lib/supabase-mappers";
import type { ValidationRecord } from "../types";
import { useAuth } from "./use-auth";

export const VALIDATION_LIMIT = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export function useValidations({
  start,
  end,
}: { start?: number; end?: number } = {}) {
  const { profile } = useAuth();
  const profileUid = profile?.uid;
  const profileRole = profile?.role;
  const [rows, setRows] = useState<ValidationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultEnd] = useState(() => Date.now());
  const from = start ?? defaultEnd - 30 * DAY_MS;

  useEffect(() => {
    setRows([]);
    setError(null);
    const supabase = getSupabase();
    if (!supabase || !profileUid || profileRole === "VALIDADOR") {
      setLoading(false);
      return;
    }
    if (!Number.isFinite(from) || (end !== undefined && (!Number.isFinite(end) || from > end))) {
      setError("El intervalo de fechas no es válido.");
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      let request = supabase
        .from("validations")
        .select(
          "id,user_id,folio,document_type,element_type,reported_result,created_at,application,app_version",
        )
        .gte("created_at", new Date(from).toISOString())
        .order("created_at", { ascending: false })
        .limit(VALIDATION_LIMIT);
      if (end !== undefined) request = request.lte("created_at", new Date(end).toISOString());
      const { data, error: queryError } = await request;
      if (!active) return;
      if (queryError) {
        setRows([]);
        setError("No fue posible cargar las validaciones.");
      } else {
        setRows((data ?? []).map(mapValidationRow));
        setError(null);
      }
      setLoading(false);
    };

    setLoading(true);
    void load();
    const subscription = supabase
      .channel(`validations:${profileUid}:${from}:${end ?? "open"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "validations" },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(subscription);
    };
  }, [profileUid, profileRole, from, end]);

  return { rows, loading, error, truncated: rows.length === VALIDATION_LIMIT };
}

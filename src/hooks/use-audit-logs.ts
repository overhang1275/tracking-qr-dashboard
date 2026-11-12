"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Clear stale rows when the access scope changes. */
import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { mapAuditRow } from "../lib/supabase-mappers";
import type { AuditLog } from "../types";
import { useAuth } from "./use-auth";

const AUDIT_LIMIT = 500;

export function useAuditLogs() {
  const { profile } = useAuth();
  const profileUid = profile?.uid;
  const profileRole = profile?.role;
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows([]);
    setError(null);
    const supabase = getSupabase();
    if (!supabase || !profileUid || profileRole === "VALIDADOR") {
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      const { data, error: queryError } = await supabase
        .from("audit_logs")
        .select("id,actor_id,action,target_id,created_at,details")
        .order("created_at", { ascending: false })
        .limit(AUDIT_LIMIT);
      if (!active) return;
      if (queryError) {
        setRows([]);
        setError("No fue posible cargar la auditoría.");
      } else {
        setRows((data ?? []).map(mapAuditRow));
        setError(null);
      }
      setLoading(false);
    };

    setLoading(true);
    void load();
    const subscription = supabase
      .channel(`audit:${profileUid}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(subscription);
    };
  }, [profileRole, profileUid]);

  return { rows, loading, error, truncated: rows.length === AUDIT_LIMIT };
}

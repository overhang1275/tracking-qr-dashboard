"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Clear stale rows when the role or session changes. */
import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { mapProfileRow } from "../lib/supabase-mappers";
import type { UserProfile } from "../types";
import { useAuth } from "./use-auth";

const USER_LIMIT = 200;

export function useUsers() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows([]);
    setError(null);
    const supabase = getSupabase();
    if (!supabase || profile?.role !== "ADMINISTRADOR") {
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select(
          "id,first_name,last_name,email,role,status,created_at,updated_at,created_by,last_access",
        )
        .order("created_at", { ascending: false })
        .limit(USER_LIMIT);
      if (!active) return;
      if (queryError) {
        setRows([]);
        setError("No fue posible cargar los usuarios.");
      } else {
        setRows((data ?? []).map(mapProfileRow));
        setError(null);
      }
      setLoading(false);
    };

    setLoading(true);
    void load();
    const subscription = supabase
      .channel(`users:${profile.uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(subscription);
    };
  }, [profile?.role, profile?.uid]);

  return { rows, loading, error, truncated: rows.length === USER_LIMIT };
}

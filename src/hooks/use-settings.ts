"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Clear prior settings when the session changes. */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSupabase } from "../lib/supabase";
import { mapSettingsRow } from "../lib/supabase-mappers";
import type { ApplicationSettings } from "../types";
import { useAuth } from "./use-auth";

export const DEFAULT_INSTITUTION_NAME = "Plataforma Institucional Colima 2027";

interface SettingsState {
  settings: ApplicationSettings | null;
  loading: boolean;
  error: string | null;
}

const SettingsContext = createContext<SettingsState | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<ApplicationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = profile?.uid;
  const allowed = Boolean(profile && profile.role !== "VALIDADOR");

  useEffect(() => {
    setSettings(null);
    setError(null);
    const supabase = getSupabase();
    if (!supabase || !uid || !allowed) {
      setLoading(false);
      return;
    }

    let active = true;
    const load = async () => {
      const { data, error: queryError } = await supabase
        .from("institution_settings")
        .select("institution_name,updated_at,updated_by")
        .eq("id", true)
        .maybeSingle();
      if (!active) return;
      if (queryError || !data) {
        setSettings(null);
        setError("No fue posible cargar la configuración.");
      } else {
        setSettings(mapSettingsRow(data));
        setError(null);
      }
      setLoading(false);
    };

    setLoading(true);
    void load();
    const subscription = supabase
      .channel(`settings:${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "institution_settings", filter: "id=eq.true" },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(subscription);
    };
  }, [uid, allowed]);

  return createElement(
    SettingsContext.Provider,
    { value: { settings, loading, error } },
    children,
  );
}

export function useSettings() {
  const state = useContext(SettingsContext);
  if (!state) throw new Error("useSettings requiere SettingsProvider");
  return state;
}

"use client";
/* eslint-disable react-hooks/set-state-in-effect -- Clear previous subscription data whenever access or query scope changes. */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onValue, ref } from "firebase/database";
import { getFirebase } from "../lib/firebase";
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
    if (!uid || !allowed) {
      setLoading(false);
      return;
    }
    const client = getFirebase();
    if (!client) return;
    setLoading(true);
    return onValue(
      ref(client.db, "settings/institution"),
      (snapshot) => {
        setSettings(snapshot.val());
        setLoading(false);
      },
      () => {
        setError("No fue posible cargar la configuración.");
        setLoading(false);
      },
    );
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

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel, Session, User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "../lib/supabase";
import { mapProfileRow } from "../lib/supabase-mappers";
import type { UserProfile } from "../types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
  passwordRecovery: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const PROFILE_TIMEOUT_MESSAGE =
  "No fue posible verificar tu acceso institucional: la conexión tardó demasiado. Vuelve a intentarlo.";
const MISSING_PROFILE_MESSAGE =
  "Tu cuenta no tiene acceso institucional porque falta el perfil institucional autorizado. Solicita su alta al administrador.";
const INACTIVE_PROFILE_MESSAGE =
  "Tu cuenta no tiene acceso institucional activo. Contacta a un administrador.";
const AuthContext = createContext<AuthState | null>(null);

async function withProfileTimeout<T>(operation: PromiseLike<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(PROFILE_TIMEOUT_MESSAGE)),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const configured = supabaseConfigured();
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const channel = useRef<RealtimeChannel | null>(null);
  const requestId = useRef(0);

  const clearChannel = useCallback(() => {
    const supabase = getSupabase();
    if (channel.current && supabase) void supabase.removeChannel(channel.current);
    channel.current = null;
  }, []);
  const invalidatePendingRequests = useCallback(() => {
    requestId.current++;
  }, []);

  const applySession = useCallback(
    async (session: Session | null) => {
      const supabase = getSupabase();
      if (!supabase) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const currentRequest = ++requestId.current;
      clearChannel();
      setError(null);
      if (!session) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data, error: readError } = await withProfileTimeout(
          supabase
            .from("profiles")
            .select(
              "id,first_name,last_name,email,role,status,created_at,updated_at,created_by,last_access",
            )
            .eq("id", session.user.id)
            .maybeSingle(),
        );
        if (currentRequest !== requestId.current) return;
        if (readError) throw new Error(MISSING_PROFILE_MESSAGE);
        if (!data) throw new Error(MISSING_PROFILE_MESSAGE);
        if (data.status !== "active") throw new Error(INACTIVE_PROFILE_MESSAGE);

        const { data: accessedAt } = await supabase.rpc("record_profile_access");
        if (currentRequest !== requestId.current) return;
        const nextProfile = mapProfileRow({
          ...data,
          last_access: accessedAt ?? data.last_access,
        });
        setUser(session.user);
        setProfile(nextProfile);
        setLoading(false);

        channel.current = supabase
          .channel(`profile-${session.user.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profiles",
              filter: `id=eq.${session.user.id}`,
            },
            ({ new: updated }) => {
              if (currentRequest !== requestId.current) return;
              const row = updated as typeof data;
              if (row.status !== "active") {
                setError(INACTIVE_PROFILE_MESSAGE);
                setUser(null);
                setProfile(null);
                void supabase.auth.signOut();
                return;
              }
              setProfile(mapProfileRow(row));
            },
          )
          .subscribe();
      } catch (cause) {
        if (currentRequest !== requestId.current) return;
        setError(
          cause instanceof Error ? cause.message : MISSING_PROFILE_MESSAGE,
        );
        setUser(null);
        setProfile(null);
        setLoading(false);
        await supabase.auth.signOut();
        throw cause instanceof Error ? cause : new Error(MISSING_PROFILE_MESSAGE);
      }
    },
    [clearChannel],
  );

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      return;
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        queueMicrotask(() => void applySession(session).catch(() => {}));
      } else if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
        queueMicrotask(() => void applySession(session).catch(() => {}));
      } else if (event === "SIGNED_OUT") {
        invalidatePendingRequests();
        clearChannel();
        setUser(null);
        setProfile(null);
        setPasswordRecovery(false);
        setLoading(false);
      }
    });
    return () => {
      invalidatePendingRequests();
      clearChannel();
      data.subscription.unsubscribe();
    };
  }, [applySession, clearChannel, invalidatePendingRequests]);

  const login = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabase();
      if (!supabase) throw new Error("Configura la conexión con Supabase.");
      setError(null);
      setLoading(true);
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
      if (signInError || !data.session) {
        setLoading(false);
        const message = signInError?.message ?? "No se recibió una sesión válida.";
        setError(message);
        throw new Error(message);
      }
      await applySession(data.session);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    clearChannel();
    setUser(null);
    setProfile(null);
    setError(null);
    setPasswordRecovery(false);
    await supabase.auth.signOut();
  }, [clearChannel]);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Configura la conexión con Supabase.");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/login` },
    );
    if (resetError) throw resetError;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Configura la conexión con Supabase.");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) throw updateError;
    setPasswordRecovery(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        configured,
        passwordRecovery,
        login,
        logout,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requiere AuthProvider");
  return value;
}

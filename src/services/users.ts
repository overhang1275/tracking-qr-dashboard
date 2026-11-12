import { createSignupClient, requireSupabase } from "../lib/supabase";
import {
  createUserSchema,
  profileInputSchema,
  type CreateUserInput,
  type ProfileInput,
} from "../lib/schemas";

async function requireActiveAdministrator(actorUid: string) {
  const supabase = requireSupabase();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user?.id !== actorUid)
    throw new Error("Solo un administrador activo puede gestionar cuentas.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role,status")
    .eq("id", actorUid)
    .maybeSingle();
  if (error || profile?.role !== "ADMINISTRADOR" || profile.status !== "active")
    throw new Error("Solo un administrador activo puede gestionar cuentas.");
  return supabase;
}

export async function createUser(input: CreateUserInput, actorUid: string) {
  const parsed = createUserSchema.parse(input);
  const supabase = await requireActiveAdministrator(actorUid);
  const signup = createSignupClient();
  let newUserId: string | undefined;

  try {
    const { data, error } = await signup.auth.signUp({
      email: parsed.email,
      password: parsed.password,
      options: {
        data: { first_name: parsed.firstName, last_name: parsed.lastName },
      },
    });
    if (error) throw error;
    if (!data.user || data.user.identities?.length === 0)
      throw new Error("No se recibió un usuario nuevo desde Supabase Auth.");
    newUserId = data.user.id;

    const { error: profileError } = await supabase.rpc("admin_create_profile", {
      p_id: newUserId,
      p_first_name: parsed.firstName,
      p_last_name: parsed.lastName,
      p_email: parsed.email,
      p_role: parsed.role,
      p_status: parsed.status,
    });
    if (profileError)
      throw new Error(
        `Auth creó la cuenta, pero no se guardó su perfil institucional (UID ${newUserId}). Revisa la cuenta en Supabase Auth antes de reintentar.`,
        { cause: profileError },
      );
    return newUserId;
  } finally {
    await signup.auth.signOut();
  }
}

export async function updateUser(
  uid: string,
  input: ProfileInput,
  actorUid: string,
) {
  const parsed = profileInputSchema.parse(input);
  const supabase = await requireActiveAdministrator(actorUid);
  const { error } = await supabase.rpc("admin_update_profile", {
    p_id: uid,
    p_first_name: parsed.firstName,
    p_last_name: parsed.lastName,
    p_role: parsed.role,
    p_status: parsed.status,
  });
  if (error) throw error;
}

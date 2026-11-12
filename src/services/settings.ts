import { requireSupabase } from "../lib/supabase";
import { settingsSchema } from "../lib/schemas";

export async function saveSettings(name: string, actorUid: string) {
  const parsed = settingsSchema.parse({ name });
  const supabase = requireSupabase();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || data.user?.id !== actorUid)
    throw new Error("Solo un administrador activo puede cambiar la configuración.");

  const { error } = await supabase.rpc("admin_update_institution_name", {
    p_name: parsed.name,
  });
  if (error) throw error;
}

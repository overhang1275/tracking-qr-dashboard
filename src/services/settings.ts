import { push, ref, serverTimestamp, update } from "firebase/database";
import { requireFirebase } from "../lib/firebase";
import { settingsSchema } from "../lib/schemas";
export async function saveSettings(name: string, actorUid: string) {
  const parsed = settingsSchema.parse({ name });
  const { db } = requireFirebase();
  const id = push(ref(db, "auditLogs")).key!;
  await update(ref(db), {
    "settings/institution": {
      name: parsed.name,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    },
    [`auditLogs/${id}`]: {
      actorUid,
      action: "settings.update",
      targetId: "institution",
      timestamp: serverTimestamp(),
      details: `Nombre de aplicación: ${parsed.name}`,
    },
  });
}

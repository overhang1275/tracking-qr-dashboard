import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signOut,
} from "firebase/auth";
import { get, push, ref, serverTimestamp, update } from "firebase/database";
import {
  emulatorHost,
  getFirebaseOptions,
  requireFirebase,
} from "../lib/firebase";
import {
  createUserSchema,
  profileInputSchema,
  type CreateUserInput,
  type ProfileInput,
} from "../lib/schemas";
export async function createUser(input: CreateUserInput, actorUid: string) {
  const parsed = createUserSchema.parse(input);
  const { db, auth: primaryAuth } = requireFirebase();
  if (primaryAuth.currentUser?.uid !== actorUid)
    throw new Error("Solo un administrador activo puede crear cuentas.");
  const actor = (await get(ref(db, `users/${actorUid}`))).val();
  if (actor?.role !== "ADMINISTRADOR" || actor.status !== "active")
    throw new Error("Solo un administrador activo puede crear cuentas.");
  const options = getFirebaseOptions();
  if (!options) throw new Error("Configura Firebase.");
  const app = initializeApp(options, `create-user-${crypto.randomUUID()}`);
  const auth = getAuth(app);
  try {
    if (process.env.NEXT_PUBLIC_USE_EMULATORS === "true")
      connectAuthEmulator(auth, `http://${emulatorHost()}:9099`, {
        disableWarnings: true,
      });
    await setPersistence(auth, inMemoryPersistence);
    const credential = await createUserWithEmailAndPassword(
      auth,
      parsed.email,
      parsed.password,
    );
    const profile = profileInputSchema.parse(parsed);
    const auditId = push(ref(db, "auditLogs")).key!;
    try {
      await update(ref(db), {
        [`users/${credential.user.uid}`]: {
          ...profile,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: actorUid,
        },
        [`auditLogs/${auditId}`]: {
          actorUid,
          action: "user.create",
          targetId: credential.user.uid,
          timestamp: serverTimestamp(),
          details: `Cuenta creada: ${profile.email}`,
        },
      });
    } catch (error) {
      try {
        await deleteUser(credential.user);
      } catch {
        throw new Error(
          `No se guardó el perfil y no se pudo eliminar la cuenta Auth ${credential.user.uid}. Un administrador debe eliminarla antes de reintentar.`,
        );
      }
      throw error;
    }
    return credential.user.uid;
  } finally {
    try {
      await signOut(auth);
    } finally {
      await deleteApp(app);
    }
  }
}
export async function updateUser(
  uid: string,
  input: ProfileInput,
  actorUid: string,
) {
  const profile = profileInputSchema.parse(input);
  if (
    uid === actorUid &&
    (profile.role !== "ADMINISTRADOR" || profile.status !== "active")
  )
    throw new Error(
      "No puedes desactivar tu cuenta ni quitarte el rol de administrador.",
    );
  const { db } = requireFirebase();
  const existing = await get(ref(db, `users/${uid}`));
  if (!existing.exists()) throw new Error("El usuario ya no existe.");
  if (existing.val().email !== profile.email)
    throw new Error(
      "El correo de acceso no se puede modificar desde este panel.",
    );
  const auditId = push(ref(db, "auditLogs")).key!;
  await update(ref(db), {
    ...Object.fromEntries(
      Object.entries(profile).map(([key, value]) => [
        `users/${uid}/${key}`,
        value,
      ]),
    ),
    [`users/${uid}/updatedAt`]: serverTimestamp(),
    [`auditLogs/${auditId}`]: {
      actorUid,
      action: "user.update",
      targetId: uid,
      timestamp: serverTimestamp(),
      details: `Perfil actualizado: ${profile.email}`,
    },
  });
}

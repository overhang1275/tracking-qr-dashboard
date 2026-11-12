import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseOptions,
} from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
export function getFirebaseOptions(): FirebaseOptions | null {
  const emulator = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
  if (emulator)
    return {
      apiKey: "demo-api-key",
      authDomain: "demo-colima-2027.firebaseapp.com",
      projectId: "demo-colima-2027",
      databaseURL: "https://demo-colima-2027-default-rtdb.firebaseio.com",
      appId: "demo-colima-2027",
    };
  const options = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (!Object.values(options).every(Boolean)) return null;
  try {
    const url = new URL(options.databaseURL!);
    if (
      url.protocol !== "https:" ||
      !/\.(firebaseio\.com|firebasedatabase\.app)$/.test(url.hostname)
    )
      throw new Error("URL no válida");
  } catch {
    throw new Error(
      "NEXT_PUBLIC_FIREBASE_DATABASE_URL debe ser la URL HTTPS de Realtime Database, no un bucket de Storage. Cópiala desde Firebase Console > Realtime Database.",
    );
  }
  return options;
}
let client: {
  app: ReturnType<typeof initializeApp>;
  auth: ReturnType<typeof getAuth>;
  db: ReturnType<typeof getDatabase>;
} | null = null;
export function emulatorHost() {
  const host = process.env.NEXT_PUBLIC_EMULATOR_HOST || "127.0.0.1";
  if (!["localhost", "127.0.0.1"].includes(host))
    throw new Error("Los emuladores solo admiten un host local.");
  return host;
}
export function getFirebase() {
  if (typeof window === "undefined") return null;
  if (client) return client;
  const options = getFirebaseOptions();
  if (!options) return null;
  const emulator = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
  const host = emulator ? emulatorHost() : null;
  const app = getApps().some((item) => item.name === "[DEFAULT]")
    ? getApp()
    : initializeApp(options);
  const auth = getAuth(app);
  const db = getDatabase(app);
  if (host) {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectDatabaseEmulator(db, host, 9000);
  }
  client = { app, auth, db };
  return client;
}
export function requireFirebase() {
  const client = getFirebase();
  if (!client) throw new Error("Configura Firebase para continuar.");
  return client;
}

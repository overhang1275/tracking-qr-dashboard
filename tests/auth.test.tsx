import { StrictMode, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  observe: vi
    .fn<
      (
        auth: unknown,
        next: (user: { uid: string } | null) => void,
      ) => () => void
    >()
    .mockReturnValue(() => {}),
}));
vi.mock("../src/lib/firebase", () => ({
  getFirebase: () => ({ auth: {}, db: {} }),
  requireFirebase: () => ({ auth: {}, db: {} }),
}));
vi.mock("firebase/auth", () => ({
  browserLocalPersistence: {},
  onAuthStateChanged: mocks.observe,
  setPersistence: vi.fn().mockResolvedValue(undefined),
  signInWithEmailAndPassword: vi
    .fn()
    .mockResolvedValue({ user: { uid: "user" } }),
  signOut: mocks.signOut,
  sendPasswordResetEmail: vi.fn(),
}));
vi.mock("firebase/database", () => ({
  get: mocks.get,
  update: mocks.update,
  ref: vi.fn(() => ({})),
  serverTimestamp: () => ({ ".sv": "timestamp" }),
  onValue: vi.fn().mockReturnValue(() => {}),
}));
import { AuthProvider, useAuth } from "../src/hooks/use-auth";
afterEach(() => vi.clearAllMocks());
describe("institutional login denial", () => {
  it.each([null, { status: "inactive" }])(
    "clears session for missing or inactive profile: %s",
    async (profile) => {
      mocks.get.mockResolvedValue({ val: () => profile });
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
      await act(async () => {
        await expect(
          result.current.login("ana@example.com", "password"),
        ).rejects.toThrow("acceso institucional");
      });
      expect(mocks.signOut).toHaveBeenCalledOnce();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toContain("administrador");
    },
  );
  it("signs out when profile lookup is denied", async () => {
    mocks.get.mockRejectedValue(new Error("PERMISSION_DENIED"));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      await expect(
        result.current.login("ana@example.com", "password"),
      ).rejects.toThrow("acceso institucional");
    });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(result.current.loading).toBe(false);
  });
});

it("resolves the initial signed-out state under StrictMode effect replay", async () => {
  mocks.observe.mockImplementation((_auth, next) => {
    let active = true;
    queueMicrotask(() => {
      if (active) next(null);
    });
    return () => {
      active = false;
    };
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <AuthProvider>{children}</AuthProvider>
    </StrictMode>
  );
  const { result } = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.configured).toBe(true);
  expect(result.current.user).toBeNull();
});

it("reports missing institutional profiles separately from network failures", async () => {
  mocks.get.mockResolvedValue({ val: () => null });
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await act(async () => {
    await expect(
      result.current.login("ana@example.com", "password"),
    ).rejects.toThrow("falta el perfil institucional");
  });
  expect(result.current.error).toContain("falta el perfil institucional");
});

it("ends login and signs out when the profile read never completes", async () => {
  vi.useFakeTimers();
  try {
    mocks.get.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    let failure: unknown;
    let settled = false;
    await act(async () => {
      const login = result.current
        .login("ana@example.com", "password")
        .catch((error) => {
          failure = error;
        })
        .finally(() => {
          settled = true;
        });
      await vi.advanceTimersByTimeAsync(15001);
      if (settled) await login;
    });
    expect(settled).toBe(true);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain("tardó demasiado");
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(result.current.loading).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it("ends restored-session loading if the profile listener never responds", async () => {
  vi.useFakeTimers();
  mocks.observe.mockImplementation((_auth, next) => {
    queueMicrotask(() => next({ uid: "user" }));
    return () => {};
  });
  try {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15001);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(result.current.error).toContain("tardó demasiado");
    expect(mocks.signOut).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  authListener: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  removeChannel: vi.fn(),
  channel: {
    on: vi.fn(),
    subscribe: vi.fn(),
  },
}));

mocks.channel.on.mockReturnValue(mocks.channel);
mocks.channel.subscribe.mockReturnValue(mocks.channel);

vi.mock("../src/lib/supabase", () => ({
  getSupabase: () => ({
    auth: {
      onAuthStateChange: mocks.authListener,
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    }),
    rpc: mocks.rpc,
    channel: () => mocks.channel,
    removeChannel: mocks.removeChannel,
  }),
  supabaseConfigured: () => true,
}));

import { AuthProvider, useAuth } from "../src/hooks/use-auth";

const activeProfile = {
  id: "user-1",
  first_name: "Ana",
  last_name: "Sol",
  email: "ana@example.com",
  role: "VALIDADOR",
  status: "active",
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
  created_by: "admin-1",
  last_access: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile = activeProfile;
  mocks.authListener.mockImplementation((callback) => {
    queueMicrotask(() => callback("INITIAL_SESSION", null));
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mocks.signInWithPassword.mockResolvedValue({
    data: {
      user: { id: "user-1", email: "ana@example.com" },
      session: { user: { id: "user-1", email: "ana@example.com" } },
    },
    error: null,
  });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.maybeSingle.mockImplementation(async () => ({ data: mocks.profile, error: null }));
  mocks.rpc.mockResolvedValue({ data: "2026-11-12T00:00:00.000Z", error: null });
});

describe("Supabase institutional login", () => {
  it("accepts an active institutional profile and records last access", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login("ana@example.com", "secret");
    });

    expect(mocks.signInWithPassword).toHaveBeenCalledOnce();
    expect(mocks.maybeSingle).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(result.current.user?.id).toBe("user-1");
    expect(result.current.profile?.role).toBe("VALIDADOR");
    expect(mocks.rpc).toHaveBeenCalledWith("record_profile_access");
    expect(mocks.channel.subscribe).toHaveBeenCalledOnce();
  });

  it.each([
    [null, "falta el perfil institucional"],
    [{ ...activeProfile, status: "inactive" }, "acceso institucional activo"],
  ])("rejects missing or inactive profiles", async (profile, message) => {
    mocks.profile = profile;
    mocks.maybeSingle.mockImplementation(async () => ({ data: profile, error: null }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.login("ana@example.com", "secret")).rejects.toThrow(message);
    });

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(result.current.profile).toBeNull();
  });
});

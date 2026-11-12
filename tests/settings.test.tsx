import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider, useSettings } from "@/hooks/use-settings";

const mocks = vi.hoisted(() => ({
  profile: { uid: "admin", role: "ADMINISTRADOR" } as {
    uid: string;
    role: string;
  } | null,
  row: {} as { institution_name: string; updated_at: string; updated_by: string },
  onChange: vi.fn(),
  maybeSingle: vi.fn(),
  removeChannel: vi.fn(),
  channel: { on: vi.fn(), subscribe: vi.fn() },
}));

mocks.channel.on.mockImplementation((event, options, callback) => {
  mocks.onChange.mockImplementation(callback);
  return mocks.channel;
});
mocks.channel.subscribe.mockReturnValue(mocks.channel);

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ profile: mocks.profile }),
}));
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    }),
    channel: () => mocks.channel,
    removeChannel: mocks.removeChannel,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile = { uid: "admin", role: "ADMINISTRADOR" };
  mocks.row = {
    institution_name: "Institución de prueba",
    updated_at: "2026-11-12T00:00:00.000Z",
    updated_by: "admin",
  };
  mocks.maybeSingle.mockImplementation(async () => ({ data: mocks.row, error: null }));
  mocks.channel.on.mockImplementation((event, options, callback) => {
    mocks.onChange.mockImplementation(callback);
    return mocks.channel;
  });
  mocks.channel.subscribe.mockReturnValue(mocks.channel);
});

describe("shared institutional settings", () => {
  it("loads settings, refreshes from Realtime, and removes the channel", async () => {
    const { result, unmount } = renderHook(
      () => [useSettings(), useSettings()],
      { wrapper: SettingsProvider },
    );
    await waitFor(() =>
      expect(result.current[0].settings?.name).toBe("Institución de prueba"),
    );
    expect(mocks.channel.subscribe).toHaveBeenCalledOnce();

    mocks.row = {
      institution_name: "Nombre actualizado",
      updated_at: "2026-11-13T00:00:00.000Z",
      updated_by: "admin",
    };
    await act(async () => mocks.onChange());
    await waitFor(() =>
      expect(result.current[1].settings?.name).toBe("Nombre actualizado"),
    );

    unmount();
    expect(mocks.removeChannel).toHaveBeenCalledOnce();
  });

  it("clears settings and removes the channel when the session ends", async () => {
    const { result, rerender } = renderHook(() => useSettings(), {
      wrapper: SettingsProvider,
    });
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    mocks.profile = null;
    rerender();
    expect(result.current.settings).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mocks.removeChannel).toHaveBeenCalledOnce();
  });

  it("does not subscribe for Android-only validator accounts", () => {
    mocks.profile = { uid: "validator", role: "VALIDADOR" };
    const { result } = renderHook(() => useSettings(), {
      wrapper: SettingsProvider,
    });
    expect(mocks.channel.subscribe).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});

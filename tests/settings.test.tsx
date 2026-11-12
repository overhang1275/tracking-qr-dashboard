import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider, useSettings } from "@/hooks/use-settings";
const mocks = vi.hoisted(() => ({
  profile: { uid: "admin", role: "ADMINISTRADOR" } as {
    uid: string;
    role: string;
  } | null,
  subscribe: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ profile: mocks.profile }),
}));
vi.mock("@/lib/firebase", () => ({ getFirebase: () => ({ db: {} }) }));
vi.mock("firebase/database", () => ({
  ref: vi.fn(),
  onValue: mocks.subscribe,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.profile = { uid: "admin", role: "ADMINISTRADOR" };
  mocks.subscribe.mockReturnValue(mocks.stop);
});
describe("shared institutional settings", () => {
  it("uses one live listener for multiple consumers and cleans it up", () => {
    const { result, unmount } = renderHook(
      () => [useSettings(), useSettings()],
      { wrapper: SettingsProvider },
    );
    expect(mocks.subscribe).toHaveBeenCalledOnce();
    const next = mocks.subscribe.mock.calls[0][1];
    act(() =>
      next({
        val: () => ({
          name: "Institución de prueba",
          updatedAt: 1,
          updatedBy: "admin",
        }),
      }),
    );
    expect(result.current[0].settings?.name).toBe("Institución de prueba");
    expect(result.current[1].settings?.name).toBe("Institución de prueba");
    act(() =>
      next({
        val: () => ({
          name: "Nombre actualizado",
          updatedAt: 2,
          updatedBy: "admin",
        }),
      }),
    );
    expect(result.current[0].settings?.name).toBe("Nombre actualizado");
    unmount();
    expect(mocks.stop).toHaveBeenCalledOnce();
  });
  it("clears settings and removes the listener when the session ends", () => {
    const { result, rerender } = renderHook(() => useSettings(), {
      wrapper: SettingsProvider,
    });
    act(() =>
      mocks.subscribe.mock.calls[0][1]({
        val: () => ({ name: "Institución", updatedAt: 1, updatedBy: "admin" }),
      }),
    );
    mocks.profile = null;
    rerender();
    expect(result.current.settings).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mocks.stop).toHaveBeenCalledOnce();
  });
  it("does not subscribe for Android-only validator accounts", () => {
    mocks.profile = { uid: "validator", role: "VALIDADOR" };
    const { result } = renderHook(() => useSettings(), {
      wrapper: SettingsProvider,
    });
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});

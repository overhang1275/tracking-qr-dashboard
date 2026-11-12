import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "admin" } as { id: string } | null,
  role: "ADMINISTRADOR" as string,
  status: "active" as string,
  maybeSingle: vi.fn(),
  profileRpc: vi.fn(),
  signUp: vi.fn(),
  signupSignOut: vi.fn(),
}));

vi.mock("../src/lib/supabase", () => ({
  requireSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user }, error: null }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    }),
    rpc: mocks.profileRpc,
  }),
  createSignupClient: () => ({
    auth: { signUp: mocks.signUp, signOut: mocks.signupSignOut },
  }),
}));

import { createUser, updateUser } from "../src/services/users";

const input = {
  firstName: "Ana",
  lastName: "Sol",
  email: "ana@example.com",
  role: "AUDITOR" as const,
  status: "active" as const,
  password: "testing-password",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { id: "admin" };
  mocks.role = "ADMINISTRADOR";
  mocks.status = "active";
  mocks.maybeSingle.mockImplementation(async () => ({
    data: { role: mocks.role, status: mocks.status },
    error: null,
  }));
  mocks.signUp.mockResolvedValue({
    data: { user: { id: "new-user", identities: [{ id: "identity" }] } },
    error: null,
  });
  mocks.profileRpc.mockResolvedValue({ data: "new-user", error: null });
  mocks.signupSignOut.mockResolvedValue({ error: null });
});

afterEach(() => vi.clearAllMocks());

describe("Supabase user administration", () => {
  it("rejects a forged actor before creating an Auth account", async () => {
    await expect(createUser(input, "other")).rejects.toThrow("administrador");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it.each([
    ["SUPERVISOR", "active"],
    ["ADMINISTRADOR", "inactive"],
  ])("rejects a non-active administrator", async (role, status) => {
    mocks.role = role;
    mocks.status = status;
    await expect(createUser(input, "admin")).rejects.toThrow("administrador");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("creates Auth with an isolated client and writes the profile through the admin RPC", async () => {
    await expect(createUser(input, "admin")).resolves.toBe("new-user");
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      options: { data: { first_name: "Ana", last_name: "Sol" } },
    });
    expect(mocks.profileRpc).toHaveBeenCalledWith("admin_create_profile", {
      p_id: "new-user",
      p_first_name: "Ana",
      p_last_name: "Sol",
      p_email: "ana@example.com",
      p_role: "AUDITOR",
      p_status: "active",
    });
    expect(mocks.signupSignOut).toHaveBeenCalledOnce();
  });

  it("reports the Auth UID when profile creation fails", async () => {
    mocks.profileRpc.mockResolvedValue({ data: null, error: new Error("RLS") });
    await expect(createUser(input, "admin")).rejects.toThrow("UID new-user");
    expect(mocks.signupSignOut).toHaveBeenCalledOnce();
  });

  it("updates profiles through the audited administrator RPC", async () => {
    await updateUser(
      "target",
      {
        firstName: "Ana",
        lastName: "Sol",
        email: "ana@example.com",
        role: "SUPERVISOR",
        status: "inactive",
      },
      "admin",
    );
    expect(mocks.profileRpc).toHaveBeenCalledWith("admin_update_profile", {
      p_id: "target",
      p_first_name: "Ana",
      p_last_name: "Sol",
      p_role: "SUPERVISOR",
      p_status: "inactive",
    });
  });
});

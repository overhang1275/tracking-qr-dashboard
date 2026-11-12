import { describe, expect, it } from "vitest";
import {
  mapAuditRow,
  mapProfileRow,
  mapSettingsRow,
  mapValidationRow,
} from "../src/lib/supabase-mappers";

describe("Supabase row mappings", () => {
  it("maps profile fields and timestamps into the platform model", () => {
    expect(
      mapProfileRow({
        id: "user-1",
        first_name: "Ana",
        last_name: "Sol",
        email: "ana@example.com",
        role: "VALIDADOR",
        status: "active",
        created_at: "2026-11-01T00:00:00.000Z",
        updated_at: "2026-11-02T00:00:00.000Z",
        created_by: "admin-1",
        last_access: null,
      }),
    ).toEqual({
      uid: "user-1",
      firstName: "Ana",
      lastName: "Sol",
      email: "ana@example.com",
      role: "VALIDADOR",
      status: "active",
      createdAt: Date.parse("2026-11-01T00:00:00.000Z"),
      updatedAt: Date.parse("2026-11-02T00:00:00.000Z"),
      createdBy: "admin-1",
      lastAccess: undefined,
    });
  });

  it("maps validation server timestamps to epoch milliseconds", () => {
    expect(
      mapValidationRow({
        id: "event-1",
        user_id: "user-1",
        folio: "COL-1",
        document_type: "engomado_vehicular",
        element_type: "qr_vehicular",
        reported_result: "valid",
        created_at: "2026-11-03T12:00:00.000Z",
        application: "mx.colima.autenticacion",
        app_version: "1.0.0",
      }),
    ).toEqual({
      id: "event-1",
      userId: "user-1",
      folio: "COL-1",
      documentType: "engomado_vehicular",
      elementType: "qr_vehicular",
      reportedResult: "valid",
      timestamp: Date.parse("2026-11-03T12:00:00.000Z"),
      application: "mx.colima.autenticacion",
      appVersion: "1.0.0",
    });
  });

  it("maps JSON audit details and institution settings", () => {
    expect(
      mapAuditRow({
        id: "audit-1",
        actor_id: "admin-1",
        action: "user.create",
        target_id: "user-2",
        created_at: "2026-11-04T00:00:00.000Z",
        details: { message: "Cuenta creada", email: "a@example.com" },
      }),
    ).toMatchObject({
      id: "audit-1",
      actorUid: "admin-1",
      timestamp: Date.parse("2026-11-04T00:00:00.000Z"),
      details: "Cuenta creada",
    });

    expect(
      mapSettingsRow({
        institution_name: "Plataforma Colima",
        updated_at: "2026-11-05T00:00:00.000Z",
        updated_by: "admin-1",
      }),
    ).toEqual({
      name: "Plataforma Colima",
      updatedAt: Date.parse("2026-11-05T00:00:00.000Z"),
      updatedBy: "admin-1",
    });
  });
});

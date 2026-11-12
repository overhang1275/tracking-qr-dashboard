import { describe, expect, it } from "vitest";
import { filterValidations, validationsToCsv } from "../src/lib/validation";
import { profileInputSchema } from "../src/lib/schemas";
import type { ValidationRecord } from "../src/types";
const row: ValidationRecord = {
  id: "one",
  userId: "u",
  folio: "=SUM(1,2)",
  documentType: "soporte_vehicular",
  elementType: "qr_vehicular",
  reportedResult: "valid",
  timestamp: 100,
  application: "Colima",
  appVersion: "1",
};
describe("validation data", () => {
  it("combines exact filters and inclusive dates", () => {
    expect(
      filterValidations([row], {
        start: 100,
        end: 100,
        result: "valid",
        search: "colima",
      }),
    ).toEqual([row]);
    expect(filterValidations([row], { userId: "other" })).toEqual([]);
  });
  it("escapes CSV quotes and neutralizes spreadsheet formulas", () => {
    const csv = validationsToCsv([
      { ...row, application: 'a"b\nc', userId: "\t=CMD()" },
    ]);
    expect(csv).toContain('"\'=SUM(1,2)"');
    expect(csv).toContain('"a""b\nc"');
    expect(csv).toContain("'\t=CMD()");
  });
  it("validates staff roles and profile fields", () => {
    expect(
      profileInputSchema.safeParse({
        firstName: "Ana",
        lastName: "Sol",
        email: "ana@example.com",
        role: "AUDITOR",
        status: "active",
      }).success,
    ).toBe(true);
    expect(
      profileInputSchema.safeParse({
        firstName: "",
        lastName: "Sol",
        email: "x",
        role: "ROOT",
        status: "active",
      }).success,
    ).toBe(false);
  });
});

import type {
  ApplicationSettings,
  AuditLog,
  UserProfile,
  ValidationRecord,
} from "../types";

function epoch(value: string) {
  return Date.parse(value);
}

export function mapProfileRow(row: {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserProfile["role"];
  status: UserProfile["status"];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  last_access: string | null;
}): UserProfile {
  return {
    uid: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: epoch(row.created_at),
    updatedAt: epoch(row.updated_at),
    createdBy: row.created_by,
    lastAccess: row.last_access ? epoch(row.last_access) : undefined,
  };
}

export function mapValidationRow(row: {
  id: string;
  user_id: string;
  folio: string;
  document_type: ValidationRecord["documentType"];
  element_type: ValidationRecord["elementType"];
  reported_result: ValidationRecord["reportedResult"];
  created_at: string;
  application: string;
  app_version: string;
}): ValidationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    folio: row.folio,
    documentType: row.document_type,
    elementType: row.element_type,
    reportedResult: row.reported_result,
    timestamp: epoch(row.created_at),
    application: row.application,
    appVersion: row.app_version,
  };
}

export function mapAuditRow(row: {
  id: string;
  actor_id: string;
  action: string;
  target_id: string;
  created_at: string;
  details: unknown;
}): AuditLog {
  const details = row.details;
  const summary =
    details && typeof details === "object" && "message" in details
      ? String(details.message)
      : typeof details === "string"
        ? details
        : (JSON.stringify(details) ?? "");

  return {
    id: row.id,
    actorUid: row.actor_id,
    action: row.action,
    targetId: row.target_id,
    timestamp: epoch(row.created_at),
    details: summary,
  };
}

export function mapSettingsRow(row: {
  institution_name: string;
  updated_at: string;
  updated_by: string | null;
}): ApplicationSettings {
  return {
    name: row.institution_name,
    updatedAt: epoch(row.updated_at),
    updatedBy: row.updated_by,
  };
}

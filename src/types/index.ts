export const roles = ['ADMINISTRADOR', 'SUPERVISOR', 'VALIDADOR', 'AUDITOR'] as const;
export type Role = typeof roles[number];
export const documentTypes = ['soporte_vehicular', 'engomado_vehicular', 'engomado_remolque'] as const;
export const elementTypes = ['escudo_invisible', 'anticopia_soporte', 'qr_vehicular', 'anticopia_vehicular', 'correlativa_vehicular', 'anticopia_remolque'] as const;
export const resultTypes = ['valid', 'invalid', 'inconclusive', 'error'] as const;
export interface UserProfile { uid: string; firstName: string; lastName: string; email: string; role: Role; status: 'active' | 'inactive'; createdAt: number; updatedAt: number; createdBy: string; lastAccess?: number }
export interface ValidationRecord { id: string; userId: string; folio: string; documentType: typeof documentTypes[number]; elementType: typeof elementTypes[number]; reportedResult: typeof resultTypes[number]; timestamp: number; application: string; appVersion: string }
export interface AuditLog { id: string; actorUid: string; action: string; targetId: string; timestamp: number; details: string }
export interface ApplicationSettings { name: string; updatedAt: number; updatedBy: string }

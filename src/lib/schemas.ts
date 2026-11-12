import { z } from 'zod';
import { roles } from '../types';
export const profileInputSchema = z.object({ firstName:z.string().trim().min(1,'Escribe el nombre').max(80), lastName:z.string().trim().min(1,'Escribe los apellidos').max(120), email:z.string().trim().email('Correo no válido').max(254), role:z.enum(roles), status:z.enum(['active','inactive']) });
export const createUserSchema = profileInputSchema.extend({password:z.string().min(8,'Usa al menos 8 caracteres').max(128)});
export const settingsSchema = z.object({name:z.string().trim().min(1,'Escribe el nombre').max(120)});
export type ProfileInput = z.infer<typeof profileInputSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

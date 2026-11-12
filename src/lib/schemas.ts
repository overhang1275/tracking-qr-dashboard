import { z } from "zod";
import { roles } from "../types";
export const profileInputSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Escribe el nombre")
    .max(80, "Usa hasta 80 caracteres"),
  lastName: z
    .string()
    .trim()
    .min(1, "Escribe los apellidos")
    .max(120, "Usa hasta 120 caracteres"),
  email: z
    .string()
    .trim()
    .email("Correo no válido")
    .max(254, "Usa hasta 254 caracteres"),
  role: z.enum(roles),
  status: z.enum(["active", "inactive"]),
});
export const createUserSchema = profileInputSchema.extend({
  password: z
    .string()
    .min(8, "Usa al menos 8 caracteres")
    .max(128, "Usa hasta 128 caracteres"),
});
export const settingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre")
    .max(120, "Usa hasta 120 caracteres"),
});
export type ProfileInput = z.infer<typeof profileInputSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;

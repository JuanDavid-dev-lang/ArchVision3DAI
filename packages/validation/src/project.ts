import { z } from "zod";
import {
  CREATION_METHODS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  UNIT_SYSTEMS,
} from "@archvision/types";

/** Esquemas de proyecto. Limites pensados para evitar datos absurdos. */

export const projectTypeSchema = z.enum(PROJECT_TYPES);
export const unitSystemSchema = z.enum(UNIT_SYSTEMS);
export const creationMethodSchema = z.enum(CREATION_METHODS);
export const projectStatusSchema = z.enum(PROJECT_STATUSES);

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  type: projectTypeSchema.default("house"),
  units: unitSystemSchema.default("m"),
  creationMethod: creationMethodSchema.default("draw"),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  /** Numero estimado de plantas. */
  floorsCount: z.coerce.number().int().min(1).max(20).default(1),
  /** Area aproximada en m2. */
  areaEstimate: z.coerce.number().min(0).max(1_000_000).optional(),
  /** Altura de piso en metros. */
  floorHeight: z.coerce.number().min(1.8).max(12).default(2.6),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    type: projectTypeSchema.optional(),
    units: unitSystemSchema.optional(),
    location: z.string().trim().max(200).nullable().optional(),
    status: projectStatusSchema.optional(),
    thumbnailUrl: z.string().url().max(2000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nada que actualizar",
  });

export const projectListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: projectStatusSchema.optional(),
  /** Cursor de paginacion (id del ultimo elemento recibido). */
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  includeDeleted: z.coerce.boolean().default(false),
});

export const createVersionSchema = z.object({
  label: z.string().trim().min(1).max(120),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

import { z } from "zod";

/**
 * Entrada del asistente.
 *
 * El texto es lo unico que escribe la persona; el resto describe el estado del
 * editor y llega del cliente, asi que se acota igual que cualquier otra
 * entrada: sin limites, una pestana manipulada podria mandar un historial
 * enorme y convertir cada pregunta en una factura.
 */

const id = z.string().min(1).max(64);

export const assistantMessageSchema = z.object({
  id: z.string().max(64),
  role: z.enum(["user", "assistant"]),
  text: z.string().max(4000),
  at: z.number().finite(),
});

export const assistantRequestSchema = z.object({
  message: z.string().trim().min(1, "Escribe una pregunta").max(2000),
  history: z.array(assistantMessageSchema).max(40).default([]),
  selection: z.array(id).max(200).default([]),
  activeFloorId: id.nullable().default(null),
  tool: z.string().max(32).optional(),
});

export type AssistantRequestInput = z.infer<typeof assistantRequestSchema>;

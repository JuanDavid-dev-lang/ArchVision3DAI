import { z } from "zod";
import {
  DOOR_KINDS,
  ROOF_KINDS,
  STAIR_KINDS,
  WINDOW_KINDS,
  type SceneCommand,
} from "@archvision/types";
import { materialSchema, underlaySchema, vector2Schema, vector3Schema } from "./scene";

/**
 * Validacion de comandos del editor.
 *
 * El asistente de IA produce objetos que pasan OBLIGATORIAMENTE por estos
 * esquemas antes de tocar el estado. Un comando invalido se descarta y se
 * informa al usuario; nunca se aplica parcialmente.
 */

const id = z.string().min(1).max(64);
const length = z.number().finite().min(0.01).max(500);
const offset = z.number().finite().min(0).max(5000);

const base = {
  id: z.string().max(64).optional(),
  origin: z.enum(["user", "ai", "import", "system"]).optional(),
};

export const createWallCommandSchema = z.object({
  ...base,
  type: z.literal("CREATE_WALL"),
  floorId: id,
  start: vector2Schema,
  end: vector2Schema,
  height: length.optional(),
  thickness: length.optional(),
});

export const updateWallCommandSchema = z.object({
  ...base,
  type: z.literal("UPDATE_WALL"),
  wallId: id,
  patch: z
    .object({
      start: vector2Schema.optional(),
      end: vector2Schema.optional(),
      height: length.optional(),
      thickness: length.optional(),
      materialInteriorId: id.optional(),
      materialExteriorId: id.optional(),
      name: z.string().trim().min(1).max(120).optional(),
    })
    .refine((patch) => Object.keys(patch).length > 0, {
      message: "El comando no modifica nada",
    }),
});

export const createDoorCommandSchema = z.object({
  ...base,
  type: z.literal("CREATE_DOOR"),
  wallId: id,
  offset,
  width: length.optional(),
  height: length.optional(),
  kind: z.enum(DOOR_KINDS).optional(),
});

export const createWindowCommandSchema = z.object({
  ...base,
  type: z.literal("CREATE_WINDOW"),
  wallId: id,
  offset,
  width: length.optional(),
  height: length.optional(),
  sillHeight: z.number().min(0).max(20).optional(),
  kind: z.enum(WINDOW_KINDS).optional(),
});

export const updateOpeningCommandSchema = z.object({
  ...base,
  type: z.literal("UPDATE_OPENING"),
  openingId: id,
  kindOf: z.enum(["door", "window", "opening"]),
  patch: z
    .object({
      offset: offset.optional(),
      width: length.optional(),
      height: length.optional(),
      sillHeight: z.number().min(0).max(20).optional(),
      wallId: id.optional(),
    })
    .refine((patch) => Object.keys(patch).length > 0, {
      message: "El comando no modifica nada",
    }),
});

export const createFloorCommandSchema = z.object({
  ...base,
  type: z.literal("CREATE_FLOOR"),
  name: z.string().trim().min(1).max(120).optional(),
  height: length.optional(),
});

export const createRoofCommandSchema = z.object({
  ...base,
  type: z.literal("CREATE_ROOF"),
  floorId: id,
  kind: z.enum(ROOF_KINDS),
  slopeDeg: z.number().min(0).max(85).optional(),
  overhang: z.number().min(0).max(10).optional(),
});

export const updateRoofCommandSchema = z.object({
  ...base,
  type: z.literal("UPDATE_ROOF"),
  roofId: id,
  patch: z
    .object({
      kind: z.enum(ROOF_KINDS).optional(),
      slopeDeg: z.number().min(0).max(85).optional(),
      overhang: z.number().min(0).max(10).optional(),
      thickness: length.optional(),
      baseHeight: z.number().min(-50).max(200).optional(),
    })
    .refine((patch) => Object.keys(patch).length > 0, {
      message: "El comando no modifica nada",
    }),
});

export const createColumnCommandSchema = z.object({
  ...base,
  type: z.literal("CREATE_COLUMN"),
  floorId: id,
  position: vector2Schema,
  shape: z.enum(["rect", "circle"]).optional(),
  width: length.optional(),
  depth: length.optional(),
  height: length.optional(),
});

export const createStairCommandSchema = z.object({
  ...base,
  type: z.literal("CREATE_STAIR"),
  floorId: id,
  kind: z.enum(STAIR_KINDS),
  position: vector2Schema,
  totalRise: length.optional(),
  width: length.optional(),
});

export const addFurnitureCommandSchema = z.object({
  ...base,
  type: z.literal("ADD_FURNITURE"),
  floorId: id,
  catalogId: z.string().min(1).max(120),
  position: vector3Schema,
  rotationY: z.number().min(-Math.PI * 4).max(Math.PI * 4).optional(),
});

export const assignMaterialCommandSchema = z.object({
  ...base,
  type: z.literal("ASSIGN_MATERIAL"),
  targetIds: z.array(id).min(1).max(2000),
  materialId: id,
  face: z.enum(["interior", "exterior", "both", "floor", "ceiling"]).optional(),
});

/**
 * Alta y edicion de materiales del proyecto.
 *
 * Se reutiliza `materialSchema` quitando el id (lo asigna el reductor) y el
 * indicador `builtin`, que el cliente no puede reclamar: un material de
 * catalogo no se crea desde la interfaz.
 */
export const createMaterialCommandSchema = z.object({
  ...base,
  type: z.literal("CREATE_MATERIAL"),
  material: materialSchema
    .omit({ id: true, builtin: true })
    .extend({ id: id.optional() }),
});

export const updateMaterialCommandSchema = z.object({
  ...base,
  type: z.literal("UPDATE_MATERIAL"),
  materialId: id,
  patch: materialSchema
    .omit({ id: true, builtin: true, maps: true })
    .partial()
    .refine((patch) => Object.keys(patch).length > 0, {
      message: "El parche no cambia ninguna propiedad",
    }),
});

export const deleteMaterialCommandSchema = z.object({
  ...base,
  type: z.literal("DELETE_MATERIAL"),
  materialId: id,
});

export const setUnderlayCommandSchema = z.object({
  ...base,
  type: z.literal("SET_UNDERLAY"),
  underlay: underlaySchema.nullable(),
});

export const transformObjectsCommandSchema = z.object({
  ...base,
  type: z.literal("TRANSFORM_OBJECTS"),
  ids: z.array(id).min(1).max(2000),
  translate: vector3Schema.optional(),
  rotateY: z.number().min(-Math.PI * 4).max(Math.PI * 4).optional(),
  scale: vector3Schema.optional(),
});

export const deleteObjectsCommandSchema = z.object({
  ...base,
  type: z.literal("DELETE_OBJECTS"),
  ids: z.array(id).min(1).max(2000),
});

export const setVisibilityCommandSchema = z.object({
  ...base,
  type: z.literal("SET_VISIBILITY"),
  ids: z.array(id).min(1).max(2000),
  visible: z.boolean(),
});

export const setLockCommandSchema = z.object({
  ...base,
  type: z.literal("SET_LOCK"),
  ids: z.array(id).min(1).max(2000),
  locked: z.boolean(),
});

export const renameObjectCommandSchema = z.object({
  ...base,
  type: z.literal("RENAME_OBJECT"),
  id: id,
  name: z.string().trim().min(1).max(120),
});

export const sceneCommandSchema = z.discriminatedUnion("type", [
  createWallCommandSchema,
  updateWallCommandSchema,
  createDoorCommandSchema,
  createWindowCommandSchema,
  updateOpeningCommandSchema,
  createFloorCommandSchema,
  createRoofCommandSchema,
  updateRoofCommandSchema,
  createColumnCommandSchema,
  createStairCommandSchema,
  addFurnitureCommandSchema,
  assignMaterialCommandSchema,
  createMaterialCommandSchema,
  updateMaterialCommandSchema,
  deleteMaterialCommandSchema,
  setUnderlayCommandSchema,
  transformObjectsCommandSchema,
  deleteObjectsCommandSchema,
  setVisibilityCommandSchema,
  setLockCommandSchema,
  renameObjectCommandSchema,
]);

export const sceneCommandBatchSchema = z.object({
  commands: z.array(sceneCommandSchema).min(1).max(200),
});

/** Parseo seguro: devuelve el comando tipado o los errores legibles. */
export function parseSceneCommand(
  input: unknown,
): { ok: true; command: SceneCommand } | { ok: false; errors: string[] } {
  const result = sceneCommandSchema.safeParse(input);
  if (result.success) {
    return { ok: true, command: result.data as SceneCommand };
  }
  return {
    ok: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`,
    ),
  };
}

import "server-only";
import { prisma } from "@archvision/database";
import {
  computeSceneMetrics,
  createDefaultScene,
  migrateScene,
  syncCatalogMaterials,
} from "@archvision/shared";
import type { SceneDocument } from "@archvision/types";
import { planLimits } from "@archvision/config";
import { sceneDocumentSchema, validateSceneReferences } from "@archvision/validation";

/**
 * Persistencia del documento de escena.
 *
 * REGLA: solo entra JSON validado. Se rechaza cualquier escena con
 * referencias rotas para que el editor nunca cargue un modelo inconsistente.
 */

export class SceneConflictError extends Error {
  constructor(public readonly currentRevision: number) {
    super("La escena fue modificada por otra sesion");
    this.name = "SceneConflictError";
  }
}

export class SceneValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super("Escena invalida");
    this.name = "SceneValidationError";
  }
}

async function assertAccess(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspace: { members: { some: { userId } } } },
    select: { id: true },
  });
  return project !== null;
}

export async function loadScene(
  userId: string,
  projectId: string,
): Promise<{ scene: SceneDocument; revision: number } | null> {
  if (!(await assertAccess(userId, projectId))) return null;

  const record = await prisma.scene.findUnique({ where: { projectId } });
  if (!record) {
    // Proyecto sin escena (migracion o creacion parcial): se repara al vuelo.
    const scene = createDefaultScene();
    const created = await prisma.scene.create({
      data: {
        projectId,
        dataJson: JSON.stringify(scene),
        schemaVersion: scene.version,
      },
    });
    return { scene, revision: created.revision };
  }

  // Un proyecto guardado con un formato anterior se migra en memoria antes de
  // validar. No se reescribe la fila: la version en disco se actualiza cuando
  // el usuario edita, de modo que abrir un proyecto nunca modifica nada.
  const migration = migrateScene(JSON.parse(record.dataJson));

  const parsed = sceneDocumentSchema.safeParse(migration.scene);
  if (!parsed.success) {
    throw new SceneValidationError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }

  const scene = parsed.data as SceneDocument;

  // El catalogo de materiales pertenece a la aplicacion: si mejoro desde la
  // ultima vez que se abrio el proyecto, la mejora se aplica al vuelo.
  const synced = syncCatalogMaterials(scene.materials);

  return {
    scene: synced.changed ? { ...scene, materials: synced.materials } : scene,
    revision: record.revision,
  };
}

export async function saveScene(
  userId: string,
  projectId: string,
  input: { scene: unknown; expectedRevision?: number },
): Promise<{ revision: number } | null> {
  if (!(await assertAccess(userId, projectId))) return null;

  // Tambien al escribir: un cliente con la pestana abierta desde antes de un
  // despliegue, o una importacion, pueden mandar un formato anterior.
  const parsed = sceneDocumentSchema.safeParse(migrateScene(input.scene).scene);
  if (!parsed.success) {
    throw new SceneValidationError(
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }

  const scene = parsed.data as SceneDocument;
  const problems = validateSceneReferences(scene);
  if (problems.length > 0) throw new SceneValidationError(problems);

  const current = await prisma.scene.findUnique({ where: { projectId } });
  if (
    current &&
    input.expectedRevision !== undefined &&
    current.revision !== input.expectedRevision
  ) {
    throw new SceneConflictError(current.revision);
  }

  const dataJson = JSON.stringify(scene);
  const metrics = computeSceneMetrics(scene);
  const sizeBytes = Buffer.byteLength(dataJson, "utf8");

  const [saved] = await prisma.$transaction([
    prisma.scene.upsert({
      where: { projectId },
      create: { projectId, dataJson, schemaVersion: scene.version },
      update: {
        dataJson,
        schemaVersion: scene.version,
        revision: { increment: 1 },
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: {
        sizeBytes,
        floorsCount: scene.floors.length,
        areaEstimate:
          metrics.usableArea > 0
            ? Math.round(metrics.usableArea * 100) / 100
            : undefined,
      },
    }),
  ]);

  return { revision: saved.revision };
}

// --------------------------------------------------------------------------
// Versiones (snapshots)
// --------------------------------------------------------------------------

export async function listVersions(userId: string, projectId: string) {
  if (!(await assertAccess(userId, projectId))) return null;
  const versions = await prisma.projectVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, createdById: true },
  });
  return versions.map((v) => ({
    id: v.id,
    label: v.label,
    createdAt: v.createdAt.toISOString(),
    createdById: v.createdById,
  }));
}

export async function createVersion(
  userId: string,
  projectId: string,
  label: string,
  plan: string,
): Promise<{ id: string } | null> {
  if (!(await assertAccess(userId, projectId))) return null;

  const scene = await prisma.scene.findUnique({ where: { projectId } });
  if (!scene) return null;

  const limits = planLimits(plan);
  if (limits.maxVersionsPerProject >= 0) {
    const count = await prisma.projectVersion.count({ where: { projectId } });
    if (count >= limits.maxVersionsPerProject) {
      // Politica: se conserva el historial mas reciente.
      const oldest = await prisma.projectVersion.findFirst({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (oldest) {
        await prisma.projectVersion.delete({ where: { id: oldest.id } });
      }
    }
  }

  const created = await prisma.projectVersion.create({
    data: {
      projectId,
      label,
      dataJson: scene.dataJson,
      createdById: userId,
    },
    select: { id: true },
  });

  return created;
}

export async function restoreVersion(
  userId: string,
  projectId: string,
  versionId: string,
): Promise<{ revision: number } | null> {
  if (!(await assertAccess(userId, projectId))) return null;

  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId },
  });
  if (!version) return null;

  const saved = await prisma.scene.update({
    where: { projectId },
    data: { dataJson: version.dataJson, revision: { increment: 1 } },
  });

  return { revision: saved.revision };
}

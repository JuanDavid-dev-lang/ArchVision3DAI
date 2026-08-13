# Modelo de datos

Prisma ORM. SQLite en desarrollo, PostgreSQL en staging y producción.

## Portabilidad

El esquema evita a propósito características exclusivas de un motor:

- Sin enums nativos: los campos enumerados son `String` y se validan con Zod.
  Los valores permitidos se documentan en el propio esquema y viven en
  `@archvision/types`.
- Sin arrays ni tipo `Json`: los documentos se guardan como `String` con JSON
  serializado (`Scene.dataJson`, `ProjectVersion.dataJson`, `AuditEvent.metaJson`).
- Sin archivos binarios: solo `storageKey` hacia el object storage.

Migrar a PostgreSQL: cambiar `provider` en `schema.prisma`, ajustar
`DATABASE_URL`, regenerar el historial de migraciones y desplegar.

## Entidades

### Identidad

| Modelo | Campos relevantes | Notas |
| --- | --- | --- |
| `User` | `email` único, `passwordHash`, `role`, `plan`, `preferences` | `role`: USER, PROFESSIONAL, ADMIN |
| `Session` | `tokenHash` único, `expiresAt`, `userAgent`, `ipAddress` | Solo el hash del token; permite revocación |
| `PasswordResetToken` | `tokenHash`, `expiresAt`, `usedAt` | Un solo uso |

### Workspaces

| Modelo | Campos relevantes | Notas |
| --- | --- | --- |
| `Workspace` | `slug` único, `ownerId`, `usedBytes` | Contenedor de proyectos y cuotas |
| `WorkspaceMember` | `(workspaceId, userId)` único, `role` | OWNER, ADMIN, EDITOR, VIEWER |

Cada usuario recibe un workspace personal al registrarse.

### Proyectos

| Modelo | Campos relevantes | Notas |
| --- | --- | --- |
| `Project` | `type`, `units`, `creationMethod`, `status`, `progress`, `floorsCount`, `areaEstimate`, `floorHeight`, `sizeBytes`, `deletedAt` | `deletedAt` implementa la papelera |
| `Scene` | `projectId` único, `schemaVersion`, `dataJson`, `revision` | Un `SceneDocument` por proyecto; `revision` detecta conflictos |
| `ProjectFile` | `kind`, `role`, `mimeType`, `sizeBytes`, `storageKey`, `checksum` | `kind`: photo, floorplan, texture, model, render, export |
| `ProjectVersion` | `label`, `dataJson`, `createdById` | Snapshot restaurable |

### Procesamiento

| Modelo | Campos relevantes | Notas |
| --- | --- | --- |
| `AIAnalysis` | `kind`, `status`, `progress`, `stage`, `resultJson`, `credits` | Un registro por trabajo de visión |
| `ExportJob` | `format`, `status`, `storageKey` | GLB, GLTF, OBJ, STL, JSON, PNG, JPG, PDF |

### Colaboración y auditoría

| Modelo | Campos relevantes | Notas |
| --- | --- | --- |
| `ShareLink` | `token` único, `visibility`, `passwordHash`, `expiresAt`, `revokedAt` | Enlaces de solo lectura |
| `AuditEvent` | `action`, `targetType`, `targetId`, `metaJson`, `ipAddress` | Sin datos personales sensibles |

## Relaciones y borrado

Todo lo que cuelga de un proyecto se elimina en cascada: escena, archivos,
versiones, análisis, exportaciones y enlaces compartidos. El borrado desde la
papelera es explícito y requiere confirmación en la interfaz.

## Identificadores

UUID v4 en todos los modelos y en las entidades del documento de escena. Nunca
se usan índices de array como identificador: las referencias deben sobrevivir a
reordenamientos y a fusiones de escenas.

## Índices

- `Project(workspaceId, updatedAt)` — listado del dashboard.
- `Project(deletedAt)` — papelera.
- `Session(userId)`, `Session(expiresAt)` — validación y purga.
- `ProjectFile(projectId, kind)` — galería por tipo.
- `AIAnalysis(projectId, status)` — panel de procesamiento.

## Migraciones

El historial vive en `packages/database/prisma/migrations`. Reglas:

1. Todo cambio de esquema genera una migración versionada.
2. La base de datos de producción nunca se modifica a mano.
3. En despliegue se ejecuta `prisma migrate deploy`, jamás `migrate dev`.

# Arquitectura — ArchVision 3D AI

## 1. Principio rector

Las **entidades arquitectónicas paramétricas** (pared, puerta, ventana, techo,
escalera) son la fuente de verdad del modelo. Three.js es únicamente su
representación visual, y la base de datos guarda solo datos serializables.

```
Estado de la aplicación (stores)
        ↓
Entidades arquitectónicas (SceneDocument)
        ↓
Geometría Three.js (derivada, desechable)
```

Consecuencias que atraviesan todo el diseño:

1. La geometría se regenera al cargar; nunca se persiste un `Mesh`.
2. Una malla reconstruida por IA no es el resultado final: se convierte en
   entidades editables (`Wall`, `Window`, …) antes de considerarse terminada.
3. Cualquier consumidor —editor 2D, editor 3D, exportador, IA— habla el mismo
   documento versionado.

## 2. Vista de componentes

```
┌────────────────────────────────────────────────────────────┐
│ apps/web  (Next.js 15, React 19, TypeScript estricto)      │
│  ├─ Landing y autenticación                                │
│  ├─ Dashboard y gestión de proyectos                       │
│  ├─ Editor 2D / 3D            (fases 2 y 3)                │
│  └─ API REST /api/*           (frontera de confianza)      │
└───────────┬────────────────────────────────┬───────────────┘
            │                                │
   ┌────────▼────────┐             ┌─────────▼──────────┐
   │ PostgreSQL /     │            │ Object storage     │
   │ SQLite (Prisma)  │            │ (S3 compatible)    │
   └────────┬─────────┘            └─────────┬──────────┘
            │                                │
   ┌────────▼─────────────────────────────────▼──────────┐
   │ Cola de trabajos (Redis + BullMQ)   — fase 6        │
   └────────┬─────────────────────────────────────────────┘
            │
   ┌────────▼───────────────────────────────────────────┐
   │ apps/ai-service (FastAPI)          — fase 6        │
   │  detección · segmentación · profundidad · SfM/MVS  │
   └────────────────────────────────────────────────────┘
```

## 3. Paquetes

| Paquete | Responsabilidad | Depende de |
| --- | --- | --- |
| `@archvision/config` | Marca, límites de plan, política de archivos | — |
| `@archvision/types` | Entidades, `SceneDocument`, comandos, contratos de IA | — |
| `@archvision/validation` | Esquemas Zod de auth, proyecto, escena y comandos | types |
| `@archvision/shared` | Unidades, geometría 2D, métricas, casa demo | types |
| `@archvision/database` | Prisma, migraciones, semilla, serialización de escena | types, shared |
| `@archvision/web` | Interfaz y API | todos |
| `@archvision/three-engine` *(fase 2)* | Escena, cámara, controles, snapping, gizmos, loaders | types, shared |
| `@archvision/geometry` *(fase 2)* | `createWallGeometry`, vanos booleanos, techos, escaleras | types, shared |

La regla de dependencias es unidireccional: `config`/`types` no importan nada
del resto; `web` no contiene lógica de dominio reutilizable, la delega.

## 4. Flujo de creación de proyecto

1. El usuario elige método (fotografías, plano, dibujo, vacío).
2. `POST /api/projects` valida con Zod, comprueba la cuota del plan en el
   servidor y crea el proyecto **junto con su escena inicial** en una sola
   operación (no existen proyectos sin escena).
3. Métodos `draw` y `empty` quedan listos de inmediato (`progress = 100`).
4. Métodos `photos` y `floorplan` quedan en borrador y encolan trabajos de IA
   cuando la fase correspondiente esté disponible.
5. El editor carga `GET /api/projects/:id/scene`, trabaja en memoria y guarda
   con `PUT`, enviando `expectedRevision` para detectar conflictos.

## 5. Modelo de estado del editor (fase 2)

Stores independientes con Zustand, cada uno con una responsabilidad:

| Store | Contenido |
| --- | --- |
| `projectStore` | Metadatos del proyecto, unidad de visualización, estado de guardado |
| `sceneStore` | `SceneDocument` normalizado por id; única vía de mutación: comandos |
| `selectionStore` | Ids seleccionados, hover, modo de selección |
| `historyStore` | Pilas de undo/redo con comandos y sus inversos |
| `toolStore` | Herramienta activa, snapping, cuadrícula |
| `viewportStore` | Cámara, modo 2D/3D/split, vistas guardadas |
| `materialStore` | Biblioteca de materiales y asignaciones |
| `uiStore` | Paneles, tema, onboarding, command palette |

**Toda mutación pasa por un comando** (`packages/types/src/commands.ts`),
validado por `sceneCommandSchema`. Ventajas: undo/redo uniforme, trazabilidad,
y un asistente de IA que emite comandos verificables en lugar de escribir en la
base de datos.

## 6. Motor 3D (fase 2)

```
three-engine/
  scene/            creación y ciclo de vida de la escena
  camera/           perspectiva, ortográfica, vistas normalizadas
  controls/         órbita, pan, zoom, walkthrough
  objects/          fábricas de objetos a partir de entidades
  materials/        materiales PBR desde MaterialDefinition
  lighting/         sol, ambiental, puntual, spot, área
  loaders/          GLB, GLTF, OBJ, STL
  exporters/        GLB, GLTF, OBJ, STL
  measurements/     distancia, altura, área, perímetro
  snapping/         cuadrícula, vértices, ejes, centros, paredes
  selection/        raycasting y outline
  transformations/  gizmos y aplicación de comandos
```

Regla de sincronización: nunca se recrea la escena completa por un cambio
pequeño. Un reconciliador compara el `SceneDocument` anterior con el nuevo y
actualiza, crea o destruye solo los objetos afectados.

Rendimiento previsto: instanciado para mobiliario repetido, LOD, culling por
frustum, fusión de geometría estática, texturas comprimidas, carga progresiva y
Web Workers para operaciones geométricas pesadas.

## 7. Seguridad

- **Sesiones opacas** en base de datos: la cookie lleva un token aleatorio de
  32 bytes y la tabla solo guarda su SHA-256. Permite revocación inmediata.
- Cookie `httpOnly`, `sameSite=lax` y `secure` en producción.
- **Autorización por pertenencia**: cada consulta filtra por
  `workspace.members.some({ userId })`. La separación entre usuarios vive en la
  capa de servicio, no en la interfaz.
- Validación Zod en toda entrada, incluida la escena completa, con límites de
  tamaño por colección y por coordenada.
- Límite de tamaño de cuerpo por endpoint y comprobación de MIME y extensión en
  subidas.
- Rate limiting en registro, login y creación de proyectos.
- Enumeración de usuarios evitada con verificación falsa de contraseña.
- Auditoría de eventos sensibles en `AuditEvent`.

## 8. Escalabilidad

- Estado sin sesión en memoria: la aplicación web escala horizontalmente.
- Trabajos costosos (IA, render, exportación) fuera del ciclo de petición, en
  cola, con progreso consultable y coste en créditos previsto.
- Los archivos grandes nunca entran en la base de datos; se referencian por
  `storageKey` y se sirven con URLs firmadas.
- El limitador en memoria se sustituye por Redis conservando la misma firma.
- La escena se guarda como documento; cuando el tamaño lo exija, la evolución
  natural es guardar deltas por revisión sin cambiar el contrato público.

## 9. Decisiones registradas

| Decisión | Motivo |
| --- | --- |
| Sesión en base de datos en lugar de JWT | Revocación inmediata y expulsión de miembros |
| SQLite en desarrollo, PostgreSQL en producción | Arranque sin dependencias; esquema deliberadamente portable |
| Escena como JSON versionado y no tablas por entidad | El editor carga y guarda el documento completo; evita cientos de escrituras por sesión |
| Migración del documento en memoria al leer, nunca al abrir | Abrir un proyecto no debe modificar nada; la versión en disco sube cuando el usuario edita |
| Texturas generadas por procedimiento en el cliente | La escena no arrastra imágenes ni depende de una CDN, y una textura sirve a todos los materiales del mismo patrón |
| Detección de muros por visión clásica en el cliente | Determinista, sin servicio externo y sin subir píxeles dos veces; el modelo entrenado de la fase 6 usará la misma interfaz |
| Los archivos van a object storage y se sirven por ruta autenticada | La base de datos guarda solo la referencia, y conocer un identificador no basta para leer el plano de otro usuario |
| Comandos como única vía de mutación | Undo/redo, validación y control del asistente de IA |
| El asistente propone y nunca aplica | Un cambio automático sin revisión es un cambio que nadie pidió; además obliga a que toda propuesta sea legible antes de ejecutarse |
| El modelo de lenguaje elige la operación, no las coordenadas | Sus herramientas son intenciones con medidas; los identificadores y la geometría los pone código probado, así que una alucinación no puede tocar una entidad que el usuario no nombró |
| El razonamiento del asistente vive en un paquete puro | Corre en el navegador (instantáneo y sobre cambios sin guardar) y en el servidor (contexto del modelo) sin duplicar lógica |
| Una propuesta es un solo paso de deshacer | Una habitación son cuatro muros pero una sola decisión; `dispatchBatch` aplica todo o nada |
| El plan efectivo se deriva de la suscripción, no de `user.plan` | `user.plan` es una copia para no consultar en cada petición; el derecho se recalcula donde tiene consecuencias (crear proyecto, subir archivo, guardar versión) |
| Ningún dato de tarjeta entra en la aplicación | El cobro ocurre en el checkout alojado de la pasarela; aquí solo viven importes, referencias e identificadores suyos |
| El ciclo de suscripción lo lleva la aplicación, no la pasarela | Wompi cobra transacciones sueltas y no gestiona suscripciones; poner el ciclo en `packages/billing` lo hace probable sin red y portable a otra pasarela |
| Los eventos de pago se procesan una sola vez | Las pasarelas reintentan; sin clave única por evento, un mismo pago ampliaría el periodo dos veces |
| El progreso del tutorial se deriva del documento | Mirar el estado y no el evento hace que sobreviva a deshacer, recargar o cambiar de equipo |
| Paquetes en TypeScript sin compilar (`transpilePackages`) | Menos fricción en el monorepo, un solo paso de build |
| Metros y radianes como unidades internas | Elimina errores de conversión; la unidad del usuario es solo presentación |

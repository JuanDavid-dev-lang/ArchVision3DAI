# ArchVision 3D AI

Plataforma web para crear modelos 3D de viviendas y edificaciones a partir de
fotografías, planos arquitectónicos, croquis y medidas del usuario.

El principio del producto: **la inteligencia artificial ayuda a construir el
modelo, pero el usuario mantiene el control completo sobre la geometría final**.

```
Imagen / Plano → Análisis IA → Modelo inicial → Corrección humana
              → Modelo paramétrico → Render / Exportación
```

> El nombre comercial vive en `packages/config/src/brand.ts` (o en la variable
> `NEXT_PUBLIC_APP_NAME`). Cambiarlo ahí renombra toda la aplicación.

---

## Estado actual

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1 | Monorepo, base de datos, autenticación, dashboard, proyectos, escena persistida | **Completa** |
| 2 | Editor 3D (Three.js + React Three Fiber), paredes, vanos, cubiertas, escaleras, undo/redo, autoguardado | **Completa** |
| 3 | Editor 2D sincronizado, snapping, detección de habitaciones, medición | **Completa** |
| 4 | Biblioteca de materiales PBR con texturas procedurales y arrastrar/soltar | **Completa** |
| 5 | Importación de planos: subida, calibración, calcado y detección automática de muros | **Completa** |
| 6 | Asistente: propone cambios, revisa el modelo y guía paso a paso | **Completa** |
| 7 | Suscripciones de pago con Wompi: planes, cobros, renovación y límites | **Completa** |
| 8 | Servicio Python de visión y reconstrucción desde fotografías | Pendiente |
| 9 | Exportaciones GLB/GLTF/OBJ/STL/PNG | Pendiente |
| 10 | Render, HDRI, simulación solar | Pendiente |
| 11 | Colaboración, workspaces compartidos, enlaces | Pendiente |

Los módulos aún no disponibles aparecen en la interfaz marcados con la fase en
la que llegan, nunca como enlaces muertos.

### Qué puedes hacer hoy

1. Crear una cuenta y un proyecto, o cargar la casa demo de dos plantas.
2. Abrir el editor y trabajar en vista 2D, 3D o dividida.
3. Dibujar paredes encadenadas con snapping a vértices, puntos medios, ejes y
   cuadrícula.
4. Colocar puertas y ventanas haciendo clic sobre una pared: el hueco se abre
   en la geometría al instante.
5. Añadir columnas, escaleras paramétricas, cubiertas (plana, una pendiente,
   dos aguas, cuatro aguas) y mobiliario del catálogo.
6. Ver las habitaciones detectadas automáticamente con su área y perímetro.
7. Editar medidas exactas en el inspector, arrastrar nodos de pared, deshacer
   y rehacer, y medir distancias.
8. Aplicar materiales con textura (ladrillo, madera, ceramica, teja, marmol,
   piedra, metal): arrastra una muestra sobre el modelo o carga el pincel con
   `G` y haz clic. Puedes duplicar un material del catalogo y editar el tuyo.
9. Importar un plano (PNG, JPG, WebP), fijar su escala con una medida conocida,
   calcarlo por debajo del dibujo y detectar los muros automáticamente para
   revisarlos y aceptarlos.
10. Pedirle cambios al asistente con `A`: crea habitaciones, coloca vanos,
    aplica materiales o levanta cubiertas. Nada se aplica sin que lo apruebes y
    cada propuesta se deshace de un solo `Ctrl+Z`.
11. Revisar el modelo: habitaciones sin acceso, vanos fuera del muro, muros
    duplicados, poca luz natural, escaleras incómodas.
12. Seguir el tutorial integrado, cuyos pasos se marcan solos a medida que
    trabajas.
13. Contratar un plan de pago (Pro o Studio, mensual o anual), cancelarlo o
    reanudarlo desde Configuración → Facturación. Sin credenciales de pasarela
    funciona una simulación que recorre el mismo camino.
14. Todo se autoguarda; `Ctrl+K` abre la paleta de comandos.

---

## Requisitos

- Node.js 20.11 o superior (probado con Node 24).
- pnpm 9 o superior.
- Base de datos: SQLite en desarrollo (incluida, sin instalación) o PostgreSQL
  en staging/producción.

---

## Puesta en marcha

```bash
# 1. Dependencias
pnpm install

# 2. Variables de entorno
cp .env.example .env
# Genera un secreto y pégalo en AUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Cliente de Prisma y esquema de base de datos
pnpm db:generate
pnpm --filter @archvision/database exec prisma migrate deploy

# 4. Datos de ejemplo (casa demo de dos plantas)
pnpm db:seed

# 5. Servidor de desarrollo
pnpm dev
```

Aplicación en <http://localhost:3000>.

**Cuenta de demostración:** `demo@archvision.app` / `arquitectura2026`

### Notas de base de datos

- `prisma migrate dev` es interactivo; en scripts o terminales sin TTY usa
  `prisma migrate deploy` (aplica el historial existente) o `prisma db push`
  (sincroniza el esquema sin generar migración).
- El historial de migraciones vive en `packages/database/prisma/migrations`.
  Nunca se modifica la base de datos de producción a mano.
- Para pasar a PostgreSQL: cambia `provider` en `schema.prisma`, ajusta
  `DATABASE_URL`, borra el historial y genera una migración nueva. El esquema
  evita a propósito tipos exclusivos de un motor.

---

## Comandos

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo de la aplicación web |
| `pnpm build` | Compilación de producción |
| `pnpm start` | Servidor de producción |
| `pnpm typecheck` | TypeScript estricto en todos los paquetes |
| `pnpm test` | Pruebas unitarias (Vitest) |
| `pnpm db:generate` | Genera el cliente de Prisma |
| `pnpm db:seed` | Carga datos de ejemplo |
| `pnpm db:studio` | Explorador visual de la base de datos |

---

## Estructura

```
apps/
  web/            Next.js 15: landing, dashboard, API REST, editor 2D/3D
packages/
  config/         Marca, límites de plan, políticas de archivos
  types/          Entidades arquitectónicas, SceneDocument, comandos
  validation/     Esquemas Zod compartidos cliente/servidor
  shared/         Unidades, geometría 2D, métricas, comandos, habitaciones, casa demo
  vision/         Detección de muros en planos: umbral de Otsu, Hough, trazado
  assistant/      Asistente: ficha del proyecto, revisión, intenciones, tutorial
  billing/        Suscripciones: periodos, derechos por plan, estados de cobro
  geometry/       Motor de geometría: paredes con vanos, losas, cubiertas, escaleras
  three-engine/   Materiales PBR, snapping, encuadres de cámara, entorno solar
  database/       Prisma: esquema, migraciones, semilla
```

Paquetes previstos para fases siguientes: `ui` y la aplicación `ai-service`
(FastAPI).

---

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura general y decisiones.
- [`docs/DATABASE.md`](docs/DATABASE.md) — modelo de datos.
- [`docs/API.md`](docs/API.md) — API REST.
- [`docs/EDITOR.md`](docs/EDITOR.md) — motor 3D, estado del editor y comandos.
- [`docs/PLAN_IMPORT.md`](docs/PLAN_IMPORT.md) — importación de planos y detección de muros.
- [`docs/ASSISTANT.md`](docs/ASSISTANT.md) — asistente, revisión del modelo y tutorial.
- [`docs/BILLING.md`](docs/BILLING.md) — planes, suscripciones y cobros.
- [`docs/AI_PIPELINE.md`](docs/AI_PIPELINE.md) — servicio de visión por computador.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — entornos y despliegue.

---

## Aviso

Los modelos generados automáticamente a partir de fotografías pueden contener
errores dimensionales. Verifique las medidas importantes antes de usarlas para
construcción, presupuesto o trámites.

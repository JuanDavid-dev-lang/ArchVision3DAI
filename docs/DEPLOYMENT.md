# Despliegue

## Entornos

| Entorno | Base de datos | Almacenamiento | IA |
| --- | --- | --- | --- |
| Development | SQLite local | Disco local | `AI_MODE=mock` |
| Staging | PostgreSQL gestionado | Bucket S3 | Servicio real, modelos pequeños |
| Production | PostgreSQL con réplica | Bucket S3 con CDN | Servicio real con GPU |

## Variables de entorno

Ver `.env.example`. Críticas en producción:

- `AUTH_SECRET` — mínimo 32 caracteres, distinto por entorno.
- `DATABASE_URL` — cadena de PostgreSQL.
- `NEXT_PUBLIC_APP_URL` — URL pública; determina cookies y enlaces.
- `STORAGE_DRIVER=s3` con sus credenciales.
- `BILLING_PROVIDER=wompi` con las cuatro claves de Wompi. Si se deja en
  `manual`, la aplicación no ofrece contratar: la pasarela simulada se apaga
  sola en producción, porque conceder un plan de pago sin cobrar sería un fallo
  de facturación.
- `BILLING_CRON_SECRET` — sin él, las renovaciones no se cobran.

`getEnv()` valida el entorno al arrancar: si falta algo, el proceso falla de
inmediato con un mensaje explícito en lugar de romperse más tarde.

## Secuencia de despliegue

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @archvision/database exec prisma migrate deploy
pnpm build
pnpm start
```

`prisma migrate deploy` aplica el historial existente y no es interactivo. Nunca
se usa `migrate dev` fuera de desarrollo, ni se modifica el esquema de
producción a mano.

## Tareas programadas

Wompi no gestiona ciclos de suscripción: alguien tiene que decidir cuándo toca
cobrar. Una llamada diaria basta.

```cron
15 3 * * *  curl -fsS -X POST https://tu-dominio/api/billing/renewals               -H "Authorization: Bearer $BILLING_CRON_SECRET"
```

La ruta es idempotente respecto al periodo: cobra solo las suscripciones cuyo
periodo ya venció, así que repetir la llamada no duplica cargos. Conviene
vigilar su salida (`charged`, `failed`, `expired`): un `failed` que crece es
una tarjeta vencida, y un `expired` que crece es una baja silenciosa.

Registrar además el webhook en el panel de Wompi apuntando a
`https://tu-dominio/api/billing/webhook/wompi`.

## Contenedores

`Dockerfile` multi-etapa en `apps/web` y `docker-compose.yml` en la raíz con
PostgreSQL, Redis y MinIO para replicar producción en local. El servicio de IA
se añade como servicio adicional en la fase 6.

Health check: `GET /api/health` devuelve `200` cuando la base de datos responde
y `503` en caso contrario.

## Integración continua

En cada push:

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`

El despliegue solo procede si las cuatro etapas pasan.

## Operación

- Logs estructurados con ámbito (`[api:projects.create]`).
- Purga periódica de sesiones caducadas (`purgeExpiredSessions`).
- Métricas de trabajos de IA, uso de GPU, almacenamiento y errores en el panel
  administrativo.
- Copias de seguridad de la base de datos y del bucket con retención definida
  antes de abrir el producto a usuarios externos.

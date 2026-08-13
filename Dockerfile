# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Imagen de la aplicacion web (monorepo pnpm).
# Etapas separadas para que un cambio de codigo no reinstale dependencias.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- Dependencias ----------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/config/package.json packages/config/
COPY packages/types/package.json packages/types/
COPY packages/shared/package.json packages/shared/
COPY packages/validation/package.json packages/validation/
COPY packages/database/package.json packages/database/
RUN pnpm install --frozen-lockfile

# --- Compilacion -----------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm db:generate && pnpm --filter @archvision/web build

# --- Ejecucion -------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S archvision && adduser -S archvision -G archvision

COPY --from=builder --chown=archvision:archvision /app ./

USER archvision
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["pnpm", "--filter", "@archvision/web", "start"]

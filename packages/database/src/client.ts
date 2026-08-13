import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma como singleton.
 *
 * En desarrollo Next.js recarga los modulos en caliente; sin este singleton
 * cada recarga abriria una nueva pool de conexiones hasta agotar el limite.
 */
const globalForPrisma = globalThis as unknown as {
  __archvisionPrisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.__archvisionPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__archvisionPrisma = prisma;
}

export * from "@prisma/client";

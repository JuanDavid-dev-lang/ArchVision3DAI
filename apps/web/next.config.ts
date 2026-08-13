import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

/**
 * El monorepo mantiene un unico archivo .env en la raiz. Next.js solo lee los
 * .env de su propio directorio, asi que lo cargamos explicitamente aqui: este
 * archivo se evalua en el proceso de servidor tanto en dev como en start.
 */
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Los paquetes del workspace se publican como TypeScript sin compilar.
  transpilePackages: [
    "@archvision/config",
    "@archvision/database",
    "@archvision/shared",
    "@archvision/types",
    "@archvision/validation",
    "@archvision/geometry",
    "@archvision/three-engine",
    "@archvision/vision",
  ],
  // Prisma y bcrypt se resuelven en tiempo de ejecucion, no se empaquetan.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

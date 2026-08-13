import bcrypt from "bcryptjs";

/**
 * Hashing de contrasenas.
 *
 * bcrypt con coste 12: equilibrio razonable entre resistencia a fuerza bruta
 * y latencia de login en hardware modesto. Centralizado aqui para poder
 * migrar a argon2id sin tocar el resto del codigo.
 */
const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Comparacion falsa usada cuando el correo no existe.
 * Mantiene constante el tiempo de respuesta y evita enumerar usuarios.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7Vp0m0ktKcVs3Dp4LxG1cJ0mHmzGZ2S";

export async function fakeVerify(): Promise<void> {
  await bcrypt.compare("password-inexistente", DUMMY_HASH);
}

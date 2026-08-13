import type { BufferGeometry } from "three";

/**
 * Cache de geometrias por clave de parametros.
 *
 * Evita reconstruir mallas cuando el estado cambia por motivos que no afectan
 * a la forma (seleccion, material, visibilidad). Las entradas expulsadas se
 * liberan explicitamente: en WebGL la memoria de GPU no la recoge el GC.
 */
export class GeometryCache {
  private readonly entries = new Map<string, BufferGeometry>();

  constructor(private readonly maxEntries = 600) {}

  get(key: string, factory: () => BufferGeometry): BufferGeometry {
    const existing = this.entries.get(key);
    if (existing) return existing;

    const created = factory();
    this.entries.set(key, created);

    if (this.entries.size > this.maxEntries) this.evictOldest();
    return created;
  }

  /** Libera las geometrias cuyas claves ya no estan en uso. */
  retain(activeKeys: Iterable<string>): void {
    const keep = new Set(activeKeys);
    for (const [key, geometry] of this.entries) {
      if (keep.has(key)) continue;
      geometry.dispose();
      this.entries.delete(key);
    }
  }

  private evictOldest(): void {
    const oldest = this.entries.keys().next();
    if (oldest.done) return;
    const geometry = this.entries.get(oldest.value);
    geometry?.dispose();
    this.entries.delete(oldest.value);
  }

  clear(): void {
    for (const geometry of this.entries.values()) geometry.dispose();
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

/** Cache compartida por el visor 3D. */
export const geometryCache = new GeometryCache();

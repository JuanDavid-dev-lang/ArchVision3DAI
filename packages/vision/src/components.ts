import type { BinaryImage } from "./image";

/**
 * Componentes conexas de la mascara.
 *
 * En un plano, la cota "3.45", el nombre de la habitacion y el simbolo del
 * norte son manchas pequenas y aisladas; los muros son estructuras largas.
 * Filtrar por tamano antes de buscar lineas quita la mayor parte del ruido sin
 * necesidad de reconocer texto.
 */

export interface ConnectedComponent {
  label: number;
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface LabelResult {
  /** Etiqueta por pixel; 0 = fondo. */
  labels: Int32Array;
  components: ConnectedComponent[];
}

/** Etiquetado por inundacion con vecindad de 8, iterativo para no desbordar la pila. */
export function labelComponents(mask: BinaryImage): LabelResult {
  const { width, height, data } = mask;
  const labels = new Int32Array(width * height);
  const components: ConnectedComponent[] = [];
  const stack: number[] = [];

  let nextLabel = 0;

  for (let start = 0; start < data.length; start += 1) {
    if (data[start] !== 1 || labels[start] !== 0) continue;

    nextLabel += 1;
    const component: ConnectedComponent = {
      label: nextLabel,
      area: 0,
      minX: width,
      minY: height,
      maxX: -1,
      maxY: -1,
    };

    labels[start] = nextLabel;
    stack.push(start);

    while (stack.length > 0) {
      const index = stack.pop();
      if (index === undefined) break;

      const x = index % width;
      const y = (index - x) / width;

      component.area += 1;
      if (x < component.minX) component.minX = x;
      if (y < component.minY) component.minY = y;
      if (x > component.maxX) component.maxX = x;
      if (y > component.maxY) component.maxY = y;

      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;

        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          const neighbour = ny * width + nx;
          if (data[neighbour] !== 1 || labels[neighbour] !== 0) continue;

          labels[neighbour] = nextLabel;
          stack.push(neighbour);
        }
      }
    }

    components.push(component);
  }

  return { labels, components };
}

/**
 * Elimina las componentes cuya caja envolvente es menor que `minSpan` pixeles.
 *
 * Se mide la caja y no el area: una pared fina y larga tiene poca area pero
 * mucha extension, y es justo lo que hay que conservar.
 */
export function removeSmallComponents(mask: BinaryImage, minSpan: number): BinaryImage {
  const { labels, components } = labelComponents(mask);
  const keep = new Set<number>();

  for (const component of components) {
    const span = Math.max(
      component.maxX - component.minX + 1,
      component.maxY - component.minY + 1,
    );
    if (span >= minSpan) keep.add(component.label);
  }

  const data = new Uint8Array(mask.data.length);
  for (let i = 0; i < data.length; i += 1) {
    const label = labels[i] ?? 0;
    data[i] = label !== 0 && keep.has(label) ? 1 : 0;
  }

  return { width: mask.width, height: mask.height, data };
}

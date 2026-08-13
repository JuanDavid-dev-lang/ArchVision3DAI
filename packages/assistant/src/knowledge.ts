/**
 * Base de conocimiento del editor.
 *
 * Responde a "como se hace X" sin llamar a ningun modelo. Cada entrada
 * describe algo que la aplicacion hace de verdad: si una funcion no existe,
 * aqui no aparece. Cuando el usuario pregunta por algo que no esta, el
 * planificador lo dice en vez de inventarlo.
 */

export interface KnowledgeEntry {
  id: string;
  /** Terminos que disparan la entrada, en minusculas y sin tildes. */
  keywords: string[];
  title: string;
  answer: string;
  followUps?: string[];
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "walls",
    keywords: ["muro", "muros", "pared", "paredes", "tabique", "trazar", "dibujar"],
    title: "Trazar muros",
    answer:
      "Pulsa L y haz clic en la planta para marcar el principio; cada clic siguiente cierra un tramo y " +
      "empieza el siguiente, asi que un recorrido completo se dibuja sin soltar la herramienta. " +
      "Escape termina la cadena. Con el ajuste a cuadricula activo los puntos se pegan a la reticula y a " +
      "los extremos de los muros ya existentes, que es lo que hace que las esquinas cierren. " +
      "Para medidas exactas, traza aproximado y luego corrige en el inspector de la derecha.",
    followUps: ["Crea una habitacion de 4x3", "Revisa el modelo"],
  },
  {
    id: "rooms",
    keywords: ["habitacion", "habitaciones", "cuarto", "recinto", "area", "superficie", "m2"],
    title: "Como aparecen las habitaciones",
    answer:
      "Las habitaciones no se dibujan: se detectan. Cuando los muros de un nivel forman un recorrido " +
      "cerrado, la aplicacion calcula el poligono interior y le asigna area y perimetro. Si una " +
      "habitacion no aparece, casi siempre hay una esquina abierta: reviso eso si me lo pides.",
    followUps: ["Revisa el modelo", "Cuanta area tengo"],
  },
  {
    id: "openings",
    keywords: ["puerta", "puertas", "ventana", "ventanas", "vano", "hueco"],
    title: "Puertas y ventanas",
    answer:
      "Pulsa P para puerta o N para ventana y haz clic sobre el muro: el hueco se coloca donde marcaste, " +
      "medido desde el inicio del muro. El vano pertenece al muro, de modo que si mueves el muro el hueco " +
      "viaja con el. Anchos y alturas se ajustan en el inspector.",
    followUps: ["Anade una puerta", "Anade una ventana de 1.2 x 1.1"],
  },
  {
    id: "materials",
    keywords: ["material", "materiales", "textura", "acabado", "pintar", "color", "ladrillo", "madera"],
    title: "Materiales y texturas",
    answer:
      "La tecla G abre la biblioteca y carga el pincel. Con el pincel activo, cada clic sobre una " +
      "superficie le aplica el material elegido; tambien puedes arrastrar el material desde la " +
      "biblioteca hasta el visor 3D. Las texturas se generan por procedimiento en tu equipo, no se " +
      "descargan: por eso el proyecto sigue siendo un archivo de texto ligero. El tamano del patron se " +
      "expresa en metros, asi que un ladrillo mide lo mismo en un muro grande que en uno pequeno.",
    followUps: ["Pinta los muros de ladrillo", "Que materiales estoy usando"],
  },
  {
    id: "plan-import",
    keywords: ["plano", "planos", "importar", "calcar", "escala", "calibrar", "pdf", "escanear"],
    title: "Importar un plano",
    answer:
      "Boton Plano en la barra superior. El orden importa: subir la imagen, marcar sobre ella una " +
      "medida que conozcas y escribir cuanto mide en la realidad, y solo entonces analizar. Sin escala " +
      "no hay medidas reales, y sin medidas reales la deteccion no distingue un muro de una linea de " +
      "cota. La deteccion propone muros en ambar; tu decides cuales entran, y el conjunto se deshace con " +
      "Ctrl+Z como cualquier otra edicion. El PDF se guarda pero todavia no se rasteriza: exportalo a PNG.",
    followUps: ["Revisa el modelo"],
  },
  {
    id: "navigation",
    keywords: ["camara", "girar", "orbitar", "zoom", "vista", "navegar", "mover", "encuadre"],
    title: "Moverse por la escena",
    answer:
      "En el visor 3D: boton izquierdo orbita, boton derecho desplaza, rueda acerca. F encuadra todo el " +
      "modelo. Las teclas 1, 2, 3 y 0 dan las vistas frontal, lateral, cenital y perspectiva. Tab alterna " +
      "entre planta, 3D y vista partida.",
  },
  {
    id: "history",
    keywords: ["deshacer", "rehacer", "historial", "ctrl+z", "error", "equivoque"],
    title: "Deshacer y rehacer",
    answer:
      "Ctrl+Z deshace y Ctrl+Y (o Ctrl+Shift+Z) rehace. Todo cambio del modelo pasa por el mismo " +
      "mecanismo, incluidos los que propongo yo y los muros que vienen de un plano importado, asi que " +
      "cualquier cosa que aplique se puede revertir de un solo paso.",
  },
  {
    id: "saving",
    keywords: ["guardar", "guardado", "autoguardado", "perder", "version", "versiones"],
    title: "Guardado",
    answer:
      "El proyecto se guarda solo poco despues de cada cambio; Ctrl+S fuerza el guardado. El estado " +
      "aparece en la barra inferior. Si abres el mismo proyecto en dos pestanas y ambas escriben, la " +
      "segunda avisa del conflicto en vez de pisar el trabajo de la primera.",
  },
  {
    id: "units",
    keywords: ["unidad", "unidades", "metros", "centimetros", "pies", "medida"],
    title: "Unidades",
    answer:
      "El modelo se guarda siempre en metros; la unidad que eliges solo cambia como se muestran y como " +
      "se leen los numeros. En los campos puedes escribir la unidad y se convierte sola: 350cm, 2 m, 10ft.",
  },
  {
    id: "measure",
    keywords: ["medir", "medida", "distancia", "regla", "cinta"],
    title: "Medir",
    answer:
      "Pulsa M y marca dos puntos en la planta: la distancia aparece en la barra inferior. Escape borra " +
      "la medida. Es una herramienta de consulta, no deja nada en el modelo.",
  },
  {
    id: "furniture",
    keywords: ["mueble", "muebles", "mobiliario", "sofa", "cama", "mesa", "amueblar"],
    title: "Mobiliario",
    answer:
      "Pulsa B para abrir la biblioteca de muebles, elige uno y haz clic donde lo quieras. Son " +
      "volumenes sencillos pensados para comprobar que el espacio funciona, no modelos de catalogo.",
    followUps: ["Anade un sofa", "Anade una cama"],
  },
  {
    id: "levels",
    keywords: ["nivel", "niveles", "planta", "piso", "pisos", "altura"],
    title: "Niveles",
    answer:
      "Cada nivel guarda su altura libre y sus objetos. El selector de la barra superior cambia el nivel " +
      "activo, que es donde va a parar todo lo que dibujes. Puedo anadir un nivel nuevo si me lo pides.",
    followUps: ["Anade un nivel", "Sube la altura a 2.7"],
  },
  {
    id: "billing",
    keywords: ["plan", "planes", "precio", "precios", "pagar", "pago", "suscripcion", "factura", "cobro", "cancelar"],
    title: "Planes y facturacion",
    answer:
      "El plan Free permite 3 proyectos y 500 MB, con el editor completo. Pro y Studio amplian proyectos, " +
      "almacenamiento, personas del equipo y versiones guardadas; se pagan en pesos, mensual o anual, y el " +
      "anual equivale a diez mensualidades. Se contrata en Configuracion, apartado Facturacion. " +
      "Puedes cancelar cuando quieras y conservas lo pagado hasta el final del periodo; si un cobro falla, " +
      "el servicio sigue una semana mas para que te de tiempo a arreglarlo.",
  },
  {
    id: "limits",
    keywords: ["exportar", "render", "renderizar", "glb", "obj", "colaborar", "compartir", "imprimir"],
    title: "Lo que todavia no hay",
    answer:
      "Aun no existen la exportacion a GLB, OBJ o PDF, el render con iluminacion realista, el estudio " +
      "solar ni el trabajo simultaneo de varias personas. Estan planificados, pero prefiero decirtelo " +
      "antes de que cuentes con ello.",
  },
];

/** Normaliza para comparar: minusculas y sin tildes. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Busca la entrada mas pertinente.
 *
 * Puntua por numero de palabras clave presentes y penaliza las entradas cuyo
 * termino aparece solo de pasada, para que "como pinto un muro" no acabe en la
 * entrada de muros cuando la pregunta es de materiales.
 */
export function findKnowledge(question: string): KnowledgeEntry | null {
  const text = normalize(question);
  let best: { entry: KnowledgeEntry; score: number } | null = null;

  for (const entry of KNOWLEDGE) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (text.includes(keyword)) score += keyword.length;
    }
    if (score === 0) continue;
    if (!best || score > best.score) best = { entry, score };
  }

  return best?.entry ?? null;
}

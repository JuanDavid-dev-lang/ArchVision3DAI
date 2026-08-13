# Asistente

Fase 6. Un asistente que conoce el proyecto abierto, propone cambios sobre él,
revisa el modelo y enseña a usar el editor.

La regla que gobierna todo el módulo: **el asistente nunca modifica la escena**.
Produce propuestas de comandos que el usuario acepta o rechaza. Es la misma
regla que la importación de planos, y por el mismo motivo: una sugerencia
automática aplicada sin revisión es un cambio que nadie pidió.

## Qué hace

| Capacidad | Cómo funciona |
| --- | --- |
| Modificar el modelo | Habitaciones, puertas, ventanas, cubiertas, niveles, columnas, mobiliario, materiales, alturas, renombrar, eliminar |
| Conocer el proyecto | Ficha resumida de la escena: niveles, habitaciones con área, métricas, materiales en uso, selección actual |
| Revisar el modelo | Diez reglas sobre coherencia y habitabilidad, con la medida que dispara cada aviso |
| Enseñar | Cuatro lecciones cuyos pasos se marcan solos cuando el documento demuestra que se hicieron |
| Responder preguntas | Base de conocimiento del editor, incluidas las funciones que **no** existen todavía |

## Arquitectura

```
packages/assistant/          Puro, sin DOM ni red: se ejecuta igual en el navegador y en el servidor
  digest.ts                  Ficha del proyecto (la "conciencia")
  diagnostics.ts             Reglas de revisión
  builders.ts                Construcción de comandos: TODA la decisión geométrica
  intents.ts                 Análisis del texto: solo intención y medidas
  knowledge.ts               Preguntas sobre el editor
  tutorial.ts                Lecciones y comprobación de progreso
  planner.ts                 Orquestador local
  prompt.ts                  Herramientas y prompt para el modelo de lenguaje

apps/web/lib/assistant/      Servidor: acceso al proyecto, validación, modelo
apps/web/lib/editor/         Cliente: conversación y aplicación de propuestas
```

### Por qué el paquete es puro

Porque así el mismo razonamiento corre en los dos lados. En el navegador
resuelve al instante y sobre la escena que el usuario tiene delante, **incluso
con cambios sin guardar**. En el servidor sirve de contexto al modelo de
lenguaje, que es donde vive la clave de API.

### El modelo de lenguaje no produce geometría

Las herramientas que se le ofrecen no son los comandos de la escena, sino
intenciones con medidas: `crear_habitacion(ancho, fondo)`,
`crear_vano(tipo, ancho, alto)`, `aplicar_material(material, cara)`. Los
identificadores y las coordenadas los pone `builders.ts`.

Un modelo de lenguaje inventa identificadores con toda naturalidad. Si nunca
los produce, no puede equivocarse en ellos, y lo único que queda por revisar
son números con significado que el usuario lee en la propuesta antes de
aceptarla.

Los esquemas son estrictos (`additionalProperties: false`, todas las claves
obligatorias, `null` para lo omitible) y una herramienta desconocida se ignora
en vez de interpretarse.

### Cuándo entra el modelo

Solo cuando las reglas locales no reconocen la petición. Para "crea una
habitación de 4x3" el modelo no aporta nada y sí cuesta latencia y dinero.

El proveedor se elige con `ASSISTANT_PROVIDER`:

- `local` (por defecto): todo se resuelve con reglas. No necesita clave ni
  conexión.
- `claude`: las peticiones no reconocidas van al modelo. Si falta
  `ANTHROPIC_API_KEY`, degrada a `local` en vez de fallar.

Un fallo del proveedor tampoco deja al usuario sin respuesta: se conserva la
del motor local, que ya estaba calculada.

## Validación

Todo comando propuesto pasa por el mismo esquema Zod que usa el editor, venga
de donde venga. Una acción con un solo comando inválido se descarta entera: la
mitad de una operación deja el modelo en un estado que el usuario no pidió ni
entiende. El panel avisa de cuántas propuestas se descartaron.

## Un solo paso de deshacer

Una habitación son cuatro muros pero una sola decisión. `dispatchBatch` aplica
los comandos de una propuesta como una única entrada del historial, y además es
todo o nada: si un comando falla, no se aplica ninguno.

## Revisión del modelo

| Regla | Qué comprueba | Umbral |
| --- | --- | --- |
| `opening-overflow` | Vano que sobresale del muro | — |
| `wall-duplicate` | Muros trazados encima de otros | Mismos extremos ±5 cm |
| `wall-tiny` | Muros de longitud casi nula | < 20 cm |
| `room-no-access` | Habitación sin puerta ni vano | — |
| `wall-open-end` | Extremo de muro que no toca ningún otro | ±5 cm |
| `room-daylight` | Superficie de ventana frente al suelo | < 10 % |
| `floor-low-ceiling` | Altura libre del nivel | < 2,20 m |
| `door-narrow` / `door-low` | Paso de puerta | < 70 cm / < 1,90 m |
| `stair-proportions` | Contrahuella y huella | > 19 cm / < 25 cm |
| `wall-no-material` | Muros con el acabado por defecto | — |

Los umbrales son **valores de uso corriente en vivienda, no una norma**. La
plataforma no certifica nada, y el texto de cada aviso lo dice cuando el dato
tiene consecuencias legales. Verifique siempre la norma que aplique donde vaya
a construirse.

Algunas reglas traen corrección aplicable (eliminar los muros duplicados,
llevar las puertas estrechas a 80 cm); otras no, porque la decisión es del
usuario y no de una regla.

## Tutorial

Los pasos no se marcan al leerlos, sino cuando el documento demuestra que
ocurrieron: `scene.rooms.length >= 1`, `scene.doors.length >= 1`,
`scene.walls.some(wall => wall.source === "import")`. Se mira el estado y no el
evento, de modo que el progreso sobrevive a un deshacer, a una recarga y a un
cambio de equipo. Quien llega a un proyecto a medias encuentra hechos los pasos
que ya estaban hechos.

## Límites

- No exporta, no renderiza, no calcula estructura y no hace tramites. Cuando se
  le pide algo de eso, lo dice en vez de improvisar.
- No mueve objetos existentes ni edita geometría trazada a mano, salvo las
  operaciones de la tabla de capacidades.
- El análisis de texto entiende español; el modelo de lenguaje responde en el
  idioma en que se le escriba.
- La conversación no se guarda en la base de datos: vive en la sesión del
  editor.

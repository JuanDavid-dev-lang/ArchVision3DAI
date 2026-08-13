import Link from "next/link";
import { brand } from "@archvision/config";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge, Panel } from "@/components/ui/surface";
import { PlanCards } from "@/components/billing/plan-cards";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Landing comercial.
 *
 * Secciones: hero, como funciona, reconstruccion con IA, editor 3D, planos
 * inteligentes, materiales, casos de uso, comparacion, precios, FAQ, CTA y
 * pie de pagina.
 */

const STEPS = [
  {
    number: "01",
    title: "Sube o dibuja",
    body: "Fotografias de fachada e interiores, un plano en PDF o imagen, o el croquis que dibujes en el editor 2D.",
  },
  {
    number: "02",
    title: "La IA analiza",
    body: "Detecta paredes, puertas, ventanas, niveles y materiales, y estima proporciones con un nivel de confianza por elemento.",
  },
  {
    number: "03",
    title: "Tu corriges",
    body: "Revisas cada deteccion sobre la imagen, calibras con una medida real conocida y ajustas lo que haga falta.",
  },
  {
    number: "04",
    title: "Modelo parametrico",
    body: "Obtienes paredes, vanos y cubiertas editables, no una malla congelada. Cambias un grosor y la geometria se regenera.",
  },
];

const FEATURES = [
  {
    title: "Reconstruccion con IA",
    body: "Deteccion de arquitectura, segmentacion de materiales y estimacion de profundidad. Cada resultado llega con su confianza y siempre es editable.",
    points: ["Deteccion de vanos", "Mapa de profundidad", "Calibracion con medidas reales"],
  },
  {
    title: "Editor 3D en el navegador",
    body: "Viewport WebGL con orbita, gizmos de transformacion, snapping a vertices y ejes, y outliner jerarquico por planta.",
    points: ["Sin instalar nada", "Vistas 2D / 3D / dividida", "Recorrido en primera persona"],
  },
  {
    title: "Planos inteligentes",
    body: "Importa un plano y conviertelo en estructura editable: paredes, habitaciones, cotas y areas calculadas automaticamente.",
    points: ["PDF, JPG, PNG, SVG", "Deteccion de habitaciones", "Areas y perimetros"],
  },
  {
    title: "Materiales y render",
    body: "Biblioteca PBR de ladrillo, concreto, madera, vidrio y ceramica, iluminacion solar por ubicacion y capturas hasta 4K.",
    points: ["Materiales PBR", "Simulacion solar", "Exportacion GLB, OBJ, STL"],
  },
];

const USE_CASES = [
  { title: "Remodelaciones", body: "Levanta el estado actual desde fotos y presenta la propuesta al cliente en la misma sesion." },
  { title: "Bienes raices", body: "Convierte un plano de venta en un recorrido 3D navegable desde el navegador." },
  { title: "Estudios de arquitectura", body: "Anteproyectos rapidos con areas, cantidades aproximadas y renders de presentacion." },
  { title: "Docencia", body: "Ensena composicion espacial sin la curva de aprendizaje de un CAD profesional." },
];

const FAQ = [
  {
    q: "Que tan precisas son las medidas obtenidas de fotografias?",
    a: "Dependen de la calidad y la cantidad de imagenes. Por eso el asistente de calibracion pide al menos una medida real conocida, por ejemplo el ancho de una puerta, y muestra la precision estimada del modelo. Siempre debes verificar las medidas criticas.",
  },
  {
    q: "Puedo editar lo que genera la inteligencia artificial?",
    a: "Si. Ninguna prediccion queda bloqueada: puedes mover, redimensionar, eliminar o crear cualquier elemento. La IA propone, tu decides.",
  },
  {
    q: "En que formatos puedo exportar?",
    a: "GLB, GLTF, OBJ, STL, el formato JSON interno versionado, imagenes PNG o JPG y plano en PDF.",
  },
  {
    q: "Necesito una tarjeta grafica potente?",
    a: "No para proyectos residenciales. El editor aplica instanciado, nivel de detalle y carga progresiva para funcionar en equipos modestos.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();
  const primaryHref = user ? "/dashboard" : "/register";
  const primaryLabel = user ? "Ir al dashboard" : "Crear proyecto";

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-ink-muted md:flex">
            <a href="#como-funciona" className="hover:text-ink">Como funciona</a>
            <a href="#capacidades" className="hover:text-ink">Capacidades</a>
            <a href="#precios" className="hover:text-ink">Precios</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button size="sm" variant="ghost">Iniciar sesion</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Crear cuenta</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="blueprint-grid-lg absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <Badge tone="accent">Reconstruccion asistida por IA</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink md:text-5xl">
            {brand.tagline}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-ink-muted">
            {brand.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={primaryHref}>
              <Button size="lg">{primaryLabel}</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">Ver demostracion</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-subtle">
            Cuenta de demostracion: demo@archvision.app / arquitectura2026
          </p>

          <dl className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line md:grid-cols-4">
            {[
              ["4", "metodos de creacion"],
              ["2D / 3D", "editores sincronizados"],
              ["PBR", "materiales y render"],
              ["GLB / OBJ / STL", "exportaciones"],
            ].map(([value, label]) => (
              <div key={label} className="bg-surface px-5 py-4">
                <dt className="font-mono text-lg text-ink">{value}</dt>
                <dd className="mt-0.5 text-xs text-ink-subtle">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">Como funciona</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          El flujo completo, de la imagen al modelo parametrico, manteniendo el
          control en tus manos en cada paso.
        </p>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.number}>
              <Panel className="h-full p-5">
                <span className="font-mono text-xs text-accent">{step.number}</span>
                <h3 className="mt-3 text-sm font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-ink-muted">{step.body}</p>
              </Panel>
            </li>
          ))}
        </ol>
      </section>

      {/* Capacidades */}
      <section id="capacidades" className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Capacidades</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {FEATURES.map((feature) => (
              <Panel key={feature.title} className="p-6">
                <h3 className="text-sm font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{feature.body}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {feature.points.map((point) => (
                    <li key={point}>
                      <Badge>{point}</Badge>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
        </div>
      </section>

      {/* Casos de uso */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">Casos de uso</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {USE_CASES.map((item) => (
            <Panel key={item.title} className="p-5">
              <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{item.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* Precios */}
      <section id="precios" className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">Planes</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Precios en pesos colombianos, IVA incluido. Puedes empezar gratis y
            cambiar de plan cuando quieras; al cancelar conservas lo pagado
            hasta el final del periodo.
          </p>
          <div className="mt-8">
            <PlanCards />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-2xl font-semibold tracking-tight">Preguntas frecuentes</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-panel border border-line bg-surface p-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-ink">
                {item.q}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Empieza con un proyecto en blanco o con la casa demo
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Sin instalaciones. Todo ocurre en el navegador.
            </p>
          </div>
          <Link href={primaryHref}>
            <Button size="lg">{primaryLabel}</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-line bg-surface/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-ink-subtle md:flex-row md:items-center md:justify-between">
          <Logo />
          <p>
            {brand.company} - {brand.foundedYear}. Los modelos generados
            automaticamente pueden contener errores dimensionales; verifica las
            medidas importantes.
          </p>
        </div>
      </footer>
    </div>
  );
}

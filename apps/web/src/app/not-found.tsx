import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs text-accent">404</p>
        <h1 className="mt-2 text-lg font-semibold text-ink">
          No encontramos esta pagina
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          El proyecto puede haber sido eliminado o no tienes acceso a el.
        </p>
        <Link href="/dashboard" className="mt-5 inline-block">
          <Button>Volver al dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

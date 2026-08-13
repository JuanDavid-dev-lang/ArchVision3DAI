import Link from "next/link";
import { brand } from "@archvision/config";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-12">
      <div aria-hidden className="blueprint-grid absolute inset-0 opacity-40" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-6 inline-flex">
          <Logo />
        </Link>
        {children}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-subtle">
          {brand.company}. Al continuar aceptas el tratamiento de tus datos
          conforme a la politica de privacidad.
        </p>
      </div>
    </div>
  );
}

import { brand } from "@archvision/config";
import { cn } from "@/lib/utils";

/**
 * Marca del producto. El texto proviene de @archvision/config, de modo que
 * renombrar la plataforma no obliga a tocar componentes.
 */
export function Logo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-md border border-accent/40 bg-accent/10"
      >
        <svg viewBox="0 0 24 24" className="size-4 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 10.5 12 4l9 6.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 9.2V20h13V9.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 20v-5.5h4V20" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!collapsed ? (
        <span className="text-sm font-semibold tracking-tight text-ink">
          {brand.name}
        </span>
      ) : null}
    </span>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Identidad del usuario y cierre de sesion. */
export function UserMenu({
  name,
  email,
  plan,
}: {
  name: string;
  email: string;
  plan: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-xs font-medium text-ink">{name}</p>
        <p className="text-[11px] text-ink-subtle">
          {email} · plan {plan}
        </p>
      </div>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-full border border-line bg-surface-3 text-xs font-medium text-ink"
      >
        {initials}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={logout}
        loading={loading}
        aria-label="Cerrar sesion"
        title="Cerrar sesion"
      >
        {!loading ? <LogOut className="size-4" aria-hidden /> : null}
      </Button>
    </div>
  );
}

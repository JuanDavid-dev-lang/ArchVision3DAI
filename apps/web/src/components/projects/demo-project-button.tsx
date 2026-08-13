"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Carga la casa demo (dos plantas, vanos, cubierta y mobiliario) como
 * proyecto nuevo del usuario. Sirve de banco de pruebas del editor.
 */
export function DemoProjectButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createDemo() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Casa demo Los Robles",
        description: "Proyecto de demostracion: dos plantas, cubierta a dos aguas y mobiliario basico.",
        type: "house",
        units: "m",
        creationMethod: "draw",
        floorsCount: 2,
        floorHeight: 2.9,
        demo: true,
      }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = (await response.json()) as { error?: { message?: string } };
      setError(payload.error?.message ?? "No fue posible crear el proyecto demo");
      return;
    }

    const payload = (await response.json()) as { data: { id: string } };
    router.push(`/projects/${payload.data.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={createDemo} loading={loading}>
        <Home className="size-4" aria-hidden />
        Cargar casa demo
      </Button>
      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}

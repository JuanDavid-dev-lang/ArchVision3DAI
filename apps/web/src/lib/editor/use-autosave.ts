"use client";

import { useCallback, useEffect, useRef } from "react";
import type { SceneDocument } from "@archvision/types";
import { useEditorStore } from "./store";

/**
 * Autoguardado.
 *
 * Espera a que el usuario deje de editar (debounce) y envia el documento
 * completo con la revision esperada. Si el servidor responde 409 significa que
 * otra sesion guardo antes: se marca el conflicto y se ofrece recargar en lugar
 * de sobrescribir en silencio.
 */

const DEBOUNCE_MS = 1200;

interface SaveResponse {
  data?: { revision: number };
  error?: { message?: string; details?: { currentRevision?: number } };
}

export function useAutosave() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const saveNow = useCallback(async (): Promise<boolean> => {
    const state = useEditorStore.getState();
    if (inFlight.current) return false;
    if (state.saveStatus === "saving") return false;
    if (!state.projectId) return false;

    inFlight.current = true;
    useEditorStore.setState({ saveStatus: "saving" });

    const scene: SceneDocument = state.scene;

    try {
      const response = await fetch(`/api/projects/${state.projectId}/scene`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene, expectedRevision: state.revision }),
      });

      const payload = (await response.json()) as SaveResponse;

      if (response.status === 409) {
        useEditorStore.setState({
          saveStatus: "conflict",
          message: {
            kind: "error",
            text: "Otra sesion modifico el proyecto. Recarga para continuar.",
          },
        });
        return false;
      }

      if (!response.ok || !payload.data) {
        useEditorStore.setState({
          saveStatus: "error",
          message: {
            kind: "error",
            text: payload.error?.message ?? "No fue posible guardar",
          },
        });
        return false;
      }

      // Si el usuario siguio editando durante la peticion, la escena queda
      // marcada como pendiente y el siguiente ciclo la guardara.
      const current = useEditorStore.getState();
      const stillDirty = current.scene !== scene;

      useEditorStore.setState({
        revision: payload.data.revision,
        saveStatus: stillDirty ? "dirty" : "saved",
        lastSavedAt: Date.now(),
      });
      return true;
    } catch {
      useEditorStore.setState({
        saveStatus: "error",
        message: { kind: "error", text: "Sin conexion con el servidor" },
      });
      return false;
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (state.saveStatus !== "dirty") return;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void saveNow();
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [saveNow]);

  // Aviso al cerrar la pestana con cambios sin guardar.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      const status = useEditorStore.getState().saveStatus;
      if (status === "dirty" || status === "saving") {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return { saveNow };
}

"use client";

import { useEffect } from "react";
import { useEditorStore } from "./store";

/**
 * Atajos de teclado del editor.
 *
 * Se ignoran cuando el foco esta en un campo de texto para no robar la
 * escritura en el inspector o en el outliner.
 */

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

export function useEditorShortcuts(options: { onSave: () => void }) {
  const { onSave } = options;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const store = useEditorStore.getState();

      if (event.key === "Escape") {
        store.setPaletteOpen(false);
        store.clearSelection();
        store.setMeasure({ start: null, end: null });
        return;
      }

      const ctrl = event.ctrlKey || event.metaKey;

      if (ctrl && event.key.toLowerCase() === "k") {
        event.preventDefault();
        store.setPaletteOpen(!store.paletteOpen);
        return;
      }

      if (ctrl && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave();
        return;
      }

      if (ctrl && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }

      if (ctrl && event.key.toLowerCase() === "y") {
        event.preventDefault();
        store.redo();
        return;
      }

      if (isTypingTarget(event.target)) return;

      switch (event.key.toLowerCase()) {
        case "v":
          store.setTool("select");
          break;
        case "l":
          store.setTool("wall");
          break;
        case "p":
          store.setTool("door");
          break;
        case "n":
          store.setTool("window");
          break;
        case "c":
          store.setTool("column");
          break;
        case "m":
          store.setTool("measure");
          break;
        case "b":
          store.setTool("furniture");
          break;
        case "k":
          // Calibrar solo tiene sentido con el panel del plano delante.
          store.setTool("calibrate");
          store.setPlanPanelOpen(true);
          break;
        case "a":
          // Abrir y cerrar con la misma tecla: el asistente ocupa un tercio de
          // la pantalla y se consulta a rachas.
          store.setAssistantOpen(!store.assistantOpen);
          break;
        case "g":
          // Pintar y abrir la biblioteca son la misma intencion: sin material
          // cargado el pincel no puede hacer nada.
          store.setTool("paint");
          store.setMaterialsOpen(true);
          break;
        case "f":
          store.requestView("fit");
          break;
        case "1":
          store.requestView("front");
          break;
        case "2":
          store.requestView("right");
          break;
        case "3":
          store.requestView("top");
          break;
        case "0":
          store.requestView("perspective");
          break;
        case "tab": {
          event.preventDefault();
          const order = ["2d", "3d", "split"] as const;
          const index = order.indexOf(store.viewMode);
          const next = order[(index + 1) % order.length];
          if (next) store.setViewMode(next);
          break;
        }
        case "delete":
        case "backspace": {
          if (store.selection.length === 0) break;
          event.preventDefault();
          store.dispatch({ type: "DELETE_OBJECTS", ids: store.selection });
          store.clearSelection();
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave]);
}

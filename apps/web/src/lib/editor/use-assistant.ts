"use client";

import { useCallback, useState } from "react";
import {
  greeting,
  planLocally,
  type AssistantContext,
  type AssistantMessage,
  type AssistantTurn,
  type ProposedAction,
} from "@archvision/assistant";
import { useEditorStore } from "./store";

/**
 * Conversacion con el asistente.
 *
 * El razonamiento vive en `@archvision/assistant`, que es codigo puro y
 * funciona igual en el navegador que en el servidor. Eso permite lo mejor de
 * las dos partes:
 *
 *  - las peticiones que las reglas reconocen se resuelven aqui mismo, sin
 *    latencia y sobre la escena que el usuario tiene delante, incluso con
 *    cambios sin guardar;
 *  - solo lo que las reglas no entienden viaja al servidor, que es donde
 *    esta la clave del modelo de lenguaje.
 *
 * Antes de esa llamada se fuerza el guardado: el servidor lee la escena
 * almacenada, y responder sobre una version anterior seria peor que tardar
 * medio segundo mas.
 */

interface ServerTurn extends AssistantTurn {
  rejected: number;
}

interface ApiResponse {
  data?: ServerTurn;
  error?: { message?: string };
}

let sequence = 0;
function messageId(): string {
  sequence += 1;
  return `m${sequence}-${Date.now().toString(36)}`;
}

/** Contexto del editor tal como lo ve el asistente. */
function currentContext(): AssistantContext {
  const state = useEditorStore.getState();
  return {
    projectName: state.projectName,
    selection: state.selection,
    activeFloorId: state.activeFloorId,
    tool: state.tool,
    displayUnit: state.scene.displayUnit,
  };
}

export interface AssistantHook {
  messages: AssistantMessage[];
  busy: boolean;
  actions: ProposedAction[];
  followUps: string[];
  source: AssistantTurn["source"] | null;
  send: (text: string) => Promise<void>;
  applyAction: (action: ProposedAction) => void;
  dismissAction: (actionId: string) => void;
  start: () => void;
  reset: () => void;
}

export function useAssistant(options: {
  onSave: () => Promise<boolean> | void;
}): AssistantHook {
  const messages = useEditorStore((state) => state.assistantMessages);
  const addMessages = useEditorStore((state) => state.addAssistantMessages);
  const clear = useEditorStore((state) => state.clearAssistant);
  const dispatchBatch = useEditorStore((state) => state.dispatchBatch);
  const setMessage = useEditorStore((state) => state.setMessage);

  const [busy, setBusy] = useState(false);
  const [actions, setActions] = useState<ProposedAction[]>([]);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [source, setSource] = useState<AssistantTurn["source"] | null>(null);

  const push = useCallback(
    (role: AssistantMessage["role"], text: string) => {
      addMessages([{ id: messageId(), role, text, at: Date.now() }]);
    },
    [addMessages],
  );

  /** Saludo inicial, calculado sobre el proyecto abierto. */
  const start = useCallback(() => {
    const state = useEditorStore.getState();
    if (state.assistantMessages.length > 0) return;
    push("assistant", greeting(state.scene, currentContext()));
    setFollowUps(
      state.scene.walls.length === 0
        ? ["Crea una habitacion de 4x3", "Empezar el tutorial", "Como importo un plano"]
        : ["Revisa el modelo", "Cuanta area tengo", "Anade una puerta"],
    );
  }, [push]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (question.length === 0 || busy) return;

      push("user", question);
      setActions([]);
      setBusy(true);

      try {
        const state = useEditorStore.getState();
        const context = currentContext();
        const local = planLocally({ message: question, scene: state.scene, context });

        let turn: AssistantTurn = local;

        if (local.fallback) {
          // Sincroniza antes de preguntar: el servidor razona sobre lo guardado.
          await options.onSave();

          const response = await fetch(
            `/api/projects/${state.projectId}/assistant`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: question,
                history: state.assistantMessages.slice(-12),
                selection: context.selection,
                activeFloorId: context.activeFloorId,
                tool: context.tool,
              }),
            },
          );

          const payload = (await response.json()) as ApiResponse;

          if (response.ok && payload.data) {
            turn = payload.data;
            if (payload.data.rejected > 0) {
              setMessage({
                kind: "error",
                text: `Descarte ${payload.data.rejected} propuesta(s) que no superaron la validacion.`,
              });
            }
          } else if (response.status === 429) {
            turn = {
              ...local,
              reply: payload.error?.message ?? "Demasiadas peticiones seguidas.",
            };
          }
          // Cualquier otro fallo deja la respuesta local, que ya esta calculada.
        }

        push("assistant", turn.reply);
        setActions(turn.actions);
        setFollowUps(turn.followUps);
        setSource(turn.source);
      } catch {
        push(
          "assistant",
          "No pude completar la consulta. Comprueba la conexion e intentalo otra vez.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, options, push, setMessage],
  );

  /** Aplica una propuesta como un unico paso de deshacer. */
  const applyAction = useCallback(
    (action: ProposedAction) => {
      const ok = dispatchBatch(action.commands);
      if (!ok) return;

      setActions((current) => current.filter((item) => item.id !== action.id));
      push("assistant", `Hecho: ${action.title}. Ctrl+Z lo deshace.`);
    },
    [dispatchBatch, push],
  );

  const dismissAction = useCallback((actionId: string) => {
    setActions((current) => current.filter((item) => item.id !== actionId));
  }, []);

  const reset = useCallback(() => {
    clear();
    setActions([]);
    setFollowUps([]);
    setSource(null);
  }, [clear]);

  return {
    messages,
    busy,
    actions,
    followUps,
    source,
    send,
    applyAction,
    dismissAction,
    start,
    reset,
  };
}

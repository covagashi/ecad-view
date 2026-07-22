import { useEffect } from "react";
import type { AmlProject } from "@covaga/e3d-core/aml";
import { useProjects } from "../state/ProjectsContext";
import type { ProjectDoc } from "../state/types";

interface WorkerResult {
  ok: boolean;
  project?: AmlProject;
  error?: string;
}

/**
 * Lanza el parseo del AutomationML del documento la primera vez que una vista
 * lo necesita. El parseo corre en un worker (el .aml puede superar los 30 MB);
 * el resultado queda en doc.aml y no se vuelve a calcular.
 */
export function useAml(doc: ProjectDoc | null): void {
  const { dispatch } = useProjects();
  const id = doc?.id;
  const needsParse = !!doc && doc.amlState === "idle" && doc.amlEntry !== null;

  useEffect(() => {
    if (!id || !needsParse) return;
    dispatch({ type: "AML_LOADING", id });
    const worker = new Worker(new URL("./amlWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      if (event.data.ok && event.data.project) {
        dispatch({ type: "AML_READY", id, aml: event.data.project });
      } else {
        console.warn("No se pudo parsear el AutomationML:", event.data.error);
        dispatch({ type: "AML_ERROR", id });
      }
      worker.terminate();
    };
    worker.onerror = (event) => {
      console.warn("Worker AML:", event.message);
      dispatch({ type: "AML_ERROR", id });
      worker.terminate();
    };
    // Se envía una copia y se transfiere su buffer: doc.amlEntry se conserva.
    const data = docAmlBytes(doc);
    if (data) worker.postMessage(data, [data.buffer as ArrayBuffer]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, needsParse, dispatch]);
}

/** Copia de los bytes del .aml (el buffer se transfiere al worker). */
function docAmlBytes(doc: ProjectDoc | null): Uint8Array | null {
  const data = doc?.amlEntry?.data;
  return data ? data.slice() : null;
}

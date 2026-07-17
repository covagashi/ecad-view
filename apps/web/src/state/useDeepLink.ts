import { useEffect, useRef } from "react";
import { useProjects } from "./ProjectsContext";
import {
  applyTargetToDoc,
  buildHashForDoc,
  docMatchesProject,
  parseHash,
  type DeepLinkTarget,
} from "./deeplink";

/**
 * Enlaces profundos: sincroniza el estado de vista con el hash de la URL.
 *
 *  - Al cargar con un hash presente, recuerda el objetivo y lo aplica en cuanto
 *    se abre un proyecto cuyo nombre casa con `p=` (encaja con la restauración
 *    de sesión, que abre proyectos de forma asíncrona). Si el proyecto abierto
 *    no casa, descarta el objetivo en silencio.
 *  - Con un proyecto ya abierto, un cambio de hash (pegar un enlace) se aplica
 *    directamente.
 *  - Mientras se navega, refleja el estado en el hash con replaceState (sin
 *    ensuciar el historial), de modo que copiar la barra de direcciones en
 *    cualquier momento ya es un enlace profundo.
 */
export function useDeepLink(): void {
  const { state, dispatch } = useProjects();
  const pendingRef = useRef<DeepLinkTarget | null | undefined>(undefined);
  const nonceRef = useRef(1);
  const selfHashRef = useRef<string | null>(null);

  // Captura el hash inicial una sola vez.
  if (pendingRef.current === undefined) {
    pendingRef.current = parseHash(window.location.hash);
  }

  const active = state.projects.find((doc) => doc.id === state.activeId);

  // Cambios de hash externos (pegar un enlace con un proyecto ya abierto).
  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === selfHashRef.current) return;
      const target = parseHash(window.location.hash);
      if (target) pendingRef.current = target;
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Aplica el objetivo pendiente cuando cambia el conjunto de proyectos.
  useEffect(() => {
    const target = pendingRef.current;
    if (!target) return;
    const match = state.projects.find(
      (doc) => !doc.loading && !doc.error && docMatchesProject(doc, target.project)
    );
    if (match) {
      pendingRef.current = null;
      dispatch({ type: "SET_ACTIVE", id: match.id });
      applyTargetToDoc(match, target, dispatch, () => ++nonceRef.current);
      return;
    }
    // Un proyecto que no casa ya terminó de cargar: se descarta en silencio.
    const someLoaded = state.projects.some((doc) => !doc.loading && !doc.error);
    if (someLoaded) pendingRef.current = null;
  }, [state.projects, dispatch]);

  // Refleja el estado del proyecto activo en el hash (replaceState).
  useEffect(() => {
    if (pendingRef.current) return; // Aún no aplicado: conserva el enlace tal cual.
    if (!active || active.loading || active.error) return;
    const hash = buildHashForDoc(active);
    if (hash === window.location.hash) return;
    selfHashRef.current = hash;
    history.replaceState(null, "", hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    active?.view,
    active?.pageIndex,
    active?.highlight,
    active?.picked,
    active?.modelIndex,
  ]);
}

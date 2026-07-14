import { useEffect, useRef, useState } from "react";
import type { E3dScene } from "@covaga/e3d-core";
import { Viewer, type ViewerHandle } from "../viewer/Viewer";
import { useProjects } from "../state/ProjectsContext";
import { resolvePickedToSchematic } from "../state/bridge";
import type { PickedPart } from "../state/types";
import { ModelSelectorCard } from "./ModelSelectorCard";
import { PartInfoCard } from "./PartInfoCard";
import { ViewPresets } from "./ViewPresets";

/**
 * Vista 3D: visor three.js con UI flotante — selector de modelo, tarjeta de
 * la pieza seleccionada (con puente "Ver en esquemas") y presets de cámara.
 */
export function Viewer3DView({ scene }: { scene: E3dScene | null }) {
  const { dispatch, active: doc } = useProjects();
  const viewerRef = useRef<ViewerHandle>(null);
  const nonceRef = useRef(0);
  const [isolated, setIsolated] = useState<number | null>(null);

  // Cambiar de modelo reconstruye la escena: se pierde el aislamiento.
  useEffect(() => setIsolated(null), [scene]);

  if (!doc) return null;

  const bridgeTarget = doc.picked ? resolvePickedToSchematic(doc, doc.picked) : null;

  const onPick = (info: Record<string, unknown> | null) => {
    dispatch({ type: "SET_PICKED", id: doc.id, picked: info as PickedPart | null });
  };

  const viewInSchematics = () => {
    if (!bridgeTarget) return;
    if (bridgeTarget.kind === "device") {
      const occurrence = bridgeTarget.device.occurrences[0];
      if (!occurrence) return;
      dispatch({
        type: "NAVIGATE",
        id: doc.id,
        pageIndex: occurrence.pageIndex,
        highlight: { elementId: occurrence.elementId, nonce: ++nonceRef.current },
        xrefInfo: `${bridgeTarget.device.label} · 1/${bridgeTarget.device.occurrences.length}`,
      });
    } else {
      dispatch({
        type: "NAVIGATE",
        id: doc.id,
        pageIndex: bridgeTarget.pageIndex,
        highlight: bridgeTarget.elementId
          ? { elementId: bridgeTarget.elementId, nonce: ++nonceRef.current }
          : null,
        xrefInfo: null,
      });
    }
  };

  const toggleIsolate = () => {
    const objectId = doc.picked?.objectId;
    if (objectId === undefined) return;
    const next = isolated === objectId ? null : objectId;
    viewerRef.current?.isolate(next);
    setIsolated(next);
  };

  const closeCard = () => {
    viewerRef.current?.clearSelection();
    dispatch({ type: "SET_PICKED", id: doc.id, picked: null });
  };

  return (
    <div className="viewport">
      <Viewer ref={viewerRef} scene={scene} onPickPart={onPick} />

      <ModelSelectorCard
        models={doc.epdzModels}
        modelIndex={doc.modelIndex}
        onSelect={(index) => {
          setIsolated(null);
          dispatch({ type: "SET_MODEL", id: doc.id, modelIndex: index });
        }}
      />

      <ViewPresets onPreset={(preset) => viewerRef.current?.setPreset(preset)} />

      {doc.picked && (
        <PartInfoCard
          doc={doc}
          picked={doc.picked}
          bridgeTarget={bridgeTarget}
          isolated={isolated !== null && isolated === doc.picked.objectId}
          onViewInSchematics={viewInSchematics}
          onToggleIsolate={toggleIsolate}
          onClose={closeCard}
        />
      )}
    </div>
  );
}

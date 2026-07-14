import { useEffect, useState } from "react";
import { getThumb } from "./db";
import { IconCube } from "../shell/icons";

export interface ProjectCardProps {
  name: string;
  metaLine: string;
  kind: "epdz" | "e3d";
  /** Clave de miniatura en IndexedDB (si el proyecto se abrió alguna vez). */
  thumbKey?: string;
  active?: boolean;
  onOpen: () => void;
}

/** Tarjeta de proyecto de la biblioteca: miniatura (o icono), nombre y metadatos. */
export function ProjectCard({ name, metaLine, kind, thumbKey, active, onOpen }: ProjectCardProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbKey) return;
    let url: string | null = null;
    let cancelled = false;
    void getThumb(thumbKey).then((blob) => {
      if (blob && !cancelled) {
        url = URL.createObjectURL(blob);
        setThumbUrl(url);
      }
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setThumbUrl(null);
    };
  }, [thumbKey]);

  return (
    <button className={`project-card${active ? " active" : ""}`} onClick={onOpen} title={name}>
      <span className={`card-thumb${thumbUrl ? " has-image" : ""}`}>
        {thumbUrl ? (
          <img src={thumbUrl} alt="" loading="lazy" />
        ) : (
          <IconCube size={44} className="card-thumb-icon" />
        )}
        {kind === "e3d" && <span className="card-badge">.e3d</span>}
      </span>
      <span className="card-body">
        <span className="card-name">{name}</span>
        <span className="card-meta">{metaLine}</span>
      </span>
    </button>
  );
}

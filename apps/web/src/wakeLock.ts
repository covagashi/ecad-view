import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "covaga.keepAwake";

/** Soporte de la Screen Wake Lock API en este navegador. */
export const wakeLockSupported =
  typeof navigator !== "undefined" && "wakeLock" in navigator;

function storedPreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Mantiene la pantalla encendida mientras se usa el visor (útil en revisiones
 * largas de esquemas o modelos 3D). Envuelve la Screen Wake Lock API, que
 * libera el bloqueo cuando la pestaña se oculta; por eso se vuelve a pedir al
 * regresar a primer plano mientras la preferencia siga activa.
 */
export function useWakeLock() {
  const [enabled, setEnabled] = useState(() => wakeLockSupported && storedPreference());
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  const release = useCallback(async () => {
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;
    if (sentinel) {
      try {
        await sentinel.release();
      } catch {
        // El bloqueo puede haberse liberado solo; no es un error accionable.
      }
    }
    setActive(false);
  }, []);

  const acquire = useCallback(async () => {
    if (!wakeLockSupported || sentinelRef.current || document.visibilityState !== "visible") {
      return;
    }
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setActive(true);
      // El sistema puede soltar el bloqueo (batería baja, cambio de app):
      // reflejamos ese estado para poder reintentar al volver.
      sentinel.addEventListener("release", () => {
        if (sentinelRef.current === sentinel) sentinelRef.current = null;
        setActive(false);
      });
    } catch {
      // Denegado o no disponible: dejamos la preferencia, pero sin bloqueo.
      setActive(false);
    }
  }, []);

  // Adquiere/libera según la preferencia y la reintenta al volver a primer plano.
  useEffect(() => {
    if (!enabled) {
      void release();
      return;
    }
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, acquire, release]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Sin persistencia; sigue vigente durante la sesión.
      }
      return next;
    });
  }, []);

  return { supported: wakeLockSupported, enabled, active, toggle };
}

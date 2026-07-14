import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "covaga.theme";
/** Color de la barra del sistema (meta theme-color) por tema. */
const META_COLORS: Record<Theme, string> = { dark: "#0e1116", light: "#e9ebe6" };

function detectTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // localStorage no disponible.
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", META_COLORS[theme]);
}

/** Tema claro/oscuro persistido; aplica data-theme en <html> y el meta theme-color. */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(detectTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Sin persistencia; el tema sigue aplicado durante la sesión.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}

/**
 * Valor actual de una variable CSS (p. ej. "--canvas") como color hex/rgb.
 * Para consumidores fuera del árbol de React (three.js).
 */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Observa cambios de data-theme en <html> y llama al callback. Devuelve un dispose. */
export function onThemeChange(callback: () => void): () => void {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

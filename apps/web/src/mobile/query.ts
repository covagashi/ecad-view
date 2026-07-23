import { useEffect, useState } from "react";

/**
 * Punto de corte móvil compartido por JS y CSS (mobile.css usa la misma
 * condición). Cubre el teléfono en vertical (ancho estrecho) y también en
 * horizontal (alto reducido), que es el formato preferente de uso.
 */
export const MOBILE_MEDIA_QUERY = "(max-width: 760px), (max-height: 500px)";

export function isMobileNow(): boolean {
  return window.matchMedia?.(MOBILE_MEDIA_QUERY).matches ?? false;
}

/** true en formato móvil (vertical u horizontal), reactivo a cambios. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(isMobileNow);
  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = () => setMobile(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

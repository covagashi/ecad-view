import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  LOCALES,
  LOCALE_NAMES,
  translations,
  type Locale,
  type TranslationKey,
} from "./translations";

export { LOCALES, LOCALE_NAMES };
export type { Locale, TranslationKey };

const STORAGE_KEY = "covaga.locale";

/** Parámetros a interpolar en la traducción con la sintaxis {nombre}. */
export type TranslateParams = Record<string, string | number>;

export interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslateParams) => string;
}

const I18nContext = createContext<I18n | null>(null);

/** Idioma inicial: preferencia guardada o, si no hay, el del navegador. */
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (LOCALES as readonly string[]).includes(stored)) return stored as Locale;
  } catch {
    // localStorage no disponible (p. ej. modo privado restrictivo).
  }
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const base = candidate?.toLowerCase().split("-")[0];
    if (base && (LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return "en";
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin persistencia; el idioma sigue funcionando durante la sesión.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18n>(
    () => ({
      locale,
      setLocale,
      t: (key, params) =>
        interpolate(translations[locale][key] ?? translations.en[key], params),
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n debe usarse dentro de <I18nProvider>");
  return context;
}

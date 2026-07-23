import type { AmlProject } from "@covaga/e3d-core/aml";

/**
 * Idioma de proyecto efectivo: la preferencia guardada en la pestaña si sigue
 * disponible; si no, el idioma del AML que mejor casa con el de la interfaz
 * ("" = textos del idioma del export).
 */
export function resolveAmlLang(
  aml: AmlProject | null,
  amlLang: string | null | undefined,
  locale: string
): string {
  if (!aml) return "";
  if (amlLang) return aml.languages.includes(amlLang) ? amlLang : "";
  return aml.languages.find((code) => code.toLowerCase().startsWith(locale)) ?? "";
}

/** Nombre legible de un código de idioma del AML ("es-ES" → "español (España)"). */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code);
    return name && name !== code ? `${name}` : code;
  } catch {
    return code;
  }
}

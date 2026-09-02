/**
 * Trocea un identificador estructurado EPLAN ("==EES==Page_macros++Infrastructure...")
 * en segmentos legibles, sustituyendo los separadores por espacios en los nombres.
 */
export function tokenizeStructure(structure: string): string[] {
  const tokens: string[] = [];
  const re = /(?:==|=|\+\+|\+|&)([^=+&#]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(structure)) !== null) {
    const value = match[1].replace(/_/g, " ").trim();
    if (value) tokens.push(value);
  }
  return tokens;
}

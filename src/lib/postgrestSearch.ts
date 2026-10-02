/**
 * Neutraliza caracteres con significado en filtros PostgREST `.or()` / ilike
 * (`%`, `,`, `(`, `)`, `.`, `*`, `\`, `"`) cambiándolos por `_` (comodín de un
 * solo carácter en ilike): así no rompen ni amplían el filtro, y "I.E. 123"
 * sigue encontrando "I.E. 123".
 */
export function sanitizeOrTerm(term: string): string {
  return term.replace(/[%,().*\\"]/g, "_").replace(/\s+/g, " ").trim();
}

/**
 * Extrae un mensaje legible de algo capturado en un catch(e: unknown).
 * `unknown` no garantiza que lo lanzado sea un Error (en JS se puede
 * hacer `throw "cualquier cosa"`), así que se verifica antes de asumir
 * que tiene `.message`.
 */
export function mensajeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
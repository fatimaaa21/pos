/**
 * Capacidades derivadas de tipo_negocio y de modulos_tenant. Centralizado aquí
 * para no repetir `tipo_negocio === "restaurante"` o `modulos.find(...)` en
 * cada componente — un solo lugar define la regla.
 */

export interface ModuloNegocio {
  tModulo:      string;
  bStateModulo: boolean;
}

/**
 * Extras (grupos_extras/opciones_extra) es una regla dura de tipo_negocio,
 * NO un módulo togglable: para "restaurante" siempre está disponible y nunca
 * se puede desactivar (decisión explícita — ver conversación de diseño).
 * Si en el futuro otro tipo de negocio necesita extras de forma opcional,
 * este es el único lugar que hay que tocar.
 */
export function tieneExtras(tipoNegocio: string): boolean {
  return tipoNegocio === "restaurante";
}

/**
 * Cocina SÍ es un módulo independiente y togglable (modulos_tenant) — no
 * depende de tipo_negocio ni de que "mesas" esté activo. Ver el comentario
 * en sistemas.ts (MODULOS_DISPONIBLES): esta independencia ya se rompió una
 * vez por error y se restauró a propósito. No condicionar esto a mesas.
 */
export function tieneCocina(modulos: ModuloNegocio[]): boolean {
  return modulos.some((m) => m.tModulo === "cocina" && m.bStateModulo);
}
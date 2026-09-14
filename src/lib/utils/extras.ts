import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrupoExtraConOpciones } from "@/types";

export type ExtraSeleccionado = { eCodOpcionExtra: string; eCantidad: number };

export type ExtraResuelto = {
  fkeCodOpcionExtra: string;
  fkeCodGrupoExtra:  string;
  eCantidad:         number;
  ePrecioExtra:      number;
  tNombreOpcion:     string;
  /** Insumo que esta opción representa — lo usa crearVenta para resolver
   *  recetas de producto que apuntan a un grupo en vez de a un insumo fijo. */
  fkeCodInsumoMaestro: string | null;
};

/**
 * Valida extrasSeleccionados contra la BD: pertenencia al producto, cantidad
 * máxima por opción, reglas de selección del grupo (única/múltiple, min/máx)
 * y grupos requeridos sin cubrir. Nunca confía en precio ni nombre venidos
 * del cliente — todo se resuelve aquí contra opciones_extra/grupos_extras.
 *
 * Usado tanto por crearVenta (venta directa / cobro de mesa) como por
 * agregarItemOrden (captura al mandar el item a cocina) — un solo lugar
 * define qué es una selección de extras válida.
 */
export async function validarExtrasSeleccionados(
  adminClient: SupabaseClient,
  eCodProduct: string,
  extrasSeleccionados: ExtraSeleccionado[] | undefined
): Promise<{ error: string } | { extras: ExtraResuelto[] }> {
  const extrasResueltos: ExtraResuelto[] = [];

  // Grupos asignados a ESTE producto vía la tabla puente — un grupo (ej.
  // "Tipo de leche") se define una vez y se reusa entre productos, así que
  // la pertenencia ya no se resuelve con grupo.fkeCodProduct (no existe),
  // sino con "¿hay una fila en producto_grupos_extras para este par?".
  const { data: asignaciones } = (await adminClient
    .from("producto_grupos_extras")
    .select(
      "fkeCodGrupoExtra, grupos_extras(eCodGrupoExtra, tNombreGrupo, bRequerido, bStateGrupoExtra, bSeleccionMultiple, eSeleccionMinima, eSeleccionMaxima)"
    )
    .eq("fkeCodProduct", eCodProduct)) as any;

  const gruposAsignados = new Map<string, any>();
  for (const a of asignaciones ?? []) {
    const g = a.grupos_extras;
    if (g?.bStateGrupoExtra) gruposAsignados.set(g.eCodGrupoExtra, g);
  }

  if (!extrasSeleccionados?.length) {
    const requerido = [...gruposAsignados.values()].find((g) => g.bRequerido);
    if (requerido) return { error: `Falta seleccionar una opción de "${requerido.tNombreGrupo}"` };
    return { extras: extrasResueltos };
  }

  const idsOpciones = extrasSeleccionados.map((e) => e.eCodOpcionExtra);

  const { data: opciones, error: errorOpciones } = (await adminClient
    .from("opciones_extra")
    .select("eCodOpcionExtra, tNombreOpcion, ePrecioExtra, eCantidadMaxima, bStateOpcionExtra, fkeCodGrupoExtra, fkeCodInsumoMaestro")
    .in("eCodOpcionExtra", idsOpciones)) as any;

  if (errorOpciones || !opciones || opciones.length !== idsOpciones.length) {
    return { error: "Uno o más extras seleccionados no existen" };
  }

  const gruposEnJuego = new Map<string, { seleccionadas: number; def: any }>();

  for (const opcion of opciones) {
    const grupo = gruposAsignados.get(opcion.fkeCodGrupoExtra);
    // No autorizado si: la opción está desactivada, o su grupo no está
    // asignado a ESTE producto (aunque exista y esté activo para otro).
    if (!opcion.bStateOpcionExtra || !grupo) {
      return { error: "No autorizado" };
    }

    const seleccion = extrasSeleccionados.find((e) => e.eCodOpcionExtra === opcion.eCodOpcionExtra)!;

    if (seleccion.eCantidad < 1 || seleccion.eCantidad > opcion.eCantidadMaxima) {
      return { error: `Cantidad inválida para el extra "${opcion.tNombreOpcion}"` };
    }

    extrasResueltos.push({
      fkeCodOpcionExtra:   opcion.eCodOpcionExtra,
      fkeCodGrupoExtra:    opcion.fkeCodGrupoExtra,
      eCantidad:           seleccion.eCantidad,
      ePrecioExtra:        opcion.ePrecioExtra,
      tNombreOpcion:       opcion.tNombreOpcion,
      fkeCodInsumoMaestro: opcion.fkeCodInsumoMaestro,
    });

    const key = opcion.fkeCodGrupoExtra;
    if (!gruposEnJuego.has(key)) gruposEnJuego.set(key, { seleccionadas: 0, def: grupo });
    gruposEnJuego.get(key)!.seleccionadas += 1;
  }

  for (const [, info] of gruposEnJuego) {
    if (!info.def.bSeleccionMultiple && info.seleccionadas > 1) {
      return { error: `"${info.def.tNombreGrupo}" solo permite una opción` };
    }
    if (info.def.eSeleccionMinima != null && info.seleccionadas < info.def.eSeleccionMinima) {
      return { error: `"${info.def.tNombreGrupo}" requiere al menos ${info.def.eSeleccionMinima} opción(es)` };
    }
    if (info.def.eSeleccionMaxima != null && info.seleccionadas > info.def.eSeleccionMaxima) {
      return { error: `"${info.def.tNombreGrupo}" permite máximo ${info.def.eSeleccionMaxima} opción(es)` };
    }
  }

  for (const g of gruposAsignados.values()) {
    if (g.bRequerido && !gruposEnJuego.has(g.eCodGrupoExtra)) {
      return { error: `Falta seleccionar una opción de "${g.tNombreGrupo}"` };
    }
  }

  return { extras: extrasResueltos };
}

/**
 * Obtiene grupos_extras + opciones_extra activos para un lote de productos,
 * agrupados por eCodProduct. Solo trae grupos/opciones activos (bState*) —
 * el POS no debe ofrecer un extra que el admin desactivó. Usado por
 * obtenerDatosMenuPOS/obtenerDatosMesasPOS para armar ProductoConStock.gruposExtras.
 */
export async function obtenerGruposExtrasPorProducto(
  adminClient: SupabaseClient,
  eCodsProduct: string[]
): Promise<Map<string, GrupoExtraConOpciones[]>> {
  const resultado = new Map<string, GrupoExtraConOpciones[]>();
  if (eCodsProduct.length === 0) return resultado;

  const { data: asignaciones } = await adminClient
    .from("producto_grupos_extras")
    .select("fkeCodProduct, fkeCodGrupoExtra, eOrden")
    .in("fkeCodProduct", eCodsProduct);

  if (!asignaciones?.length) return resultado;

  const idsGrupos = [...new Set(asignaciones.map((a) => a.fkeCodGrupoExtra))];

  const { data: grupos } = await adminClient
    .from("grupos_extras")
    .select("*")
    .in("eCodGrupoExtra", idsGrupos)
    .eq("bStateGrupoExtra", true);

  if (!grupos?.length) return resultado;

  const { data: opciones } = await adminClient
    .from("opciones_extra")
    .select("*")
    .in("fkeCodGrupoExtra", grupos.map((g: any) => g.eCodGrupoExtra))
    .eq("bStateOpcionExtra", true)
    .order("eOrden", { ascending: true });

  const opcionesPorGrupo = new Map<string, any[]>();
  for (const o of opciones ?? []) {
    const lista = opcionesPorGrupo.get(o.fkeCodGrupoExtra) ?? [];
    lista.push(o);
    opcionesPorGrupo.set(o.fkeCodGrupoExtra, lista);
  }

  const grupoPorId = new Map(
    (grupos as any[]).map((g) => [g.eCodGrupoExtra, { ...g, opciones: opcionesPorGrupo.get(g.eCodGrupoExtra) ?? [] }])
  );

  // Orden estable por eOrden de la asignación (permite que el mismo grupo
  // aparezca en distinta posición según el producto, si algún día se necesita).
  const asignacionesOrdenadas = [...asignaciones].sort((a, b) => a.eOrden - b.eOrden);

  for (const a of asignacionesOrdenadas) {
    const grupo = grupoPorId.get(a.fkeCodGrupoExtra);
    if (!grupo) continue; // grupo desactivado — se filtró arriba
    const lista = resultado.get(a.fkeCodProduct) ?? [];
    lista.push(grupo);
    resultado.set(a.fkeCodProduct, lista);
  }

  return resultado;
}

/**
 * Firma canónica de un conjunto de extras (id:cantidad, ordenado), para
 * decidir si dos líneas con el mismo producto deben colapsar en una sola.
 * Dos líneas con distintos extras NUNCA deben colapsar aunque compartan
 * producto y presentación — ese fue el bug encontrado en la RPC original.
 */
export function firmaExtras(pares: { id: string; eCantidad: number }[]): string {
  return [...pares].map((p) => `${p.id}:${p.eCantidad}`).sort().join(",");
}
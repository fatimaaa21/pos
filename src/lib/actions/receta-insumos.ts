"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { revalidatePath }    from "next/cache";
import type { RecetaInsumoConDatos, PresentacionConReceta, OpcionConReceta } from "@/types";

async function getPerfilActual(): Promise<{ fkeCodCompany: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil?.fkeCodCompany) return null;

  return { fkeCodCompany: perfil.fkeCodCompany };
}

/**
 * Resuelve fkeCodCompany dueño de una fila de receta, vía su OBJETIVO —
 * producto, presentación, u opción (siempre exactamente uno de los tres).
 * No se resuelve vía insumos_maestro porque una fila puede colgar de un
 * grupo de extras en vez de un insumo fijo (fkeCodInsumoMaestro null).
 */
async function companyDelObjetivo(
  adminClient: ReturnType<typeof createAdminClient>,
  fkeCodProduct:      string | null,
  fkeCodPresentacion: string | null,
  fkeCodOpcionExtra:  string | null = null
): Promise<string | null> {
  if (fkeCodPresentacion) {
    const { data } = await adminClient
      .from("presentaciones")
      .select("productos(fkeCodCompany)")
      .eq("eCodPresentacion", fkeCodPresentacion)
      .single();
    return (data as any)?.productos?.fkeCodCompany ?? null;
  }
  if (fkeCodProduct) {
    const { data } = await adminClient
      .from("productos")
      .select("fkeCodCompany")
      .eq("eCodProduct", fkeCodProduct)
      .single();
    return data?.fkeCodCompany ?? null;
  }
  if (fkeCodOpcionExtra) {
    const { data } = await adminClient
      .from("opciones_extra")
      .select("grupos_extras(fkeCodCompany)")
      .eq("eCodOpcionExtra", fkeCodOpcionExtra)
      .single();
    return (data as any)?.grupos_extras?.fkeCodCompany ?? null;
  }
  return null;
}

// ── LISTAR TODO LO QUE PUEDE TENER RECETA (presentaciones + productos directos) ──

export async function obtenerPresentacionesConReceta(): Promise<PresentacionConReceta[]> {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return [];

    const { data: pres, error: errorPres } = await adminClient
      .from("presentaciones")
      .select(`
        eCodPresentacion,
        tNombre,
        fkeCodProduct,
        bStatePresentacion,
        productos!inner ( eCodProduct, tNameProduct, fkeCodCompany ),
        receta_insumos ( eCodReceta )
      `)
      .eq("productos.fkeCodCompany", perfil.fkeCodCompany)
      .eq("bStatePresentacion", true);

    if (errorPres) console.error(errorPres);

    const idsConPresentacion = new Set((pres ?? []).map((row: any) => row.fkeCodProduct));

    const filasPresentacion: PresentacionConReceta[] = (pres ?? []).map((row: any) => ({
      eCodPresentacion: row.eCodPresentacion,
      tNombre:          row.tNombre,
      eCodProduct:      row.productos.eCodProduct,
      tNameProduct:     row.productos.tNameProduct,
      cantidadInsumos:  row.receta_insumos?.length ?? 0,
    }));

    const { data: productos, error: errorProductos } = await adminClient
      .from("productos")
      .select(`
        eCodProduct,
        tNameProduct,
        bStateProduct,
        receta_insumos ( eCodReceta )
      `)
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .eq("bStateProduct", true);

    if (errorProductos) console.error(errorProductos);

    const filasDirectas: PresentacionConReceta[] = (productos ?? [])
      .filter((p: any) => !idsConPresentacion.has(p.eCodProduct))
      .map((p: any) => ({
        eCodPresentacion: null,
        tNombre:          "Venta directa",
        eCodProduct:      p.eCodProduct,
        tNameProduct:     p.tNameProduct,
        cantidadInsumos:  p.receta_insumos?.length ?? 0,
      }));

    return [...filasPresentacion, ...filasDirectas]
      .sort((a, b) => a.tNameProduct.localeCompare(b.tNameProduct) || a.tNombre.localeCompare(b.tNombre));
  } catch (e) {
    console.error(e);
    return [];
  }
}

// ── LISTAR OPCIONES DE EXTRAS CON SU PROPIA RECETA ────────────────────────────
// Alimenta el tab "Extras" de /admin/insumos/recetas — opciones como
// "Cold Foam Vainilla" que tienen su propia receta multi-insumo, independiente
// de lo que lleve el producto al que se agregan.

export async function obtenerOpcionesConReceta(): Promise<OpcionConReceta[]> {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return [];

    const adminClient = createAdminClient();

    const { data: opciones, error } = await adminClient
      .from("opciones_extra")
      .select("eCodOpcionExtra, tNombreOpcion, fkeCodGrupoExtra, fkeCodInsumoMaestro, grupos_extras!inner(tNombreGrupo, fkeCodCompany), receta_insumos(eCodReceta)")
      .eq("grupos_extras.fkeCodCompany", perfil.fkeCodCompany)
      .is("fkeCodInsumoMaestro", null); // insumo fijo y receta propia son excluyentes — si ya tiene insumo, no puede tener receta

    if (error || !opciones) return [];

    return (opciones as any[])
      .map((o) => ({
        eCodOpcionExtra: o.eCodOpcionExtra,
        tNombreOpcion:   o.tNombreOpcion,
        eCodGrupoExtra:  o.fkeCodGrupoExtra,
        tNombreGrupo:    o.grupos_extras.tNombreGrupo,
        cantidadInsumos: o.receta_insumos?.length ?? 0,
      }))
      .sort((a, b) => a.tNombreGrupo.localeCompare(b.tNombreGrupo) || a.tNombreOpcion.localeCompare(b.tNombreOpcion));
  } catch {
    return [];
  }
}

// ── LISTAR RECETA DE UN PRODUCTO, PRESENTACIÓN, U OPCIÓN ──────────────────────
// Pasa exactamente uno de los tres identificadores; los otros dos deben ir null.

export async function obtenerRecetaPresentacion(
  fkeCodPresentacion: string | null,
  fkeCodProduct:      string | null = null,
  fkeCodOpcionExtra:  string | null = null
): Promise<{ receta?: RecetaInsumoConDatos[]; error?: string }> {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };
    if (!fkeCodPresentacion && !fkeCodProduct && !fkeCodOpcionExtra)
      return { error: "No se especificó qué receta consultar" };

    const adminClient = createAdminClient();

    const company = await companyDelObjetivo(adminClient, fkeCodProduct, fkeCodPresentacion, fkeCodOpcionExtra);
    if (!company) return { error: "No encontrado" };
    if (company !== perfil.fkeCodCompany) return { error: "No autorizado" };

    let query = adminClient
      .from("receta_insumos")
      .select("*, insumos_maestro(*), grupos_extras(tNombreGrupo)")
      .order("fhCreateReceta", { ascending: true });

    query = fkeCodPresentacion
      ? query.eq("fkeCodPresentacion", fkeCodPresentacion)
      : fkeCodProduct
        ? query.eq("fkeCodProduct", fkeCodProduct)
        : query.eq("fkeCodOpcionExtra", fkeCodOpcionExtra as string);

    const { data, error } = await query;

    if (error) return { error: error.message };

    const receta = (data ?? []).map((r: any) => ({
      eCodReceta:          r.eCodReceta,
      fkeCodPresentacion:  r.fkeCodPresentacion,
      fkeCodProduct:       r.fkeCodProduct,
      fkeCodOpcionExtra:   r.fkeCodOpcionExtra,
      fkeCodInsumoMaestro: r.fkeCodInsumoMaestro,
      fkeCodGrupoExtra:    r.fkeCodGrupoExtra,
      eCantidadNecesaria:  r.eCantidadNecesaria,
      tNombreInsumo:       r.insumos_maestro?.tNombre ?? null,
      tUnidadReceta:       r.insumos_maestro?.tUnidadReceta ?? null,
      tNombreGrupo:        r.grupos_extras?.tNombreGrupo ?? null,
    })) as RecetaInsumoConDatos[];

    return { receta };
  } catch (e: any) {
    return { error: e?.message ?? "Error desconocido" };
  }
}

// ── LISTAR INSUMOS DISPONIBLES PARA AGREGAR COMO INSUMO FIJO ─────────────────

export async function obtenerInsumosDisponiblesParaReceta(
  fkeCodPresentacion: string | null,
  fkeCodProduct:      string | null = null,
  fkeCodOpcionExtra:  string | null = null
): Promise<{ eCodInsumoMaestro: string; tNombre: string; tUnidadReceta: string }[]> {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return [];

    const adminClient = createAdminClient();

    const { data: todos, error: errTodos } = await adminClient
      .from("insumos_maestro")
      .select("eCodInsumoMaestro, tNombre, tUnidadReceta")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .eq("bStateInsumoMaestro", true)
      .order("tNombre", { ascending: true });

    if (errTodos || !todos) return [];

    let query = adminClient.from("receta_insumos").select("fkeCodInsumoMaestro");
    query = fkeCodPresentacion
      ? query.eq("fkeCodPresentacion", fkeCodPresentacion)
      : fkeCodProduct
        ? query.eq("fkeCodProduct", fkeCodProduct)
        : query.eq("fkeCodOpcionExtra", fkeCodOpcionExtra as string);

    const { data: yaEnReceta } = await query;

    const idsExcluidos = new Set((yaEnReceta ?? []).map((r) => r.fkeCodInsumoMaestro).filter(Boolean));
    return todos.filter((m) => !idsExcluidos.has(m.eCodInsumoMaestro));
  } catch {
    return [];
  }
}

// ── LISTAR GRUPOS DE EXTRAS DISPONIBLES (solo aplica a producto/presentación) ──
// Un grupo se resuelve al nivel del producto, nunca al nivel de una opción —
// no tendría sentido que la propia receta de una opción "se resuelva por
// grupo". Por eso esta función no acepta fkeCodOpcionExtra.

export async function obtenerGruposDisponiblesParaReceta(
  fkeCodPresentacion: string | null,
  fkeCodProduct:      string | null = null
): Promise<{ eCodGrupoExtra: string; tNombreGrupo: string }[]> {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return [];

    const adminClient = createAdminClient();

    let eCodProductoReal = fkeCodProduct;
    if (fkeCodPresentacion) {
      const { data: pres } = await adminClient
        .from("presentaciones")
        .select("fkeCodProduct")
        .eq("eCodPresentacion", fkeCodPresentacion)
        .single();
      eCodProductoReal = pres?.fkeCodProduct ?? null;
    }
    if (!eCodProductoReal) return [];

    const { data: asignados, error } = await adminClient
      .from("producto_grupos_extras")
      .select("fkeCodGrupoExtra, grupos_extras(eCodGrupoExtra, tNombreGrupo, bStateGrupoExtra, fkeCodCompany)")
      .eq("fkeCodProduct", eCodProductoReal);

    if (error || !asignados) return [];

    let query = adminClient.from("receta_insumos").select("fkeCodGrupoExtra");
    query = fkeCodPresentacion
      ? query.eq("fkeCodPresentacion", fkeCodPresentacion)
      : query.eq("fkeCodProduct", fkeCodProduct as string);

    const { data: yaEnReceta } = await query;
    const idsExcluidos = new Set((yaEnReceta ?? []).map((r) => r.fkeCodGrupoExtra).filter(Boolean));

    return (asignados as any[])
      .map((a) => a.grupos_extras)
      .filter((g) => g && g.bStateGrupoExtra && g.fkeCodCompany === perfil.fkeCodCompany && !idsExcluidos.has(g.eCodGrupoExtra))
      .map((g) => ({ eCodGrupoExtra: g.eCodGrupoExtra, tNombreGrupo: g.tNombreGrupo }));
  } catch {
    return [];
  }
}

// ── AGREGAR A LA RECETA ───────────────────────────────────────────────────────
// El form debe traer exactamente uno de (fkeCodPresentacion, fkeCodProduct,
// fkeCodOpcionExtra) como objetivo, y exactamente uno de (fkeCodInsumoMaestro,
// fkeCodGrupoExtra) como "qué" — fkeCodGrupoExtra solo tiene sentido cuando el
// objetivo es producto/presentación, nunca cuando el objetivo ya es una opción.

export async function agregarInsumoAReceta(formData: FormData) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const fkeCodPresentacion  = (formData.get("fkeCodPresentacion") as string) || null;
    const fkeCodProduct       = (formData.get("fkeCodProduct") as string) || null;
    const fkeCodOpcionExtra   = (formData.get("fkeCodOpcionExtra") as string) || null;
    const fkeCodInsumoMaestro = (formData.get("fkeCodInsumoMaestro") as string) || null;
    const fkeCodGrupoExtra    = (formData.get("fkeCodGrupoExtra") as string) || null;
    const eCantidadNecesaria  = parseFloat(formData.get("eCantidadNecesaria") as string);

    const objetivos = [fkeCodPresentacion, fkeCodProduct, fkeCodOpcionExtra].filter(Boolean);
    if (objetivos.length !== 1) return { error: "Se debe especificar exactamente un producto, presentación u opción" };

    const fuentesInsumo = [fkeCodInsumoMaestro, fkeCodGrupoExtra].filter(Boolean);
    if (fuentesInsumo.length !== 1) return { error: "Selecciona un insumo fijo o un grupo de extras, no ambos ni ninguno" };

    if (fkeCodGrupoExtra && fkeCodOpcionExtra)
      return { error: "Una opción no puede resolverse vía otro grupo — dale un insumo fijo" };

    if (fkeCodOpcionExtra) {
      // Mutuamente excluyente con el insumo directo (Extras > editar opción):
      // si la opción ya representa un insumo fijo, no puede además tener una
      // receta propia — se descontaría dos veces al momento de vender.
      const { data: opcionActual } = await adminClient
        .from("opciones_extra")
        .select("fkeCodInsumoMaestro")
        .eq("eCodOpcionExtra", fkeCodOpcionExtra)
        .single();

      if (opcionActual?.fkeCodInsumoMaestro) {
        return {
          error: "Esta opción ya tiene un insumo directo asignado en Extras. Quítalo primero si quieres darle una receta propia.",
        };
      }
    }

    if (isNaN(eCantidadNecesaria) || eCantidadNecesaria <= 0)
      return { error: "La cantidad debe ser mayor a 0" };

    const company = await companyDelObjetivo(adminClient, fkeCodProduct, fkeCodPresentacion, fkeCodOpcionExtra);
    if (!company) return { error: "No encontrado" };
    if (company !== perfil.fkeCodCompany) return { error: "No autorizado" };

    if (fkeCodInsumoMaestro) {
      const { data: maestro, error: errorMaestro } = await adminClient
        .from("insumos_maestro")
        .select("fkeCodCompany")
        .eq("eCodInsumoMaestro", fkeCodInsumoMaestro)
        .single();

      if (errorMaestro || !maestro) return { error: "Insumo no encontrado" };
      if (maestro.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };
    } else {
      const { data: grupo, error: errorGrupo } = await adminClient
        .from("grupos_extras")
        .select("fkeCodCompany")
        .eq("eCodGrupoExtra", fkeCodGrupoExtra as string)
        .single();

      if (errorGrupo || !grupo) return { error: "Grupo no encontrado" };
      if (grupo.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

      const eCodProductoReal = fkeCodProduct ?? (
        await adminClient.from("presentaciones").select("fkeCodProduct").eq("eCodPresentacion", fkeCodPresentacion as string).single()
      ).data?.fkeCodProduct;

      const { data: asignacion } = await adminClient
        .from("producto_grupos_extras")
        .select("eCodProductoGrupoExtra")
        .eq("fkeCodProduct", eCodProductoReal as string)
        .eq("fkeCodGrupoExtra", fkeCodGrupoExtra as string)
        .maybeSingle();

      if (!asignacion) {
        return { error: "Este grupo de extras no está asignado a este producto — actívalo primero desde Productos" };
      }
    }

    const { data, error } = await adminClient
      .from("receta_insumos")
      .insert({
        fkeCodPresentacion,
        fkeCodProduct,
        fkeCodOpcionExtra,
        fkeCodInsumoMaestro,
        fkeCodGrupoExtra,
        eCantidadNecesaria,
        fhCreateReceta: new Date().toISOString(),
      })
      .select("*, insumos_maestro(*), grupos_extras(tNombreGrupo)")
      .single();

    if (error) {
      return { error: `Error al agregar a la receta: ${error.message}` };
    }

    revalidatePath("/admin/productos");
    revalidatePath("/admin/insumos/recetas");
    return {
      item: {
        eCodReceta:          data.eCodReceta,
        fkeCodPresentacion:  data.fkeCodPresentacion,
        fkeCodProduct:       data.fkeCodProduct,
        fkeCodOpcionExtra:   data.fkeCodOpcionExtra,
        fkeCodInsumoMaestro: data.fkeCodInsumoMaestro,
        fkeCodGrupoExtra:    data.fkeCodGrupoExtra,
        eCantidadNecesaria:  data.eCantidadNecesaria,
        tNombreInsumo:       data.insumos_maestro?.tNombre ?? null,
        tUnidadReceta:       data.insumos_maestro?.tUnidadReceta ?? null,
        tNombreGrupo:        data.grupos_extras?.tNombreGrupo ?? null,
      } as RecetaInsumoConDatos,
    };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── EDITAR CANTIDAD ────────────────────────────────────────────────────────────

export async function editarCantidadRecetaInsumo(formData: FormData) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const eCodReceta         = formData.get("eCodReceta") as string;
    const eCantidadNecesaria = parseFloat(formData.get("eCantidadNecesaria") as string);

    if (!eCodReceta) return { error: "Receta no especificada" };
    if (isNaN(eCantidadNecesaria) || eCantidadNecesaria <= 0)
      return { error: "La cantidad debe ser mayor a 0" };

    const { data: recetaActual, error: errorLectura } = await adminClient
      .from("receta_insumos")
      .select("fkeCodProduct, fkeCodPresentacion, fkeCodOpcionExtra")
      .eq("eCodReceta", eCodReceta)
      .single();

    if (errorLectura || !recetaActual) return { error: "Receta no encontrada" };

    const company = await companyDelObjetivo(
      adminClient, recetaActual.fkeCodProduct, recetaActual.fkeCodPresentacion, recetaActual.fkeCodOpcionExtra
    );
    if (company !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { data, error } = await adminClient
      .from("receta_insumos")
      .update({
        eCantidadNecesaria,
        fhUpdateReceta: new Date().toISOString(),
      })
      .eq("eCodReceta", eCodReceta)
      .select("*, insumos_maestro(*), grupos_extras(tNombreGrupo)")
      .single();

    if (error) return { error: `Error al actualizar: ${error.message}` };

    revalidatePath("/admin/productos");
    revalidatePath("/admin/insumos/recetas");
    return {
      item: {
        eCodReceta:          data.eCodReceta,
        fkeCodPresentacion:  data.fkeCodPresentacion,
        fkeCodProduct:       data.fkeCodProduct,
        fkeCodOpcionExtra:   data.fkeCodOpcionExtra,
        fkeCodInsumoMaestro: data.fkeCodInsumoMaestro,
        fkeCodGrupoExtra:    data.fkeCodGrupoExtra,
        eCantidadNecesaria:  data.eCantidadNecesaria,
        tNombreInsumo:       data.insumos_maestro?.tNombre ?? null,
        tUnidadReceta:       data.insumos_maestro?.tUnidadReceta ?? null,
        tNombreGrupo:        data.grupos_extras?.tNombreGrupo ?? null,
      } as RecetaInsumoConDatos,
    };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── QUITAR DE LA RECETA ───────────────────────────────────────────────────────

export async function eliminarInsumoDeReceta(eCodReceta: string) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: recetaActual, error: errorLectura } = await adminClient
      .from("receta_insumos")
      .select("fkeCodProduct, fkeCodPresentacion, fkeCodOpcionExtra")
      .eq("eCodReceta", eCodReceta)
      .single();

    if (errorLectura || !recetaActual) return { error: "Receta no encontrada" };

    const company = await companyDelObjetivo(
      adminClient, recetaActual.fkeCodProduct, recetaActual.fkeCodPresentacion, recetaActual.fkeCodOpcionExtra
    );
    if (company !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { error } = await adminClient
      .from("receta_insumos")
      .delete()
      .eq("eCodReceta", eCodReceta);

    if (error) return { error: `Error al eliminar: ${error.message}` };

    revalidatePath("/admin/productos");
    revalidatePath("/admin/insumos/recetas");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
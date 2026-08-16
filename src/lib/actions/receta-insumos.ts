"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { revalidatePath }    from "next/cache";
import type { RecetaInsumoConDatos, PresentacionConReceta } from "@/types";

// ── LISTAR TODAS LAS PRESENTACIONES CON SU ESTADO DE RECETA ─────────────────
// Alimenta la vista dedicada /admin/insumos/recetas. Company-level (la receta
// no varía por sucursal), igual que presentaciones/productos.

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

    const { data, error } = await adminClient
      .from("presentaciones")
      .select(`
        eCodPresentacion,
        tNombre,
        bStatePresentacion,
        productos!inner ( eCodProduct, tNameProduct, fkeCodCompany ),
        receta_insumos ( eCodReceta )
      `)
      .eq("productos.fkeCodCompany", perfil.fkeCodCompany)
      .eq("bStatePresentacion", true)
      .order("tNombre", { ascending: true });

    if (error || !data) { console.error(error); return []; }

    return data
      .map((row: any) => ({
        eCodPresentacion: row.eCodPresentacion,
        tNombre:          row.tNombre,
        eCodProduct:      row.productos.eCodProduct,
        tNameProduct:     row.productos.tNameProduct,
        cantidadInsumos:  row.receta_insumos?.length ?? 0,
      }))
      .sort((a, b) => a.tNameProduct.localeCompare(b.tNameProduct) || a.tNombre.localeCompare(b.tNombre));
  } catch {
    return [];
  }
}

// ── LISTAR RECETA DE UNA PRESENTACIÓN ────────────────────────────────────────
// Trae las filas de receta_insumos con el nombre/unidad del insumo ya
// resuelto (join con insumos_maestro), para no hacer lookups extra en el modal.

export async function obtenerRecetaPresentacion(
  fkeCodPresentacion: string
): Promise<{ receta?: RecetaInsumoConDatos[]; error?: string }> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("receta_insumos")
      .select("*, insumos_maestro(*)")
      .eq("fkeCodPresentacion", fkeCodPresentacion)
      .order("fhCreateReceta", { ascending: true });

    if (error) return { error: error.message };

    const receta = (data ?? []).map((r: any) => ({
      eCodReceta:          r.eCodReceta,
      fkeCodPresentacion:  r.fkeCodPresentacion,
      fkeCodInsumoMaestro: r.fkeCodInsumoMaestro,
      eCantidadNecesaria:  r.eCantidadNecesaria,
      tNombreInsumo:       r.insumos_maestro.tNombre,
      tUnidadReceta:       r.insumos_maestro.tUnidadReceta,
    })) as RecetaInsumoConDatos[];

    return { receta };
  } catch (e: any) {
    return { error: e?.message ?? "Error desconocido" };
  }
}

// ── LISTAR INSUMOS DISPONIBLES PARA AGREGAR A LA RECETA ──────────────────────
// Insumos de la compañía que NO están ya en esta receta (para el selector).

export async function obtenerInsumosDisponiblesParaReceta(
  fkeCodPresentacion: string
): Promise<{ eCodInsumoMaestro: string; tNombre: string; tUnidadReceta: string }[]> {
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

    const { data: todos, error: errTodos } = await adminClient
      .from("insumos_maestro")
      .select("eCodInsumoMaestro, tNombre, tUnidadReceta")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .eq("bStateInsumoMaestro", true)
      .order("tNombre", { ascending: true });

    if (errTodos || !todos) return [];

    const { data: yaEnReceta } = await adminClient
      .from("receta_insumos")
      .select("fkeCodInsumoMaestro")
      .eq("fkeCodPresentacion", fkeCodPresentacion);

    const idsExcluidos = new Set((yaEnReceta ?? []).map((r) => r.fkeCodInsumoMaestro));
    return todos.filter((m) => !idsExcluidos.has(m.eCodInsumoMaestro));
  } catch {
    return [];
  }
}

// ── AGREGAR INSUMO A LA RECETA ────────────────────────────────────────────────

export async function agregarInsumoAReceta(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const fkeCodPresentacion  = formData.get("fkeCodPresentacion") as string;
    const fkeCodInsumoMaestro = formData.get("fkeCodInsumoMaestro") as string;
    const eCantidadNecesaria  = parseFloat(formData.get("eCantidadNecesaria") as string);

    if (!fkeCodPresentacion) return { error: "Presentación no especificada" };
    if (!fkeCodInsumoMaestro) return { error: "Selecciona un insumo" };
    if (isNaN(eCantidadNecesaria) || eCantidadNecesaria <= 0)
      return { error: "La cantidad debe ser mayor a 0" };

    const { data, error } = await adminClient
      .from("receta_insumos")
      .insert({
        fkeCodPresentacion,
        fkeCodInsumoMaestro,
        eCantidadNecesaria,
        fhCreateReceta: new Date().toISOString(),
      })
      .select("*, insumos_maestro(*)")
      .single();

    if (error) {
      // uq_receta_presentacion_insumo salta aquí si el insumo ya estaba en la receta
      return { error: `Error al agregar insumo a la receta: ${error.message}` };
    }

    revalidatePath("/admin/productos");
    return {
      item: {
        eCodReceta:          data.eCodReceta,
        fkeCodPresentacion:  data.fkeCodPresentacion,
        fkeCodInsumoMaestro: data.fkeCodInsumoMaestro,
        eCantidadNecesaria:  data.eCantidadNecesaria,
        tNombreInsumo:       data.insumos_maestro.tNombre,
        tUnidadReceta:       data.insumos_maestro.tUnidadReceta,
      } as RecetaInsumoConDatos,
    };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── EDITAR CANTIDAD ────────────────────────────────────────────────────────────

export async function editarCantidadRecetaInsumo(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const eCodReceta         = formData.get("eCodReceta") as string;
    const eCantidadNecesaria = parseFloat(formData.get("eCantidadNecesaria") as string);

    if (!eCodReceta) return { error: "Receta no especificada" };
    if (isNaN(eCantidadNecesaria) || eCantidadNecesaria <= 0)
      return { error: "La cantidad debe ser mayor a 0" };

    const { data, error } = await adminClient
      .from("receta_insumos")
      .update({
        eCantidadNecesaria,
        fhUpdateReceta: new Date().toISOString(),
      })
      .eq("eCodReceta", eCodReceta)
      .select("*, insumos_maestro(*)")
      .single();

    if (error) return { error: `Error al actualizar: ${error.message}` };

    revalidatePath("/admin/productos");
    return {
      item: {
        eCodReceta:          data.eCodReceta,
        fkeCodPresentacion:  data.fkeCodPresentacion,
        fkeCodInsumoMaestro: data.fkeCodInsumoMaestro,
        eCantidadNecesaria:  data.eCantidadNecesaria,
        tNombreInsumo:       data.insumos_maestro.tNombre,
        tUnidadReceta:       data.insumos_maestro.tUnidadReceta,
      } as RecetaInsumoConDatos,
    };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── QUITAR INSUMO DE LA RECETA ────────────────────────────────────────────────
// No borra el insumo ni afecta otras presentaciones — solo quita la línea
// de esta receta.

export async function eliminarInsumoDeReceta(eCodReceta: string) {
  try {
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("receta_insumos")
      .delete()
      .eq("eCodReceta", eCodReceta);

    if (error) return { error: `Error al eliminar: ${error.message}` };

    revalidatePath("/admin/productos");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
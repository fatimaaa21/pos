"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { revalidatePath }    from "next/cache";
import type { RecetaInsumoConDatos, PresentacionConReceta } from "@/types";

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

// ── LISTAR TODO LO QUE PUEDE TENER RECETA (presentaciones + productos directos) ──
// Alimenta la vista dedicada /admin/insumos/recetas. Company-level (la receta
// no varía por sucursal), igual que presentaciones/productos.
//
// La receta puede colgar de una presentación O de un producto sin
// presentaciones (venta directa) — nunca de ambos para el mismo producto,
// porque un producto solo cae en un caso o el otro. Se arman dos queries y
// se combinan en una sola lista para la tabla.

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

    // 1. Presentaciones (como antes)
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

    // 2. Productos SIN ninguna presentación (venta directa) — estos también
    //    pueden tener receta, colgada de fkeCodProduct en vez de
    //    fkeCodPresentacion.
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

// ── LISTAR RECETA DE UNA PRESENTACIÓN O UN PRODUCTO DIRECTO ──────────────────
// Trae las filas de receta_insumos con el nombre/unidad del insumo ya
// resuelto (join con insumos_maestro), para no hacer lookups extra en el modal.
// Pasa exactamente uno de los dos identificadores; el otro debe ir null.

export async function obtenerRecetaPresentacion(
  fkeCodPresentacion: string | null,
  fkeCodProduct:      string | null = null
): Promise<{ receta?: RecetaInsumoConDatos[]; error?: string }> {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };
    if (!fkeCodPresentacion && !fkeCodProduct) return { error: "No se especificó qué receta consultar" };

    const adminClient = createAdminClient();

    // Verificar dueño (empresa) del lado correcto.
    if (fkeCodPresentacion) {
      const { data: presentacion, error: errorPresentacion } = await adminClient
        .from("presentaciones")
        .select("productos(fkeCodCompany)")
        .eq("eCodPresentacion", fkeCodPresentacion)
        .single();

      if (errorPresentacion || !presentacion) return { error: "Presentación no encontrada" };
      if ((presentacion as any).productos?.fkeCodCompany !== perfil.fkeCodCompany) {
        return { error: "No autorizado" };
      }
    } else {
      const { data: producto, error: errorProducto } = await adminClient
        .from("productos")
        .select("fkeCodCompany")
        .eq("eCodProduct", fkeCodProduct as string)
        .single();

      if (errorProducto || !producto) return { error: "Producto no encontrado" };
      if (producto.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };
    }

    let query = adminClient
      .from("receta_insumos")
      .select("*, insumos_maestro(*)")
      .order("fhCreateReceta", { ascending: true });

    query = fkeCodPresentacion
      ? query.eq("fkeCodPresentacion", fkeCodPresentacion)
      : query.eq("fkeCodProduct", fkeCodProduct as string);

    const { data, error } = await query;

    if (error) return { error: error.message };

    const receta = (data ?? []).map((r: any) => ({
      eCodReceta:          r.eCodReceta,
      fkeCodPresentacion:  r.fkeCodPresentacion,
      fkeCodProduct:       r.fkeCodProduct,
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
// Igual que arriba: pasa exactamente uno de los dos identificadores.

export async function obtenerInsumosDisponiblesParaReceta(
  fkeCodPresentacion: string | null,
  fkeCodProduct:      string | null = null
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

    let query = adminClient.from("receta_insumos").select("fkeCodInsumoMaestro");
    query = fkeCodPresentacion
      ? query.eq("fkeCodPresentacion", fkeCodPresentacion)
      : query.eq("fkeCodProduct", fkeCodProduct as string);

    const { data: yaEnReceta } = await query;

    const idsExcluidos = new Set((yaEnReceta ?? []).map((r) => r.fkeCodInsumoMaestro));
    return todos.filter((m) => !idsExcluidos.has(m.eCodInsumoMaestro));
  } catch {
    return [];
  }
}

// ── AGREGAR INSUMO A LA RECETA ────────────────────────────────────────────────
// El form debe traer fkeCodPresentacion O fkeCodProduct (nunca ambos vacíos,
// nunca ambos con valor) — mismo contrato que la restricción CHECK en la BD.

export async function agregarInsumoAReceta(formData: FormData) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const fkeCodPresentacion  = (formData.get("fkeCodPresentacion") as string) || null;
    const fkeCodProduct       = (formData.get("fkeCodProduct") as string) || null;
    const fkeCodInsumoMaestro = formData.get("fkeCodInsumoMaestro") as string;
    const eCantidadNecesaria  = parseFloat(formData.get("eCantidadNecesaria") as string);

    if (!fkeCodPresentacion && !fkeCodProduct) return { error: "No se especificó producto o presentación" };
    if (fkeCodPresentacion && fkeCodProduct)   return { error: "No se puede recetar presentación y producto a la vez" };
    if (!fkeCodInsumoMaestro) return { error: "Selecciona un insumo" };
    if (isNaN(eCantidadNecesaria) || eCantidadNecesaria <= 0)
      return { error: "La cantidad debe ser mayor a 0" };

    // Verificar dueño (empresa) del lado correcto.
    if (fkeCodPresentacion) {
      const { data: presentacion, error: errorPresentacion } = await adminClient
        .from("presentaciones")
        .select("productos(fkeCodCompany)")
        .eq("eCodPresentacion", fkeCodPresentacion)
        .single();

      if (errorPresentacion || !presentacion) return { error: "Presentación no encontrada" };
      if ((presentacion as any).productos?.fkeCodCompany !== perfil.fkeCodCompany) {
        return { error: "No autorizado" };
      }
    } else {
      const { data: producto, error: errorProducto } = await adminClient
        .from("productos")
        .select("fkeCodCompany")
        .eq("eCodProduct", fkeCodProduct as string)
        .single();

      if (errorProducto || !producto) return { error: "Producto no encontrado" };
      if (producto.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };
    }

    const { data: maestro, error: errorMaestro } = await adminClient
      .from("insumos_maestro")
      .select("fkeCodCompany")
      .eq("eCodInsumoMaestro", fkeCodInsumoMaestro)
      .single();

    if (errorMaestro || !maestro) return { error: "Insumo no encontrado" };
    if (maestro.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { data, error } = await adminClient
      .from("receta_insumos")
      .insert({
        fkeCodPresentacion,
        fkeCodProduct,
        fkeCodInsumoMaestro,
        eCantidadNecesaria,
        fhCreateReceta: new Date().toISOString(),
      })
      .select("*, insumos_maestro(*)")
      .single();

    if (error) {
      // uq_receta_presentacion_insumo / uq_receta_producto_insumo saltan
      // aquí si el insumo ya estaba en la receta.
      return { error: `Error al agregar insumo a la receta: ${error.message}` };
    }

    revalidatePath("/admin/productos");
    revalidatePath("/admin/insumos/recetas");
    return {
      item: {
        eCodReceta:          data.eCodReceta,
        fkeCodPresentacion:  data.fkeCodPresentacion,
        fkeCodProduct:       data.fkeCodProduct,
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
// Sin cambios de fondo: opera por eCodReceta, que ya identifica un solo
// renglón sin importar si cuelga de presentación o de producto.

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
      .select("insumos_maestro(fkeCodCompany)")
      .eq("eCodReceta", eCodReceta)
      .single();

    if (errorLectura || !recetaActual) return { error: "Receta no encontrada" };
    if ((recetaActual as any).insumos_maestro?.fkeCodCompany !== perfil.fkeCodCompany) {
      return { error: "No autorizado" };
    }

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
    revalidatePath("/admin/insumos/recetas");
    return {
      item: {
        eCodReceta:          data.eCodReceta,
        fkeCodPresentacion:  data.fkeCodPresentacion,
        fkeCodProduct:       data.fkeCodProduct,
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
// No borra el insumo ni afecta otras presentaciones/productos — solo quita
// la línea de esta receta.

export async function eliminarInsumoDeReceta(eCodReceta: string) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: recetaActual, error: errorLectura } = await adminClient
      .from("receta_insumos")
      .select("insumos_maestro(fkeCodCompany)")
      .eq("eCodReceta", eCodReceta)
      .single();

    if (errorLectura || !recetaActual) return { error: "Receta no encontrada" };
    if ((recetaActual as any).insumos_maestro?.fkeCodCompany !== perfil.fkeCodCompany) {
      return { error: "No autorizado" };
    }

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
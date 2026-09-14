"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { GrupoExtra, OpcionExtra, GrupoExtraConOpciones } from "@/types";

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

/** Resuelve fkeCodCompany dueño de un grupo — directo, ya no pasa por producto. */
async function companyDelGrupo(adminClient: ReturnType<typeof createAdminClient>, eCodGrupoExtra: string) {
  const { data, error } = await adminClient
    .from("grupos_extras")
    .select("fkeCodCompany")
    .eq("eCodGrupoExtra", eCodGrupoExtra)
    .single();

  if (error || !data) return null;
  return data.fkeCodCompany;
}

/** Resuelve fkeCodCompany dueño de una opción, vía su grupo. */
async function companyDeOpcion(adminClient: ReturnType<typeof createAdminClient>, eCodOpcionExtra: string) {
  const { data, error } = await adminClient
    .from("opciones_extra")
    .select("fkeCodGrupoExtra, grupos_extras(fkeCodCompany)")
    .eq("eCodOpcionExtra", eCodOpcionExtra)
    .single();

  if (error || !data) return null;
  return (data as any).grupos_extras?.fkeCodCompany ?? null;
}

// ── GET: catálogo completo de grupos del negocio (vista de sidebar) ───────────

export async function obtenerGruposExtrasNegocio(): Promise<{ grupos?: GrupoExtraConOpciones[]; error?: string }> {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: grupos, error: errorGrupos } = await adminClient
      .from("grupos_extras")
      .select("*")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .order("eOrden", { ascending: true });

    if (errorGrupos) return { error: errorGrupos.message };
    if (!grupos?.length) return { grupos: [] };

    const { data: opciones, error: errorOpciones } = await adminClient
      .from("opciones_extra")
      .select("*")
      .in("fkeCodGrupoExtra", grupos.map((g) => g.eCodGrupoExtra))
      .order("eOrden", { ascending: true });

    if (errorOpciones) return { error: errorOpciones.message };

    const opcionesPorGrupo = new Map<string, OpcionExtra[]>();
    for (const o of (opciones as OpcionExtra[]) ?? []) {
      const lista = opcionesPorGrupo.get(o.fkeCodGrupoExtra) ?? [];
      lista.push(o);
      opcionesPorGrupo.set(o.fkeCodGrupoExtra, lista);
    }

    const resultado: GrupoExtraConOpciones[] = (grupos as GrupoExtra[]).map((g) => ({
      ...g,
      opciones: opcionesPorGrupo.get(g.eCodGrupoExtra) ?? [],
    }));

    return { grupos: resultado };
  } catch (e: any) {
    return { error: e?.message ?? "Error desconocido" };
  }
}

// ── GET: grupos del negocio + cuáles ya están asignados a UN producto ─────────
// Usado por el picker dentro de ModalEditarProducto.

export async function obtenerGruposParaProducto(
  eCodProduct: string
): Promise<{ grupos?: (GrupoExtraConOpciones & { asignado: boolean })[]; error?: string }> {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: producto, error: errorProducto } = await adminClient
      .from("productos")
      .select("fkeCodCompany")
      .eq("eCodProduct", eCodProduct)
      .single();

    if (errorProducto || !producto) return { error: "Producto no encontrado" };
    if (producto.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const todos = await obtenerGruposExtrasNegocio();
    if (todos.error) return { error: todos.error };

    const { data: asignaciones, error: errorAsig } = await adminClient
      .from("producto_grupos_extras")
      .select("fkeCodGrupoExtra")
      .eq("fkeCodProduct", eCodProduct);

    if (errorAsig) return { error: errorAsig.message };

    const idsAsignados = new Set((asignaciones ?? []).map((a) => a.fkeCodGrupoExtra));

    return {
      grupos: (todos.grupos ?? []).map((g) => ({ ...g, asignado: idsAsignados.has(g.eCodGrupoExtra) })),
    };
  } catch (e: any) {
    return { error: e?.message ?? "Error desconocido" };
  }
}

// ── ASIGNACIÓN: agregar/quitar un grupo de un producto ────────────────────────

export async function asignarGrupoAProducto(fkeCodProduct: string, fkeCodGrupoExtra: string) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: producto, error: errorProducto } = await adminClient
      .from("productos")
      .select("fkeCodCompany")
      .eq("eCodProduct", fkeCodProduct)
      .single();

    if (errorProducto || !producto) return { error: "Producto no encontrado" };
    if (producto.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const companyDelGrupoActual = await companyDelGrupo(adminClient, fkeCodGrupoExtra);
    if (companyDelGrupoActual !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { error } = await adminClient
      .from("producto_grupos_extras")
      .insert({ fkeCodProduct, fkeCodGrupoExtra });

    if (error) return { error: `Error al asignar grupo: ${error.message}` };

    revalidatePath("/admin/productos");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function quitarGrupoDeProducto(fkeCodProduct: string, fkeCodGrupoExtra: string) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: producto, error: errorProducto } = await adminClient
      .from("productos")
      .select("fkeCodCompany")
      .eq("eCodProduct", fkeCodProduct)
      .single();

    if (errorProducto || !producto) return { error: "Producto no encontrado" };
    if (producto.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { error } = await adminClient
      .from("producto_grupos_extras")
      .delete()
      .eq("fkeCodProduct", fkeCodProduct)
      .eq("fkeCodGrupoExtra", fkeCodGrupoExtra);

    if (error) return { error: `Error al quitar grupo: ${error.message}` };

    revalidatePath("/admin/productos");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── GRUPO: CREATE ─────────────────────────────────────────────────────────────

export async function crearGrupoExtra(formData: FormData) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const tNombreGrupo       = (formData.get("tNombreGrupo") as string)?.trim();
    const bSeleccionMultiple = formData.get("bSeleccionMultiple") === "true";
    const bRequerido         = formData.get("bRequerido") === "true";
    const eSeleccionMinimaRaw = formData.get("eSeleccionMinima") as string;
    const eSeleccionMaximaRaw = formData.get("eSeleccionMaxima") as string;

    const eSeleccionMinima = eSeleccionMinimaRaw ? parseInt(eSeleccionMinimaRaw) : null;
    const eSeleccionMaxima = eSeleccionMaximaRaw ? parseInt(eSeleccionMaximaRaw) : null;

    if (!tNombreGrupo) {
      return { error: "El nombre del grupo es obligatorio" };
    }
    if (!bSeleccionMultiple && (eSeleccionMinima || eSeleccionMaxima)) {
      return { error: "Mínimo/máximo de selección solo aplica a grupos de selección múltiple" };
    }
    if (eSeleccionMinima != null && eSeleccionMaxima != null && eSeleccionMinima > eSeleccionMaxima) {
      return { error: "El mínimo de selección no puede ser mayor que el máximo" };
    }

    const { count } = await adminClient
      .from("grupos_extras")
      .select("eCodGrupoExtra", { count: "exact", head: true })
      .eq("fkeCodCompany", perfil.fkeCodCompany);

    const { data, error } = await adminClient
      .from("grupos_extras")
      .insert({
        fkeCodCompany: perfil.fkeCodCompany,
        tNombreGrupo,
        bSeleccionMultiple,
        bRequerido,
        eSeleccionMinima,
        eSeleccionMaxima,
        eOrden:            count ?? 0,
        bStateGrupoExtra:  true,
        fhCreateGrupoExtra: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return { error: `Error al crear grupo: ${error.message}` };

    revalidatePath("/admin/extras");
    revalidatePath("/admin/productos");
    return { grupo: data as GrupoExtra };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── GRUPO: UPDATE ─────────────────────────────────────────────────────────────

export async function editarGrupoExtra(formData: FormData) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const eCodGrupoExtra     = formData.get("eCodGrupoExtra") as string;
    const tNombreGrupo       = (formData.get("tNombreGrupo") as string)?.trim();
    const bSeleccionMultiple = formData.get("bSeleccionMultiple") === "true";
    const bRequerido         = formData.get("bRequerido") === "true";
    const eSeleccionMinimaRaw = formData.get("eSeleccionMinima") as string;
    const eSeleccionMaximaRaw = formData.get("eSeleccionMaxima") as string;

    const eSeleccionMinima = eSeleccionMinimaRaw ? parseInt(eSeleccionMinimaRaw) : null;
    const eSeleccionMaxima = eSeleccionMaximaRaw ? parseInt(eSeleccionMaximaRaw) : null;

    if (!eCodGrupoExtra || !tNombreGrupo) return { error: "Datos inválidos" };
    if (!bSeleccionMultiple && (eSeleccionMinima || eSeleccionMaxima)) {
      return { error: "Mínimo/máximo de selección solo aplica a grupos de selección múltiple" };
    }
    if (eSeleccionMinima != null && eSeleccionMaxima != null && eSeleccionMinima > eSeleccionMaxima) {
      return { error: "El mínimo de selección no puede ser mayor que el máximo" };
    }

    const companyDelGrupoActual = await companyDelGrupo(adminClient, eCodGrupoExtra);
    if (companyDelGrupoActual !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { data, error } = await adminClient
      .from("grupos_extras")
      .update({
        tNombreGrupo,
        bSeleccionMultiple,
        bRequerido,
        eSeleccionMinima,
        eSeleccionMaxima,
        fhUpdateGrupoExtra: new Date().toISOString(),
      })
      .eq("eCodGrupoExtra", eCodGrupoExtra)
      .select()
      .single();

    if (error) return { error: `Error al editar: ${error.message}` };

    revalidatePath("/admin/extras");
    revalidatePath("/admin/productos");
    return { grupo: data as GrupoExtra };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── GRUPO: DELETE ─────────────────────────────────────────────────────────────
// Ya no bloquea por "sigue asignado a un producto" — quitar un grupo reusable
// libera su asignación en cascada (producto_grupos_extras tiene ON DELETE
// CASCADE), igual que borrar una categoría no debería requerir vaciarla antes.
// Sí sigue bloqueando si tiene opciones — esas hay que resolverlas primero.

export async function eliminarGrupoExtra(eCodGrupoExtra: string) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const companyDelGrupoActual = await companyDelGrupo(adminClient, eCodGrupoExtra);
    if (companyDelGrupoActual !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { data: opciones } = await adminClient
      .from("opciones_extra")
      .select("eCodOpcionExtra")
      .eq("fkeCodGrupoExtra", eCodGrupoExtra)
      .limit(1);

    if (opciones && opciones.length > 0) {
      return {
        error: "No puedes eliminar este grupo mientras tenga opciones. Elimina o desactiva sus opciones primero.",
      };
    }

    const { error } = await adminClient
      .from("grupos_extras")
      .delete()
      .eq("eCodGrupoExtra", eCodGrupoExtra);

    if (error) return { error: `Error al eliminar: ${error.message}` };

    revalidatePath("/admin/extras");
    revalidatePath("/admin/productos");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── GRUPO: TOGGLE ESTADO ──────────────────────────────────────────────────────

export async function toggleEstadoGrupoExtra(eCodGrupoExtra: string, nuevoEstado: boolean) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const companyDelGrupoActual = await companyDelGrupo(adminClient, eCodGrupoExtra);
    if (companyDelGrupoActual !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { error } = await adminClient
      .from("grupos_extras")
      .update({ bStateGrupoExtra: nuevoEstado, fhUpdateGrupoExtra: new Date().toISOString() })
      .eq("eCodGrupoExtra", eCodGrupoExtra);

    if (error) return { error: error.message };

    revalidatePath("/admin/extras");
    revalidatePath("/admin/productos");
    return { ok: true };
  } catch (e: any) {
    return { error: e?.message };
  }
}

// ── OPCIÓN: CREATE ────────────────────────────────────────────────────────────

export async function crearOpcionExtra(formData: FormData) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const fkeCodGrupoExtra = formData.get("fkeCodGrupoExtra") as string;
    const tNombreOpcion    = (formData.get("tNombreOpcion") as string)?.trim();
    const ePrecioExtra     = parseFloat(formData.get("ePrecioExtra") as string);
    const eCantidadMaxima  = parseInt(formData.get("eCantidadMaxima") as string) || 1;
    const fkeCodInsumoMaestro = (formData.get("fkeCodInsumoMaestro") as string) || null;

    if (!fkeCodGrupoExtra || !tNombreOpcion || isNaN(ePrecioExtra) || ePrecioExtra < 0) {
      return { error: "Nombre y precio son obligatorios" };
    }
    if (eCantidadMaxima < 1) return { error: "La cantidad máxima debe ser al menos 1" };

    const companyDelGrupoActual = await companyDelGrupo(adminClient, fkeCodGrupoExtra);
    if (companyDelGrupoActual !== perfil.fkeCodCompany) return { error: "No autorizado" };

    if (fkeCodInsumoMaestro) {
      const { data: maestro, error: errorMaestro } = await adminClient
        .from("insumos_maestro")
        .select("fkeCodCompany")
        .eq("eCodInsumoMaestro", fkeCodInsumoMaestro)
        .single();
      if (errorMaestro || !maestro) return { error: "Insumo no encontrado" };
      if (maestro.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };
    }

    const { count } = await adminClient
      .from("opciones_extra")
      .select("eCodOpcionExtra", { count: "exact", head: true })
      .eq("fkeCodGrupoExtra", fkeCodGrupoExtra);

    const { data, error } = await adminClient
      .from("opciones_extra")
      .insert({
        fkeCodGrupoExtra,
        tNombreOpcion,
        ePrecioExtra,
        eCantidadMaxima,
        fkeCodInsumoMaestro,
        eOrden:            count ?? 0,
        bStateOpcionExtra: true,
        fhCreateOpcionExtra: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return { error: `Error al crear opción: ${error.message}` };

    revalidatePath("/admin/extras");
    revalidatePath("/admin/productos");
    return { opcion: data as OpcionExtra };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── OPCIÓN: UPDATE ────────────────────────────────────────────────────────────

export async function editarOpcionExtra(formData: FormData) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const eCodOpcionExtra = formData.get("eCodOpcionExtra") as string;
    const tNombreOpcion   = (formData.get("tNombreOpcion") as string)?.trim();
    const ePrecioExtra    = parseFloat(formData.get("ePrecioExtra") as string);
    const eCantidadMaxima = parseInt(formData.get("eCantidadMaxima") as string) || 1;
    const fkeCodInsumoMaestro = (formData.get("fkeCodInsumoMaestro") as string) || null;

    if (!eCodOpcionExtra || !tNombreOpcion || isNaN(ePrecioExtra) || ePrecioExtra < 0) {
      return { error: "Datos inválidos" };
    }
    if (eCantidadMaxima < 1) return { error: "La cantidad máxima debe ser al menos 1" };

    const company = await companyDeOpcion(adminClient, eCodOpcionExtra);
    if (company !== perfil.fkeCodCompany) return { error: "No autorizado" };

    if (fkeCodInsumoMaestro) {
      const { data: maestro, error: errorMaestro } = await adminClient
        .from("insumos_maestro")
        .select("fkeCodCompany")
        .eq("eCodInsumoMaestro", fkeCodInsumoMaestro)
        .single();
      if (errorMaestro || !maestro) return { error: "Insumo no encontrado" };
      if (maestro.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

      // Mutuamente excluyente con la receta propia (Insumos > Recetas > Extras):
      // si ya tiene una receta multi-insumo, no puede además tener un insumo
      // directo — se descontaría dos veces al momento de vender.
      const { data: recetaExistente } = await adminClient
        .from("receta_insumos")
        .select("eCodReceta")
        .eq("fkeCodOpcionExtra", eCodOpcionExtra)
        .limit(1);

      if (recetaExistente && recetaExistente.length > 0) {
        return {
          error: "Esta opción ya tiene una receta propia en Insumos → Recetas → Extras. Quítala primero si quieres usar un insumo directo en su lugar.",
        };
      }
    }

    const { data, error } = await adminClient
      .from("opciones_extra")
      .update({
        tNombreOpcion,
        ePrecioExtra,
        eCantidadMaxima,
        fkeCodInsumoMaestro,
        fhUpdateOpcionExtra: new Date().toISOString(),
      })
      .eq("eCodOpcionExtra", eCodOpcionExtra)
      .select()
      .single();

    if (error) return { error: `Error al editar: ${error.message}` };

    revalidatePath("/admin/extras");
    revalidatePath("/admin/productos");
    return { opcion: data as OpcionExtra };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── OPCIÓN: DELETE ────────────────────────────────────────────────────────────

export async function eliminarOpcionExtra(eCodOpcionExtra: string) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const company = await companyDeOpcion(adminClient, eCodOpcionExtra);
    if (company !== perfil.fkeCodCompany) return { error: "No autorizado" };

    // Bloquear si ya se vendió alguna vez con esta opción — detalle_venta_extras
    // guarda snapshot de nombre/precio, así que la venta histórica sobrevive de
    // todas formas, pero borrar la opción viva mientras siga en carritos abiertos
    // (ordenes_mesa_detalle_extras / cuenta_detalle_producto_extras) rompería
    // esas líneas activas. Los FK de esas tres tablas ya lo impedirían a nivel
    // de BD, pero preferimos un mensaje claro en vez del error crudo de Postgres.
    const [enVentas, enOrdenes, enCuentas] = await Promise.all([
      adminClient.from("detalle_venta_extras").select("eCodDetalleExtra").eq("fkeCodOpcionExtra", eCodOpcionExtra).limit(1),
      adminClient.from("ordenes_mesa_detalle_extras").select("eCodDetalleExtra").eq("fkeCodOpcionExtra", eCodOpcionExtra).limit(1),
      adminClient.from("cuenta_detalle_producto_extras").select("eCodDetalleExtra").eq("fkeCodOpcionExtra", eCodOpcionExtra).limit(1),
    ]);

    if ((enVentas.data?.length ?? 0) > 0 || (enOrdenes.data?.length ?? 0) > 0 || (enCuentas.data?.length ?? 0) > 0) {
      return {
        error: "Esta opción ya se usó en ventas u órdenes activas. Desactívala en vez de eliminarla.",
      };
    }

    const { error } = await adminClient
      .from("opciones_extra")
      .delete()
      .eq("eCodOpcionExtra", eCodOpcionExtra);

    if (error) return { error: `Error al eliminar: ${error.message}` };

    revalidatePath("/admin/extras");
    revalidatePath("/admin/productos");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── OPCIÓN: TOGGLE ESTADO ─────────────────────────────────────────────────────

export async function toggleEstadoOpcionExtra(eCodOpcionExtra: string, nuevoEstado: boolean) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const company = await companyDeOpcion(adminClient, eCodOpcionExtra);
    if (company !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { error } = await adminClient
      .from("opciones_extra")
      .update({ bStateOpcionExtra: nuevoEstado, fhUpdateOpcionExtra: new Date().toISOString() })
      .eq("eCodOpcionExtra", eCodOpcionExtra);

    if (error) return { error: error.message };

    revalidatePath("/admin/extras");
    revalidatePath("/admin/productos");
    return { ok: true };
  } catch (e: any) {
    return { error: e?.message };
  }
}

// ── GET: insumos del negocio, para el selector "¿qué insumo represento?" ──────

export async function obtenerInsumosMaestroNegocio(): Promise<{ eCodInsumoMaestro: string; tNombre: string }[]> {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return [];

    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("insumos_maestro")
      .select("eCodInsumoMaestro, tNombre")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .eq("bStateInsumoMaestro", true)
      .order("tNombre", { ascending: true });

    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
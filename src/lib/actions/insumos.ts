"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { getSucursalContext } from "@/lib/utils/sucursal";
import { revalidatePath }    from "next/cache";
import type { InsumoConStock, InsumoMaestro } from "@/types";

// ── Helper interno: junta maestro + stock en el shape InsumoConStock ────────
function combinar(stockRow: any): InsumoConStock {
  const maestro = stockRow.insumos_maestro;
  return {
    ...maestro,
    ...stockRow,
    insumos_maestro: undefined,
  } as InsumoConStock;
}

// ── LISTAR ──────────────────────────────────────────────────────────────────
// Join stock (filtrado por sucursal actual, o todas las de la compañía si el
// admin tiene "todas las sucursales" seleccionado) con su maestro.

export async function getInsumos(): Promise<InsumoConStock[]> {
  try {
    const adminClient = createAdminClient();
    const ctx = await getSucursalContext();

    let query = adminClient
      .from("insumos_stock")
      .select("*, insumos_maestro!inner(*)")
      .eq("insumos_maestro.fkeCodCompany", ctx.fkeCodCompany)
      .eq("bStateInsumoStock", true)
      .order("fhCreateInsumoStock", { ascending: false });

    if (ctx.fkeCodSucursal) {
      query = query.eq("fkeCodSucursal", ctx.fkeCodSucursal);
    }

    const { data, error } = await query;
    if (error) { console.error(error); return []; }
    return (data ?? []).map(combinar);
  } catch {
    return [];
  }
}

// ── CREAR INSUMO NUEVO (maestro + stock juntos) ──────────────────────────────
// Caso normal: el insumo no existe todavía en ninguna sucursal.

export async function crearInsumo(formData: FormData) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return { error: "Negocio no encontrado" };

    const fkeCodSucursal    = formData.get("fkeCodSucursal") as string;
    const tNombre           = (formData.get("tNombre") as string)?.trim();
    const tUnidadCompra     = (formData.get("tUnidadCompra") as string)?.trim();
    const tUnidadReceta     = (formData.get("tUnidadReceta") as string)?.trim();
    const eFactorConversion = parseFloat(formData.get("eFactorConversion") as string);
    const eCostoUnitario    = parseFloat(formData.get("eCostoUnitario") as string) || 0;
    const eCantidadStock    = parseFloat(formData.get("eCantidadStock") as string) || 0;
    const eStockMinimo      = parseFloat(formData.get("eStockMinimo") as string) || 0;

    if (!fkeCodSucursal) return { error: "Selecciona una sucursal" };
    if (!tNombre) return { error: "El nombre es requerido" };
    if (!tUnidadCompra || !tUnidadReceta)
      return { error: "Unidad de compra y unidad de receta son requeridas" };
    if (isNaN(eFactorConversion) || eFactorConversion <= 0)
      return { error: "El factor de conversión debe ser mayor a 0" };

    const ahora = new Date().toISOString();

    const { data: maestro, error: errMaestro } = await adminClient
      .from("insumos_maestro")
      .insert({
        fkeCodCompany:  perfil.fkeCodCompany,
        tNombre,
        tUnidadCompra,
        tUnidadReceta,
        eFactorConversion,
        bStateInsumoMaestro: true,
        fhCreateInsumoMaestro: ahora,
      })
      .select()
      .single();

    if (errMaestro) return { error: `Error al crear insumo: ${errMaestro.message}` };

    const { data: stock, error: errStock } = await adminClient
      .from("insumos_stock")
      .insert({
        fkeCodInsumoMaestro: maestro.eCodInsumoMaestro,
        fkeCodSucursal,
        eCantidadStock,
        eStockMinimo,
        eCostoUnitario,
        bStateInsumoStock: true,
        fhCreateInsumoStock: ahora,
      })
      .select()
      .single();

    if (errStock) {
      // Rollback manual: el maestro ya se creó pero el stock falló.
      // Sin esto, queda un insumo_maestro huérfano sin stock en ninguna sucursal.
      await adminClient.from("insumos_maestro").delete().eq("eCodInsumoMaestro", maestro.eCodInsumoMaestro);
      return { error: `Error al crear stock inicial: ${errStock.message}` };
    }

    revalidatePath("/admin/insumos");
    return { insumo: { ...maestro, ...stock } as InsumoConStock };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── LISTAR MAESTROS DISPONIBLES PARA UNA SUCURSAL ────────────────────────────
// Insumos que ya existen en la compañía pero NO tienen fila de stock activa
// en la sucursal indicada. Alimenta el selector de "agregar insumo existente".

export async function getInsumosMaestroDisponibles(
  fkeCodSucursal: string
): Promise<InsumoMaestro[]> {
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
      .select("*")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .eq("bStateInsumoMaestro", true)
      .order("tNombre", { ascending: true });

    if (errTodos || !todos) return [];

    const { data: yaEnSucursal } = await adminClient
      .from("insumos_stock")
      .select("fkeCodInsumoMaestro")
      .eq("fkeCodSucursal", fkeCodSucursal)
      .eq("bStateInsumoStock", true);

    const idsExcluidos = new Set((yaEnSucursal ?? []).map((r) => r.fkeCodInsumoMaestro));
    return (todos as InsumoMaestro[]).filter((m) => !idsExcluidos.has(m.eCodInsumoMaestro));
  } catch {
    return [];
  }
}

// ── AGREGAR INSUMO EXISTENTE A UNA NUEVA SUCURSAL ────────────────────────────
// Solo crea la fila de stock — el maestro ya existe y no se toca.

export async function agregarInsumoExistenteASucursal(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const fkeCodInsumoMaestro = formData.get("fkeCodInsumoMaestro") as string;
    const fkeCodSucursal      = formData.get("fkeCodSucursal") as string;
    const eCostoUnitario      = parseFloat(formData.get("eCostoUnitario") as string) || 0;
    const eCantidadStock      = parseFloat(formData.get("eCantidadStock") as string) || 0;
    const eStockMinimo        = parseFloat(formData.get("eStockMinimo") as string) || 0;

    if (!fkeCodInsumoMaestro) return { error: "Selecciona un insumo" };
    if (!fkeCodSucursal) return { error: "Selecciona una sucursal" };

    const { data: maestro, error: errMaestro } = await adminClient
      .from("insumos_maestro")
      .select("*")
      .eq("eCodInsumoMaestro", fkeCodInsumoMaestro)
      .single();

    if (errMaestro || !maestro) return { error: "Insumo no encontrado" };

    const { data: stock, error: errStock } = await adminClient
      .from("insumos_stock")
      .insert({
        fkeCodInsumoMaestro,
        fkeCodSucursal,
        eCantidadStock,
        eStockMinimo,
        eCostoUnitario,
        bStateInsumoStock: true,
        fhCreateInsumoStock: new Date().toISOString(),
      })
      .select()
      .single();

    if (errStock) {
      // Constraint uq_insumos_stock_maestro_sucursal salta aquí si ya existía
      return { error: `Este insumo ya tiene stock en esa sucursal, o hubo un error: ${errStock.message}` };
    }

    revalidatePath("/admin/insumos");
    return { insumo: { ...maestro, ...stock } as InsumoConStock };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── EDITAR ──────────────────────────────────────────────────────────────────
// Actualiza AMBAS partes en un solo formulario. Los campos de "maestro"
// (nombre, unidades, factor de conversión) afectan TODAS las sucursales que
// comparten este insumo — el modal debe advertirlo. Los campos de "stock"
// (costo, stock mínimo) afectan solo esta sucursal.

export async function editarInsumo(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const eCodInsumoMaestro = formData.get("eCodInsumoMaestro") as string;
    const eCodInsumoStock   = formData.get("eCodInsumoStock") as string;
    const tNombre           = (formData.get("tNombre") as string)?.trim();
    const tUnidadCompra     = (formData.get("tUnidadCompra") as string)?.trim();
    const tUnidadReceta     = (formData.get("tUnidadReceta") as string)?.trim();
    const eFactorConversion = parseFloat(formData.get("eFactorConversion") as string);
    const eCostoUnitario    = parseFloat(formData.get("eCostoUnitario") as string) || 0;
    const eStockMinimo      = parseFloat(formData.get("eStockMinimo") as string) || 0;

    if (!eCodInsumoMaestro || !eCodInsumoStock) return { error: "Insumo no especificado" };
    if (!tNombre) return { error: "El nombre es requerido" };
    if (isNaN(eFactorConversion) || eFactorConversion <= 0)
      return { error: "El factor de conversión debe ser mayor a 0" };

    const { data: maestro, error: errMaestro } = await adminClient
      .from("insumos_maestro")
      .update({
        tNombre,
        tUnidadCompra,
        tUnidadReceta,
        eFactorConversion,
        fhUpdateInsumoMaestro: new Date().toISOString(),
      })
      .eq("eCodInsumoMaestro", eCodInsumoMaestro)
      .select()
      .single();

    if (errMaestro) return { error: `Error al actualizar insumo: ${errMaestro.message}` };

    const { data: stock, error: errStock } = await adminClient
      .from("insumos_stock")
      .update({
        eCostoUnitario,
        eStockMinimo,
        fhUpdateInsumoStock: new Date().toISOString(),
      })
      .eq("eCodInsumoStock", eCodInsumoStock)
      .select()
      .single();

    if (errStock) return { error: `Error al actualizar stock: ${errStock.message}` };

    revalidatePath("/admin/insumos");
    return { insumo: { ...maestro, ...stock } as InsumoConStock };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── AJUSTE MANUAL DE STOCK ───────────────────────────────────────────────────
// Solo toca insumos_stock — el maestro no participa en cantidades.
// tMotivo es obligatorio: sin él, el historial de ajustes no sirve para
// auditoría, solo son números sueltos sin explicación.

export async function ajustarStockInsumo(formData: FormData) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };

    const eCodInsumoStock = formData.get("eCodInsumoStock") as string;
    const eCantAgregar    = parseFloat(formData.get("eCantAgregar") as string);
    const tMotivo         = (formData.get("tMotivo") as string)?.trim();

    if (!eCodInsumoStock) return { error: "Insumo no especificado" };
    if (isNaN(eCantAgregar) || eCantAgregar === 0) return { error: "Cantidad inválida" };
    if (!tMotivo) return { error: "El motivo del ajuste es obligatorio" };

    const { data: actual, error: errorLectura } = await adminClient
      .from("insumos_stock")
      .select("eCantidadStock, fkeCodInsumoMaestro, fkeCodSucursal, insumos_maestro(tNombre, tUnidadReceta)")
      .eq("eCodInsumoStock", eCodInsumoStock)
      .single();

    if (errorLectura || !actual) return { error: "No se encontró el insumo" };

    const nuevaCantidad = actual.eCantidadStock + eCantAgregar;
    if (nuevaCantidad < 0) return { error: "El ajuste dejaría el stock en negativo" };

    const { data: stock, error } = await adminClient
      .from("insumos_stock")
      .update({
        eCantidadStock: nuevaCantidad,
        fhUpdateInsumoStock: new Date().toISOString(),
      })
      .eq("eCodInsumoStock", eCodInsumoStock)
      .select()
      .single();

    if (error) return { error: `Error al ajustar stock: ${error.message}` };

    const maestroInfo = (actual as any).insumos_maestro;

    await adminClient.from("historial_ajustes_insumos").insert({
      fkeCodInsumoStock:      eCodInsumoStock,
      fkeCodSucursal:         actual.fkeCodSucursal,
      tNombreInsumoSnapshot:  maestroInfo?.tNombre ?? "insumo",
      eCantidadAjuste:        eCantAgregar,
      eCantidadAntes:         actual.eCantidadStock,
      eCantidadDespues:       nuevaCantidad,
      tUnidadRecetaSnapshot:  maestroInfo?.tUnidadReceta ?? "",
      tMotivo,
      fkeCodUser:             user.id,
    });

    const { data: maestro } = await adminClient
      .from("insumos_maestro")
      .select("*")
      .eq("eCodInsumoMaestro", actual.fkeCodInsumoMaestro)
      .single();

    revalidatePath("/admin/insumos");
    return { insumo: { ...maestro, ...stock } as InsumoConStock };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── LISTA DE COMPRA ────────────────────────────────────────────────────────
// Insumos con stock por debajo del mínimo. alcance='actual' filtra por una
// sucursal específica; alcance='todas' trae todas las de la compañía con
// el nombre de sucursal incluido (para distinguir filas en la tabla/export).

export async function obtenerInsumosParaListaCompra(
  alcance: "actual" | "todas",
  fkeCodSucursal?: string
): Promise<{
  eCodInsumoStock: string;
  tNombre: string;
  tUnidadCompra: string;
  tUnidadReceta: string;
  eFactorConversion: number;
  eCantidadStock: number;
  eStockMinimo: number;
  tNombreSucursal: string;
}[]> {
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

    let query = adminClient
      .from("insumos_stock")
      .select(`
        eCodInsumoStock, eCantidadStock, eStockMinimo,
        insumos_maestro!inner ( tNombre, tUnidadCompra, tUnidadReceta, eFactorConversion, fkeCodCompany ),
        sucursales!inner ( tNombre )
      `)
      .eq("insumos_maestro.fkeCodCompany", perfil.fkeCodCompany)
      .eq("bStateInsumoStock", true);

    if (alcance === "actual" && fkeCodSucursal) {
      query = query.eq("fkeCodSucursal", fkeCodSucursal);
    }

    const { data, error } = await query;
    if (error || !data) { console.error(error); return []; }

    return (data as any[])
      .filter((row) => row.eCantidadStock <= row.eStockMinimo)
      .map((row) => ({
        eCodInsumoStock:   row.eCodInsumoStock,
        tNombre:           row.insumos_maestro.tNombre,
        tUnidadCompra:     row.insumos_maestro.tUnidadCompra,
        tUnidadReceta:     row.insumos_maestro.tUnidadReceta,
        eFactorConversion: row.insumos_maestro.eFactorConversion,
        eCantidadStock:    row.eCantidadStock,
        eStockMinimo:      row.eStockMinimo,
        tNombreSucursal:   row.sucursales.tNombre,
      }))
      .sort((a, b) => a.tNombre.localeCompare(b.tNombre));
  } catch {
    return [];
  }
}

// ── CONFIRMAR COMPRA (Nivel B) ────────────────────────────────────────────────
// Se llama DESPUÉS de haber comprado físicamente, no al generar la lista.
// Actualiza stock + escribe una fila de historial por insumo. Sin retry de
// conflicto de versión (a diferencia del flujo de venta) porque esta acción
// la ejecuta un admin manualmente, uno a la vez — el riesgo de concurrencia
// real es mucho menor que en una venta.

export async function confirmarCompraInsumos(
  items: { eCodInsumoStock: string; eCantidadComprada: number }[]
): Promise<{ ok: true; actualizados: number; errores: string[] } | { error: string }> {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };

    let actualizados = 0;
    const errores: string[] = [];

    for (const item of items) {
      if (!item.eCantidadComprada || item.eCantidadComprada <= 0) continue;

      const { data: stock, error: errStock } = await adminClient
        .from("insumos_stock")
        .select("eCantidadStock, version, fkeCodSucursal, insumos_maestro(tNombre, tUnidadCompra, tUnidadReceta, eFactorConversion)")
        .eq("eCodInsumoStock", item.eCodInsumoStock)
        .single();

      if (errStock || !stock) {
        errores.push(`No se encontró un insumo (id: ${item.eCodInsumoStock})`);
        continue;
      }

      const maestro = (stock as any).insumos_maestro;
      const cantidadEnReceta = item.eCantidadComprada * maestro.eFactorConversion;

      const { data: actualizado, error: errUpdate } = await adminClient
        .from("insumos_stock")
        .update({
          eCantidadStock:      stock.eCantidadStock + cantidadEnReceta,
          version:             stock.version + 1,
          fhUpdateInsumoStock: new Date().toISOString(),
        })
        .eq("eCodInsumoStock", item.eCodInsumoStock)
        .eq("version", stock.version)
        .select("eCodInsumoStock");

      if (errUpdate || !actualizado || actualizado.length === 0) {
        errores.push(`"${maestro.tNombre}": otra sesión lo modificó al mismo tiempo, no se actualizó`);
        continue;
      }

      await adminClient.from("historial_compras_insumos").insert({
        fkeCodInsumoStock:      item.eCodInsumoStock,
        fkeCodSucursal:         stock.fkeCodSucursal,
        tNombreInsumoSnapshot:  maestro.tNombre,
        eCantidadComprada:      item.eCantidadComprada,
        tUnidadCompraSnapshot:  maestro.tUnidadCompra,
        eCantidadAgregadaStock: cantidadEnReceta,
        tUnidadRecetaSnapshot:  maestro.tUnidadReceta,
        fkeCodUser:             user.id,
      });

      actualizados++;
    }

    revalidatePath("/admin/insumos");
    return { ok: true, actualizados, errores };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── HISTORIAL DE COMPRAS ──────────────────────────────────────────────────────

export async function obtenerHistorialCompras(): Promise<
  {
    eCodCompra: string;
    tNombreInsumoSnapshot: string;
    eCantidadComprada: number;
    tUnidadCompraSnapshot: string;
    fhCreateCompra: string;
    tNombreSucursal: string;
  }[]
> {
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

    const { data: sucursalesCompania } = await adminClient
      .from("sucursales")
      .select("eCodSucursal")
      .eq("fkeCodCompany", perfil.fkeCodCompany);

    const idsSucursales = (sucursalesCompania ?? []).map((s) => s.eCodSucursal);
    if (idsSucursales.length === 0) return [];

    const { data, error } = await adminClient
      .from("historial_compras_insumos")
      .select("eCodCompra, tNombreInsumoSnapshot, eCantidadComprada, tUnidadCompraSnapshot, fhCreateCompra, sucursales(tNombre)")
      .in("fkeCodSucursal", idsSucursales)
      .order("fhCreateCompra", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return (data as any[]).map((row) => ({
      eCodCompra:             row.eCodCompra,
      tNombreInsumoSnapshot:  row.tNombreInsumoSnapshot,
      eCantidadComprada:      row.eCantidadComprada,
      tUnidadCompraSnapshot:  row.tUnidadCompraSnapshot,
      fhCreateCompra:         row.fhCreateCompra,
      tNombreSucursal:        row.sucursales?.tNombre ?? "—",
    }));
  } catch {
    return [];
  }
}

// ── HISTORIAL DE AJUSTES MANUALES ────────────────────────────────────────────

export async function obtenerHistorialAjustes(): Promise<
  {
    eCodAjuste: string;
    tNombreInsumoSnapshot: string;
    eCantidadAjuste: number;
    tUnidadRecetaSnapshot: string;
    tMotivo: string;
    fhCreateAjuste: string;
    tNombreSucursal: string;
  }[]
> {
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

    const { data: sucursalesCompania } = await adminClient
      .from("sucursales")
      .select("eCodSucursal")
      .eq("fkeCodCompany", perfil.fkeCodCompany);

    const idsSucursales = (sucursalesCompania ?? []).map((s) => s.eCodSucursal);
    if (idsSucursales.length === 0) return [];

    const { data, error } = await adminClient
      .from("historial_ajustes_insumos")
      .select("eCodAjuste, tNombreInsumoSnapshot, eCantidadAjuste, tUnidadRecetaSnapshot, tMotivo, fhCreateAjuste, sucursales(tNombre)")
      .in("fkeCodSucursal", idsSucursales)
      .order("fhCreateAjuste", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return (data as any[]).map((row) => ({
      eCodAjuste:             row.eCodAjuste,
      tNombreInsumoSnapshot:  row.tNombreInsumoSnapshot,
      eCantidadAjuste:        row.eCantidadAjuste,
      tUnidadRecetaSnapshot:  row.tUnidadRecetaSnapshot,
      tMotivo:                row.tMotivo,
      fhCreateAjuste:         row.fhCreateAjuste,
      tNombreSucursal:        row.sucursales?.tNombre ?? "—",
    }));
  } catch {
    return [];
  }
}

// Afecta solo el stock de esta sucursal — el maestro sigue disponible para
// que otras sucursales lo usen (o esta misma, vía "agregar existente", si se reactiva).

export async function toggleEstadoInsumo(eCodInsumoStock: string, nuevoEstado: boolean) {
  try {
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("insumos_stock")
      .update({ bStateInsumoStock: nuevoEstado, fhUpdateInsumoStock: new Date().toISOString() })
      .eq("eCodInsumoStock", eCodInsumoStock);

    if (error) return { error: `Error al actualizar estado: ${error.message}` };

    revalidatePath("/admin/insumos");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── ELIMINAR ──────────────────────────────────────────────────────────────────
// Elimina SOLO la fila de stock de esta sucursal. El maestro no se toca —
// sigue existiendo para las demás sucursales que lo usen.
//
// Bloquea el borrado si el insumo MAESTRO está en alguna receta — no importa
// en qué sucursal estés borrando: si receta_insumos lo referencia, cualquier
// venta de esa receta en ESTA sucursal fallaría al no encontrar el stock.

export async function eliminarInsumo(eCodInsumoStock: string) {
  try {
    const adminClient = createAdminClient();

    const { data: stock, error: errStock } = await adminClient
      .from("insumos_stock")
      .select("fkeCodInsumoMaestro")
      .eq("eCodInsumoStock", eCodInsumoStock)
      .single();

    if (errStock || !stock) return { error: "Insumo no encontrado" };

    const { data: enUso, error: errUso } = await adminClient
      .from("receta_insumos")
      .select("eCodReceta")
      .eq("fkeCodInsumoMaestro", stock.fkeCodInsumoMaestro)
      .limit(1);

    if (errUso) return { error: `Error al verificar uso en recetas: ${errUso.message}` };

    if (enUso && enUso.length > 0) {
      return {
        error: "Este insumo está en uso en una o más recetas. Quítalo de esas recetas antes de eliminarlo.",
      };
    }

    const { error } = await adminClient
      .from("insumos_stock")
      .delete()
      .eq("eCodInsumoStock", eCodInsumoStock);

    if (error) return { error: `Error al eliminar insumo: ${error.message}` };

    revalidatePath("/admin/insumos");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
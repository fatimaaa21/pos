"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Inventario } from "@/types";

export async function agregarStock(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const fkeCodProduct  = formData.get("fkeCodProduct") as string;
    const bIlimitado      = formData.get("bUnlimitedInventory") === "true";
    const eCantIngresada = bIlimitado ? null : parseFloat(formData.get("eCantIngresada") as string);
    const eStockMinimo   = bIlimitado ? null : parseFloat(formData.get("eStockMinimo") as string);

    if (!fkeCodProduct) {
      return { error: "Selecciona un producto" };
    }

    if (!bIlimitado && (eCantIngresada === null || isNaN(eCantIngresada) || eCantIngresada <= 0)) {
      return { error: "Ingresa una cantidad válida" };
    }

    const { data: producto, error: productoError } = await adminClient
      .from("productos")
      .select("fkeCodCompany")
      .eq("eCodProduct", fkeCodProduct)
      .single();

    if (productoError || !producto?.fkeCodCompany) {
      return { error: "No se pudo obtener el negocio del producto" };
    }

    const fkeCodCompany = producto.fkeCodCompany;
    const ahora = new Date().toISOString();

    const { data, error } = await adminClient
      .from("inventario")
      .insert({
        fkeCodProduct,
        fkeCodCompany,
        bUnlimitedInventory: bIlimitado,
        eCantIngresada:      bIlimitado ? null : eCantIngresada,
        eStockMinimo:        bIlimitado ? null : (isNaN(eStockMinimo!) ? 0 : eStockMinimo),
        bStateInventory:     true,
        fhCreateInventory:   ahora,
        fhUpdateInventory:   ahora,
      })
      .select(`
        *,
        productos!inventario_fkeCodProduct_fkey (
          eCodProduct,
          tNameProduct,
          ImgProduct,
          ePriceProduct,
          categorias ( tNameCategory )
        )
      `)
      .single();

    if (error) return { error: `Error al agregar stock: ${error.message}` };

    revalidatePath("/admin/inventario");
    return { inventario: data as Inventario };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function editarStock(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const eCodInventory = formData.get("eCodInventory") as string;
    const eCantAgregar  = parseFloat(formData.get("eCantAgregar") as string);
    const eStockMinimo  = parseFloat(formData.get("eStockMinimo") as string);

    const { data: actual, error: errorLectura } = await adminClient
      .from("inventario")
      .select("eCantIngresada, bUnlimitedInventory")
      .eq("eCodInventory", eCodInventory)
      .single();

    if (errorLectura || !actual) return { error: "No se encontró el registro" };

    if (actual.bUnlimitedInventory) {
      return { error: "Este producto tiene stock infinito, no requiere actualización de cantidad" };
    }

    const nuevaCantIngresada = (actual.eCantIngresada ?? 0) + eCantAgregar;

    const { data: inventario, error } = await adminClient
      .from("inventario")
      .update({
        eCantIngresada:    nuevaCantIngresada,
        eStockMinimo:      isNaN(eStockMinimo) ? undefined : eStockMinimo,
        fhUpdateInventory: new Date().toISOString(),
      })
      .eq("eCodInventory", eCodInventory)
      .select()
      .single();

    if (error) return { error: `Error al actualizar: ${error.message}` };

    const { data: vistaActual } = await adminClient
      .from("vista_inventario")
      .select("eCantRestante")
      .eq("eCodInventory", eCodInventory)
      .single();

    if (vistaActual) {
      const debeEstarActivo = (vistaActual.eCantRestante ?? 0) > 0;
      await adminClient
        .from("inventario")
        .update({ bStateInventory: debeEstarActivo })
        .eq("eCodInventory", eCodInventory);
    }

    revalidatePath("/admin/inventario");
    revalidatePath("/empleado/menu");
    return { inventario };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function toggleEstadoInventario(eCodInventory: string, nuevoEstado: boolean) {
  try {
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("inventario")
      .update({
        bStateInventory:   nuevoEstado,
        fhUpdateInventory: new Date().toISOString(),
      })
      .eq("eCodInventory", eCodInventory);

    if (error) return { error: `Error al actualizar estado: ${error.message}` };

    revalidatePath("/admin/inventario");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function eliminarInventario(eCodInventory: string) {
  try {
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("inventario")
      .delete()
      .eq("eCodInventory", eCodInventory);

    if (error) return { error: `Error al eliminar: ${error.message}` };

    revalidatePath("/admin/inventario");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
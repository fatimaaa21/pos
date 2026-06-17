"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Inventario } from "@/types";

export async function agregarStock(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const fkeCodProduct      = formData.get("fkeCodProduct") as string;
    const fkeCodPresentacion = (formData.get("fkeCodPresentacion") as string) || null;
    const fkeCodSucursal     = formData.get("fkeCodSucursal") as string;  // ← nuevo
    const bIlimitado         = formData.get("bUnlimitedInventory") === "true";
    const eCantIngresada     = bIlimitado ? 0 : parseFloat(formData.get("eCantIngresada") as string);
    const eStockMinimo       = bIlimitado ? 0 : (parseFloat(formData.get("eStockMinimo") as string) || 0);

    if (!fkeCodProduct) return { error: "Producto requerido" };
    if (!fkeCodSucursal) return { error: "Sucursal requerida" };  // ← nuevo
    if (!bIlimitado && (isNaN(eCantIngresada) || eCantIngresada <= 0)) {
      return { error: "Cantidad inválida" };
    }

    if (!fkeCodPresentacion) {
      const { data: presActivas } = await adminClient
        .from("presentaciones")
        .select("eCodPresentacion")
        .eq("fkeCodProduct", fkeCodProduct)
        .eq("bStatePresentacion", true)
        .limit(1);

      if (presActivas && presActivas.length > 0) {
        return {
          error:
            "Este producto maneja presentaciones. " +
            "Selecciona una presentación para registrar el stock.",
        };
      }
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

    const { data: insertado, error } = await adminClient
      .from("inventario")
      .insert({
        fkeCodProduct,
        fkeCodPresentacion,
        fkeCodCompany,
        fkeCodSucursal,   // ← nuevo
        eCantIngresada,
        eStockMinimo,
        bUnlimitedInventory: bIlimitado,
        bStateInventory:     true,
        fhCreateInventory:   ahora,
        fhUpdateInventory:   ahora,
      })
      .select("eCodInventory")
      .single();

    if (error) return { error: `Error al agregar stock: ${error.message}` };

    const { data, error: vistaError } = await adminClient
      .from("vista_inventario")
      .select(`
        *,
        productos!inventario_fkeCodProduct_fkey (
          tNameProduct,
          ImgProduct,
          ePriceProduct,
          categorias ( eCodCategory, tNameCategory )
        )
      `)
      .eq("eCodInventory", insertado.eCodInventory)
      .single();

    if (vistaError || !data) {
      return { error: `Error al leer el stock creado: ${vistaError?.message}` };
    }

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
      .select("eCantIngresada")
      .eq("eCodInventory", eCodInventory)
      .single();

    if (errorLectura || !actual) return { error: "No se encontró el registro" };

    const nuevaCantIngresada = actual.eCantIngresada + eCantAgregar;

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
      await adminClient
        .from("inventario")
        .update({ bStateInventory: vistaActual.eCantRestante > 0 })
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
      .update({ bStateInventory: nuevoEstado, fhUpdateInventory: new Date().toISOString() })
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
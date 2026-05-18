"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MetodoPago } from "@/types";
import { revalidatePath } from "next/cache";

interface ItemVenta {
  eCodProduct: string;
  cantidad: number;
  precioUnitario: number;
}

export async function crearVenta(items: ItemVenta[], metodoPago: MetodoPago) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 1. Verificar sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    // 2. Obtener fkeCodCompany del perfil del empleado
    const { data: perfil, error: perfilError } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (perfilError || !perfil?.fkeCodCompany) {
      return { error: "No se encontró el negocio del empleado" };
    }

    const fkeCodCompany = perfil.fkeCodCompany;

    // 3. Validar stock antes de proceder
    for (const item of items) {
      const { data: lote, error: loteError } = await adminClient
        .from("vista_inventario")
        .select("eCodInventory, eCantRestante")
        .eq("fkeCodProduct", item.eCodProduct)
        .eq("bStateInventory", true)
        .single();

      if (loteError || !lote) {
        return { error: "Producto sin inventario activo" };
      }

      if (lote.eCantRestante < item.cantidad) {
        return {
          error: `Stock insuficiente. Solo quedan ${lote.eCantRestante} unidades disponibles`,
        };
      }
    }

    // 4. Calcular total
    const eTotal = items.reduce(
      (acc, i) => acc + i.precioUnitario * i.cantidad,
      0
    );

    // 5. Insertar encabezado de venta
    const { data: venta, error: ventaError } = await adminClient
      .from("ventas")
      .insert({
        fkeCodUser:    user.id,
        fkeCodCompany,
        eTotal,
        eMetodoPago:   metodoPago,
        fhCreateVenta: new Date().toISOString(),
      })
      .select("eCodVenta")
      .single();

    if (ventaError || !venta) {
      return { error: `Error al crear venta: ${ventaError?.message}` };
    }

    // 6. Insertar detalle (una fila por producto)
    const detalle = items.map((i) => ({
      fkeCodVenta:     venta.eCodVenta,
      fkeCodProduct:   i.eCodProduct,
      eCantidad:       i.cantidad,
      ePrecioUnitario: i.precioUnitario,
      eSubtotal:       i.precioUnitario * i.cantidad,
    }));

    const { error: detalleError } = await adminClient
      .from("detalle_venta")
      .insert(detalle);

    if (detalleError) {
      return { error: `Error al guardar detalle: ${detalleError.message}` };
    }

    // 7. Descontar del inventario y marcar agotado si corresponde
    for (const item of items) {
      const { data: lote } = await adminClient
        .from("vista_inventario")
        .select("eCodInventory, eCantRestante")
        .eq("fkeCodProduct", item.eCodProduct)
        .eq("bStateInventory", true)
        .single();

      if (!lote) continue;

      const restanteTrasVenta = lote.eCantRestante - item.cantidad;
      const agotado = restanteTrasVenta <= 0;

      await adminClient
        .from("inventario")
        .update({
          bStateInventory:   !agotado,
          fhUpdateInventory: new Date().toISOString(),
        })
        .eq("eCodInventory", lote.eCodInventory);
    }

    revalidatePath("/empleado/menu");
    revalidatePath("/admin/inventario");
    return { eCodVenta: venta.eCodVenta };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
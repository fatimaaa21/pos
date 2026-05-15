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

    // 1. Obtener usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    // 2. Calcular total
    const eTotal = items.reduce(
      (acc, i) => acc + i.precioUnitario * i.cantidad,
      0
    );

    // 3. Insertar venta
    const { data: venta, error: ventaError } = await adminClient
      .from("ventas")
      .insert({
        fkeCodUser:  user.id,
        eTotal,
        eMetodoPago: metodoPago,
      })
      .select("eCodVenta")
      .single();

    if (ventaError || !venta) {
      return { error: `Error al crear venta: ${ventaError?.message}` };
    }

    // 4. Insertar detalle
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

    // 5. Descontar del inventario
    for (const item of items) {
      const { data: lote, error: loteError } = await adminClient
        .from("inventario")
        .select("eCodInventory, eCantIngresada")
        .eq("fkeCodProduct", item.eCodProduct)
        .eq("bStateInventory", true)
        .single();

      if (loteError || !lote) continue;

      const nuevaCantidad = lote.eCantIngresada - item.cantidad;

      await adminClient
        .from("inventario")
        .update({
          eCantIngresada:   nuevaCantidad < 0 ? 0 : nuevaCantidad,
          fhUpdateInventory: new Date().toISOString(),
          // Si se agotó, desactivar el lote
          bStateInventory:  nuevaCantidad > 0,
        })
        .eq("eCodInventory", lote.eCodInventory);
    }

    revalidatePath("/empleado/menu");
    return { eCodVenta: venta.eCodVenta };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
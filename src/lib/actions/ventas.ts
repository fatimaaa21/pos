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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    // Validar stock antes de proceder
    for (const item of items) {
      const { data: lote, error: loteError } = await adminClient
        .from("vista_inventario")         // ← vista, no tabla
        .select("eCodInventory, eCantRestante")
        .eq("fkeCodProduct", item.eCodProduct)
        .eq("bStateInventory", true)
        .single();

      if (loteError || !lote) {
        return { error: "Producto sin inventario activo" };
      }

      if (lote.eCantRestante < item.cantidad) {
        return { error: `Stock insuficiente. Solo quedan ${lote.eCantRestante} unidades disponibles` };
      }
    }

    const eTotal = items.reduce(
      (acc, i) => acc + i.precioUnitario * i.cantidad,
      0
    );

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

    // Descontar del inventario
for (const item of items) {
  // Leer el restante real desde la vista
  const { data: lote } = await adminClient
    .from("vista_inventario")
    .select("eCodInventory, eCantRestante")
    .eq("fkeCodProduct", item.eCodProduct)
    .eq("bStateInventory", true)
    .single();

  if (!lote) continue;

  const restanteTrasventa = lote.eCantRestante - item.cantidad;
  const agotado = restanteTrasventa <= 0;

  // Solo actualizar estado y timestamp, NUNCA eCantIngresada
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
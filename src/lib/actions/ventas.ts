"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { MetodoPago } from "@/types";

export interface ItemVenta {
  eCodProduct: string;
  cantidad: number;
  precioUnitario: number;
}

export interface ResultadoVenta {
  ok?: boolean;
  eCodVenta?: string;
  error?: string;
}

export async function crearVenta(
  items: ItemVenta[],
  metodoPago: MetodoPago
): Promise<ResultadoVenta> {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // 1. Obtener el usuario autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    if (items.length === 0) return { error: "El pedido está vacío" };

    // 2. Calcular total
    const total = items.reduce(
      (acc, i) => acc + i.precioUnitario * i.cantidad,
      0
    );

    // 3. Verificar stock disponible antes de guardar
    for (const item of items) {
      const { data: inv } = await adminClient
        .from("inventario")
        .select("eCantRestante, eCodInventory")
        .eq("fkeCodProduct", item.eCodProduct)
        .eq("bStateInventory", true)
        .order("fhCreateInventory", { ascending: true }) // FIFO: el lote más antiguo primero
        .limit(1)
        .single();

      if (!inv || inv.eCantRestante < item.cantidad) {
        // Traemos el nombre del producto para el mensaje de error
        const { data: prod } = await adminClient
          .from("productos")
          .select("tNameProduct")
          .eq("eCodProduct", item.eCodProduct)
          .single();

        return {
          error: `Stock insuficiente para "${prod?.tNameProduct ?? item.eCodProduct}". Disponible: ${inv?.eCantRestante ?? 0}`,
        };
      }
    }

    // 4. Crear la venta
    const { data: venta, error: ventaError } = await adminClient
      .from("ventas")
      .insert({
        fkeCodUser: user.id,
        eTotal: total,
        eMetodoPago: metodoPago,
        fhCreateVenta: new Date().toISOString(),
      })
      .select("eCodVenta")
      .single();

    if (ventaError || !venta) {
      return { error: `Error al crear venta: ${ventaError?.message}` };
    }

    // 5. Insertar detalle de venta
    const detalles = items.map((item) => ({
      fkeCodVenta: venta.eCodVenta,
      fkeCodProduct: item.eCodProduct,
      eCantidad: item.cantidad,
      ePrecioUnitario: item.precioUnitario,
      eSubtotal: item.precioUnitario * item.cantidad,
    }));

    const { error: detalleError } = await adminClient
      .from("detalle_venta")
      .insert(detalles);

    if (detalleError) {
      // Revertir la venta si falla el detalle
      await adminClient.from("ventas").delete().eq("eCodVenta", venta.eCodVenta);
      return { error: `Error al guardar detalle: ${detalleError.message}` };
    }

    // 6. Descontar stock en inventario (FIFO por lote)
    for (const item of items) {
      let restaPorDescontar = item.cantidad;

      // Traer todos los lotes activos con stock, del más antiguo al más nuevo
      const { data: lotes } = await adminClient
        .from("inventario")
        .select("eCodInventory, eCantRestante, eCantVendida")
        .eq("fkeCodProduct", item.eCodProduct)
        .eq("bStateInventory", true)
        .gt("eCantRestante", 0)
        .order("fhCreateInventory", { ascending: true });

      if (!lotes) continue;

      for (const lote of lotes) {
        if (restaPorDescontar <= 0) break;

        const descuento = Math.min(restaPorDescontar, lote.eCantRestante);
        restaPorDescontar -= descuento;

        await adminClient
          .from("inventario")
          .update({
            eCantVendida: lote.eCantVendida + descuento,
            eCantRestante: lote.eCantRestante - descuento,
            fhUpdateInventory: new Date().toISOString(),
          })
          .eq("eCodInventory", lote.eCodInventory);
      }
    }

    revalidatePath("/empleado/menu");
    revalidatePath("/admin/inventario");

    return { ok: true, eCodVenta: venta.eCodVenta };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
// Utilidad compartida entre mesas.ts (donde se descuenta el insumo de un
// item de mesa al mandarlo a cocina) y ventas.ts (donde cancelarVenta
// necesita revertir ese mismo descuento). Vive fuera de ambos "use server"
// para no crear un import circular entre esos dos archivos.

import { createAdminClient } from "@/lib/supabase/admin";
import { registrarMermaInsumo, type MermaContext } from "@/lib/utils/mermas";

/**
 * Restaura (con reintento optimista, igual que cancelarVenta) todo el
 * insumo consumido por una línea de orden y borra su registro.
 *
 * Si se pasa `mermaContext`, NO restaura — registra el consumo como merma
 * en su lugar (caso: se cancela la venta pero el producto ya se preparó y
 * el insumo no se puede recuperar). Sin contexto, restaura normalmente
 * (caso: se quita/reduce un item de una orden que ni siquiera se ha cobrado).
 */
export async function restaurarInsumosDeDetalle(
  adminClient: ReturnType<typeof createAdminClient>,
  eCodDetalle: string,
  mermaContext?: MermaContext
): Promise<void> {
  const { data: consumos } = await adminClient
    .from("orden_detalle_insumos_consumidos")
    .select("fkeCodInsumoStock, eCantidadDescontada, tNombreInsumoSnapshot, tUnidadSnapshot")
    .eq("fkeCodDetalle", eCodDetalle);

  for (const consumo of consumos ?? []) {
    if (!consumo.fkeCodInsumoStock) continue;

    if (mermaContext) {
      await registrarMermaInsumo(adminClient, {
        ...mermaContext,
        fkeCodInsumoStock: consumo.fkeCodInsumoStock,
        tNombreSnapshot:   consumo.tNombreInsumoSnapshot,
        eCantidad:         consumo.eCantidadDescontada,
        tUnidadSnapshot:   consumo.tUnidadSnapshot,
      });
      continue;
    }

    let intento = 0;
    let restaurado = false;

    while (intento < 3 && !restaurado) {
      const { data: actual } = await adminClient
        .from("insumos_stock")
        .select("eCantidadStock, version")
        .eq("eCodInsumoStock", consumo.fkeCodInsumoStock)
        .single();

      if (!actual) break;

      const { data: actualizado } = await adminClient
        .from("insumos_stock")
        .update({
          eCantidadStock:      actual.eCantidadStock + consumo.eCantidadDescontada,
          version:             actual.version + 1,
          fhUpdateInsumoStock: new Date().toISOString(),
        })
        .eq("eCodInsumoStock", consumo.fkeCodInsumoStock)
        .eq("version", actual.version)
        .select("eCodInsumoStock");

      if (actualizado && actualizado.length > 0) restaurado = true;
      else intento++;
    }
  }

  await adminClient.from("orden_detalle_insumos_consumidos").delete().eq("fkeCodDetalle", eCodDetalle);
}

/**
 * Restaura el insumo consumido al preparar los items de una venta que vino
 * de una mesa (agregarItemOrden ya lo descontó ahí, no en crearVenta) — lo
 * usa cancelarVenta, porque venta_insumos_consumidos está vacío para esos
 * items (nunca se llenó, a propósito, para no descontar dos veces).
 * Si la venta no vino de una mesa (venta directa o autoconsumo), no hace nada.
 *
 * `mermaContext` (opcional): si se pasa, el insumo de estos items se
 * registra como merma en vez de restaurarse — mismo criterio que
 * restaurarInsumosDeDetalle.
 */
export async function restaurarInsumosDeVentaMesa(
  eCodVenta: string,
  mermaContext?: Omit<MermaContext, "fkeCodVenta">
): Promise<void> {
  const adminClient = createAdminClient();

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("eCodOrden")
    .eq("fkeCodVenta", eCodVenta)
    .maybeSingle();

  if (!orden) return;

  const { data: lineas } = await adminClient
    .from("ordenes_mesa_detalle")
    .select("eCodDetalle")
    .eq("fkeCodOrden", orden.eCodOrden);

  for (const linea of lineas ?? []) {
    await restaurarInsumosDeDetalle(
      adminClient,
      linea.eCodDetalle,
      mermaContext ? { ...mermaContext, fkeCodVenta: eCodVenta } : undefined
    );
  }
}

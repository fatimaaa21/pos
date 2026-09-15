// Registro de merma — se usa cuando se cancela una venta pero el producto
// ya se había preparado/entregado, así que NO se restaura inventario/insumo
// (cancelarVenta en ventas.ts, restaurarInsumosDeVentaMesa en
// insumosOrdenMesa.ts). Sin este registro, esa pérdida desaparecería sin
// dejar rastro en los reportes de stock.

import { createAdminClient } from "@/lib/supabase/admin";

export interface MermaContext {
  fkeCodVenta:    string;
  fkeCodCompany:  string;
  fkeCodSucursal: string;
  fkeCodUser:     string;
  tMotivo:        string | null;
}

export async function registrarMermaProducto(
  adminClient: ReturnType<typeof createAdminClient>,
  ctx: MermaContext & {
    fkeCodProduct:      string;
    fkeCodPresentacion: string | null;
    tNombreSnapshot:    string;
    eCantidad:          number;
  }
): Promise<void> {
  await adminClient.from("mermas").insert({
    fkeCodVenta:        ctx.fkeCodVenta,
    fkeCodCompany:      ctx.fkeCodCompany,
    fkeCodSucursal:     ctx.fkeCodSucursal,
    fkeCodUser:         ctx.fkeCodUser,
    tTipo:              "producto",
    fkeCodProduct:      ctx.fkeCodProduct,
    fkeCodPresentacion: ctx.fkeCodPresentacion,
    tNombreSnapshot:    ctx.tNombreSnapshot,
    eCantidad:          ctx.eCantidad,
    tMotivo:            ctx.tMotivo,
  });
}

export async function registrarMermaInsumo(
  adminClient: ReturnType<typeof createAdminClient>,
  ctx: MermaContext & {
    fkeCodInsumoStock: string | null;
    tNombreSnapshot:   string;
    eCantidad:         number;
    tUnidadSnapshot:   string;
  }
): Promise<void> {
  await adminClient.from("mermas").insert({
    fkeCodVenta:       ctx.fkeCodVenta,
    fkeCodCompany:     ctx.fkeCodCompany,
    fkeCodSucursal:    ctx.fkeCodSucursal,
    fkeCodUser:        ctx.fkeCodUser,
    tTipo:             "insumo",
    fkeCodInsumoStock: ctx.fkeCodInsumoStock,
    tNombreSnapshot:   ctx.tNombreSnapshot,
    eCantidad:         ctx.eCantidad,
    tUnidadSnapshot:   ctx.tUnidadSnapshot,
    tMotivo:           ctx.tMotivo,
  });
}

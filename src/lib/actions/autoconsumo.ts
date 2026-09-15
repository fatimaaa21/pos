"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath }    from "next/cache";
import { resolverSucursalVenta } from "@/lib/utils/sucursal";
import { validarExtrasSeleccionados, type ExtraResuelto } from "@/lib/utils/extras";
import type { AutoconsumoHistorial, AutoconsumoAdminRow } from "@/types/autoconsumo";

interface ItemAutoconsumo {
  eCodProduct:       string;
  eCodPresentacion?: string;
  cantidad:          number;
  extrasSeleccionados?: { eCodOpcionExtra: string; eCantidad: number }[];
}

/**
 * Registra productos que un empleado toma para sí mismo (autoconsumo) —
 * descuenta inventario e insumos exactamente igual que una venta (mismas
 * reglas de receta/extras que crearVenta en ventas.ts), pero NO se cobra:
 * no hay eTotal, método de pago, ni impacto en cortes de caja. Se guarda en
 * tablas separadas (autoconsumos / autoconsumo_detalle) en vez de marcar una
 * venta con eTotal = 0, para no distorsionar reportes de ventas ni el conteo
 * de operaciones del turno.
 */
export async function crearAutoconsumo(items: ItemAutoconsumo[], tNota?: string) {
  try {
    if (items.length === 0) return { error: "No hay productos seleccionados" };

    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    const ctx = await resolverSucursalVenta();
    if ("error" in ctx) return ctx;

    const { fkeCodCompany, fkeCodSucursal } = ctx;

    type LoteCapturado = {
      eCodInventory:       string;
      eCantRestante:       number;
      bUnlimitedInventory: boolean;
      version:             number;
    };

    type InsumoADescontar = {
      fkeCodInsumoStock:     string;
      eCantidadADescontar:   number;
      versionCapturada:      number;
      tNombreInsumoSnapshot: string;
      tUnidadSnapshot:       string;
    };

    const lotesPorItem:   LoteCapturado[] = [];
    const insumosPorItem: InsumoADescontar[][] = [];
    const extrasPorItem:  ExtraResuelto[][] = [];
    const nombresPorItem: { producto: string; presentacion: string | null; precioReferencia: number }[] = [];

    // ── Fase 1: validar producto/presentación/extras + stock ────────────────
    for (const item of items) {
      const { data: producto, error: errorProducto } = await adminClient
        .from("productos")
        .select("fkeCodCompany, tNameProduct, ePriceProduct, tipo_producto")
        .eq("eCodProduct", item.eCodProduct)
        .single();

      if (errorProducto || !producto) {
        return { error: `Producto no encontrado (id: ${item.eCodProduct})` };
      }
      if (producto.fkeCodCompany !== fkeCodCompany) {
        return { error: "No autorizado" };
      }
      if (producto.tipo_producto === "medida") {
        return { error: "Los productos por medida no están disponibles para autoconsumo" };
      }

      let nombrePresentacion: string | null = null;
      let precioReferencia = producto.ePriceProduct;

      if (item.eCodPresentacion) {
        const { data: presentacion, error: errorPresentacion } = await adminClient
          .from("presentaciones")
          .select("fkeCodProduct, tNombre, ePricePresentacion")
          .eq("eCodPresentacion", item.eCodPresentacion)
          .single();

        if (
          errorPresentacion ||
          !presentacion ||
          presentacion.fkeCodProduct !== item.eCodProduct
        ) {
          return { error: "No autorizado" };
        }
        nombrePresentacion = presentacion.tNombre;
        precioReferencia    = presentacion.ePricePresentacion;
      }

      nombresPorItem.push({
        producto:         producto.tNameProduct,
        presentacion:     nombrePresentacion,
        precioReferencia,
      });

      const resultadoExtras = await validarExtrasSeleccionados(
        adminClient,
        item.eCodProduct,
        item.extrasSeleccionados
      );
      if ("error" in resultadoExtras) return resultadoExtras;
      extrasPorItem.push(resultadoExtras.extras);

      // ── Validación de inventario (solo productos por unidad, sin material) ──
      let q = adminClient
        .from("vista_inventario")
        .select("eCodInventory, eCantRestante, bUnlimitedInventory")
        .eq("fkeCodProduct",   item.eCodProduct)
        .eq("fkeCodSucursal",  fkeCodSucursal)
        .eq("bStateInventory", true);

      q = item.eCodPresentacion
        ? q.eq("fkeCodPresentacion", item.eCodPresentacion)
        : q.is("fkeCodPresentacion", null);

      const { data: lotesDisponibles, error: loteError } = await q.limit(10);

      if (loteError || !lotesDisponibles?.length) {
        return { error: `"${producto.tNameProduct}" no tiene inventario activo` };
      }

      const lote = lotesDisponibles.find((l) => l.bUnlimitedInventory)
        ?? [...lotesDisponibles].sort((a, b) => (b.eCantRestante ?? 0) - (a.eCantRestante ?? 0))[0];

      if (!lote.bUnlimitedInventory && (lote.eCantRestante ?? 0) < item.cantidad) {
        return {
          error: `Stock insuficiente de "${producto.tNameProduct}". Solo quedan ${lote.eCantRestante} unidades disponibles`,
        };
      }

      let version = 0;
      if (!lote.bUnlimitedInventory) {
        const { data: base } = await adminClient
          .from("inventario")
          .select("version")
          .eq("eCodInventory", lote.eCodInventory)
          .single();
        version = base?.version ?? 0;
      }

      lotesPorItem.push({
        eCodInventory:       lote.eCodInventory,
        eCantRestante:       lote.eCantRestante ?? 0,
        bUnlimitedInventory: lote.bUnlimitedInventory,
        version,
      });
    }

    // ── Fase 1b: resolver insumos según receta (mismo criterio que crearVenta) ─
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const resueltos: InsumoADescontar[] = [];

      // Producto con inventario propio (bUnlimitedInventory === false): su
      // receta ya se descontó al producirlo (agregarStock), no aquí.
      if (!lotesPorItem[idx].bUnlimitedInventory) {
        insumosPorItem.push(resueltos);
        continue;
      }

      const { data: receta } = await adminClient
        .from("receta_insumos")
        .select("fkeCodInsumoMaestro, fkeCodGrupoExtra, eCantidadNecesaria")
        .eq(item.eCodPresentacion ? "fkeCodPresentacion" : "fkeCodProduct", item.eCodPresentacion ?? item.eCodProduct);

      const necesarioPorInsumo = new Map<string, number>();

      for (const r of receta ?? []) {
        if (r.fkeCodInsumoMaestro) {
          const cantidad = r.eCantidadNecesaria * item.cantidad;
          necesarioPorInsumo.set(
            r.fkeCodInsumoMaestro,
            (necesarioPorInsumo.get(r.fkeCodInsumoMaestro) ?? 0) + cantidad
          );
          continue;
        }

        if (!r.fkeCodGrupoExtra) continue;

        for (const extra of extrasPorItem[idx]) {
          if (extra.fkeCodGrupoExtra !== r.fkeCodGrupoExtra) continue;
          if (!extra.fkeCodInsumoMaestro) continue;

          const cantidad = r.eCantidadNecesaria * extra.eCantidad * item.cantidad;
          necesarioPorInsumo.set(
            extra.fkeCodInsumoMaestro,
            (necesarioPorInsumo.get(extra.fkeCodInsumoMaestro) ?? 0) + cantidad
          );
        }
      }

      for (const extra of extrasPorItem[idx]) {
        const { data: recetaOpcion } = await adminClient
          .from("receta_insumos")
          .select("fkeCodInsumoMaestro, eCantidadNecesaria")
          .eq("fkeCodOpcionExtra", extra.fkeCodOpcionExtra);

        for (const r of recetaOpcion ?? []) {
          if (!r.fkeCodInsumoMaestro) continue;
          const cantidad = r.eCantidadNecesaria * extra.eCantidad * item.cantidad;
          necesarioPorInsumo.set(
            r.fkeCodInsumoMaestro,
            (necesarioPorInsumo.get(r.fkeCodInsumoMaestro) ?? 0) + cantidad
          );
        }
      }

      for (const [fkeCodInsumoMaestro, cantidadNecesaria] of necesarioPorInsumo) {
        const { data: stock } = await adminClient
          .from("insumos_stock")
          .select("eCodInsumoStock, eCantidadStock, version, insumos_maestro(tNombre, tUnidadReceta)")
          .eq("fkeCodInsumoMaestro", fkeCodInsumoMaestro)
          .eq("fkeCodSucursal", fkeCodSucursal)
          .eq("bStateInsumoStock", true)
          .maybeSingle();

        if (!stock) {
          return {
            error: `Falta configurar el insumo "${(stock as any)?.insumos_maestro?.tNombre ?? fkeCodInsumoMaestro}" en esta sucursal`,
          };
        }

        if (stock.eCantidadStock < cantidadNecesaria) {
          const nombreInsumo = (stock as any).insumos_maestro?.tNombre ?? "insumo";
          return {
            error: `Stock insuficiente de "${nombreInsumo}" para registrar el autoconsumo`,
          };
        }

        resueltos.push({
          fkeCodInsumoStock:     stock.eCodInsumoStock,
          eCantidadADescontar:   cantidadNecesaria,
          versionCapturada:      stock.version,
          tNombreInsumoSnapshot: (stock as any).insumos_maestro?.tNombre ?? "insumo",
          tUnidadSnapshot:       (stock as any).insumos_maestro?.tUnidadReceta ?? "",
        });
      }

      insumosPorItem.push(resueltos);
    }

    // ── Encabezado ────────────────────────────────────────────────────────────
    const { data: autoconsumo, error: autoconsumoError } = await adminClient
      .from("autoconsumos")
      .insert({
        fkeCodUser:     user.id,
        fkeCodCompany,
        fkeCodSucursal,
        tNota:          tNota?.trim() || null,
      })
      .select("eCodAutoconsumo")
      .single();

    if (autoconsumoError || !autoconsumo) {
      return { error: `Error al registrar autoconsumo: ${autoconsumoError?.message}` };
    }

    // ── Detalle ───────────────────────────────────────────────────────────────
    const detalle = items.map((i, idx) => ({
      fkeCodAutoconsumo:           autoconsumo.eCodAutoconsumo,
      fkeCodProduct:               i.eCodProduct,
      fkeCodPresentacion:          i.eCodPresentacion ?? null,
      eCantidad:                   i.cantidad,
      tNombreProductoSnapshot:     nombresPorItem[idx].producto,
      tNombrePresentacionSnapshot: nombresPorItem[idx].presentacion,
      ePrecioReferenciaSnapshot:   nombresPorItem[idx].precioReferencia,
    }));

    // .select() para recuperar eCodDetalleAutoconsumo: un INSERT ... VALUES (...)
    // con RETURNING preserva el orden de las filas insertadas, así que idx
    // sigue correlacionando con items/extrasPorItem (mismo criterio que
    // crearVenta en ventas.ts).
    const { data: detalleInsertado, error: detalleError } = await adminClient
      .from("autoconsumo_detalle")
      .insert(detalle)
      .select("eCodDetalleAutoconsumo");

    if (detalleError || !detalleInsertado) {
      await adminClient.from("autoconsumos").delete().eq("eCodAutoconsumo", autoconsumo.eCodAutoconsumo);
      return { error: `Error al guardar detalle: ${detalleError?.message}` };
    }

    // ── Extras por línea de autoconsumo ──────────────────────────────────────
    const filasExtras = items.flatMap((_, idx) =>
      extrasPorItem[idx].map((e) => ({
        fkeCodDetalleAutoconsumo: detalleInsertado[idx].eCodDetalleAutoconsumo,
        fkeCodOpcionExtra:        e.fkeCodOpcionExtra,
        eCantidadSeleccionada:    e.eCantidad,
        ePrecioSnapshot:          e.ePrecioExtra,
        tNombreSnapshot:          e.tNombreOpcion,
      }))
    );

    if (filasExtras.length > 0) {
      const { error: extrasError } = await adminClient
        .from("autoconsumo_detalle_extras")
        .insert(filasExtras);

      if (extrasError) {
        await adminClient.from("autoconsumos").delete().eq("eCodAutoconsumo", autoconsumo.eCodAutoconsumo);
        return { error: `Error al guardar extras: ${extrasError.message}` };
      }
    }

    // ── Descontar inventario ─────────────────────────────────────────────────
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const lote = lotesPorItem[idx];

      if (lote.bUnlimitedInventory) {
        await adminClient
          .from("inventario")
          .update({ fhUpdateInventory: new Date().toISOString() })
          .eq("eCodInventory", lote.eCodInventory);
        continue;
      }

      const restanteTrasConsumo = lote.eCantRestante - item.cantidad;

      const { data: updated } = await adminClient
        .from("inventario")
        .update({
          version:           lote.version + 1,
          bStateInventory:   restanteTrasConsumo > 0,
          fhUpdateInventory: new Date().toISOString(),
        })
        .eq("eCodInventory", lote.eCodInventory)
        .eq("version",       lote.version)
        .select("eCodInventory");

      if (!updated || updated.length === 0) {
        await adminClient.from("autoconsumos").delete().eq("eCodAutoconsumo", autoconsumo.eCodAutoconsumo);
        return {
          error:
            "No se pudo registrar el autoconsumo: otro movimiento modificó el mismo producto " +
            "al mismo tiempo. Verifica el stock disponible e intenta de nuevo.",
        };
      }
    }

    // ── Descontar insumos según receta ───────────────────────────────────────
    for (let idx = 0; idx < items.length; idx++) {
      for (const insumo of insumosPorItem[idx]) {
        const { data: actual } = await adminClient
          .from("insumos_stock")
          .select("eCantidadStock, version")
          .eq("eCodInsumoStock", insumo.fkeCodInsumoStock)
          .single();

        if (!actual) continue;

        const nuevaCantidad = actual.eCantidadStock - insumo.eCantidadADescontar;

        const { data: actualizado } = await adminClient
          .from("insumos_stock")
          .update({
            eCantidadStock:      Math.max(0, nuevaCantidad),
            version:             actual.version + 1,
            fhUpdateInsumoStock: new Date().toISOString(),
          })
          .eq("eCodInsumoStock", insumo.fkeCodInsumoStock)
          .eq("version", actual.version)
          .select("eCodInsumoStock");

        if (!actualizado || actualizado.length === 0) {
          await adminClient.from("autoconsumo_insumos_consumidos").delete().eq("fkeCodAutoconsumo", autoconsumo.eCodAutoconsumo);
          await adminClient.from("autoconsumos").delete().eq("eCodAutoconsumo", autoconsumo.eCodAutoconsumo);
          return {
            error:
              "No se pudo registrar el autoconsumo: otro movimiento modificó el mismo insumo " +
              "al mismo tiempo. Intenta de nuevo.",
          };
        }

        await adminClient.from("autoconsumo_insumos_consumidos").insert({
          fkeCodAutoconsumo:     autoconsumo.eCodAutoconsumo,
          fkeCodInsumoStock:     insumo.fkeCodInsumoStock,
          tNombreInsumoSnapshot: insumo.tNombreInsumoSnapshot,
          eCantidadDescontada:   insumo.eCantidadADescontar,
          tUnidadSnapshot:       insumo.tUnidadSnapshot,
        });
      }
    }

    revalidatePath("/empleado/autoconsumo");
    revalidatePath("/admin/inventario");
    revalidatePath("/admin/insumos");
    revalidatePath("/admin/autoconsumo");
    return { eCodAutoconsumo: autoconsumo.eCodAutoconsumo as string };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

/**
 * Historial de autoconsumo del empleado actual durante su turno abierto
 * (o, sin turno, del día en curso) — se muestra en /empleado/autoconsumo.
 */
export async function obtenerAutoconsumoDelTurno(): Promise<AutoconsumoHistorial[]> {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: corteAbierto } = await adminClient
    .from("cortes_caja")
    .select("fhInicioTurno")
    .eq("fkeCodUser", user.id)
    .eq("bStateCorte", "abierto")
    .maybeSingle();

  const desde = corteAbierto?.fhInicioTurno
    ?? new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const { data: registros } = await adminClient
    .from("autoconsumos")
    .select(
      "eCodAutoconsumo, fhCreateAutoconsumo, tNota, " +
      "autoconsumo_detalle(tNombreProductoSnapshot, tNombrePresentacionSnapshot, eCantidad, ePrecioReferenciaSnapshot, " +
      "autoconsumo_detalle_extras(tNombreSnapshot, eCantidadSeleccionada))"
    )
    .eq("fkeCodUser", user.id)
    .gte("fhCreateAutoconsumo", desde)
    .order("fhCreateAutoconsumo", { ascending: false });

  return (registros ?? []).map((r: any) => ({
    eCodAutoconsumo:     r.eCodAutoconsumo,
    fhCreateAutoconsumo: r.fhCreateAutoconsumo,
    tNota:               r.tNota,
    items: (r.autoconsumo_detalle ?? []).map((d: any) => ({
      tNombreProductoSnapshot:     d.tNombreProductoSnapshot,
      tNombrePresentacionSnapshot: d.tNombrePresentacionSnapshot,
      eCantidad:                   d.eCantidad,
      ePrecioReferenciaSnapshot:   d.ePrecioReferenciaSnapshot ?? 0,
      extras: (d.autoconsumo_detalle_extras ?? []).map((e: any) => ({
        tNombreSnapshot:       e.tNombreSnapshot,
        eCantidadSeleccionada: e.eCantidadSeleccionada,
      })),
    })),
  }));
}

/**
 * Historial de autoconsumo de todo el negocio (o de la sucursal activa,
 * si el admin eligió una) — usado en /admin/autoconsumo para ver el consumo
 * por empleado sin que se mezcle con las ventas normales.
 */
export async function obtenerAutoconsumoAdmin(): Promise<AutoconsumoAdminRow[]> {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: perfilActual } = await adminClient
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user.id)
    .single();

  if (!perfilActual?.fkeCodCompany) return [];

  const { data: registros } = await adminClient
    .from("autoconsumos")
    .select(
      "eCodAutoconsumo, fhCreateAutoconsumo, tNota, fkeCodUser, " +
      "autoconsumo_detalle(tNombreProductoSnapshot, tNombrePresentacionSnapshot, eCantidad, ePrecioReferenciaSnapshot, " +
      "autoconsumo_detalle_extras(tNombreSnapshot, eCantidadSeleccionada)), " +
      "autoconsumo_insumos_consumidos(tNombreInsumoSnapshot, eCantidadDescontada, tUnidadSnapshot)"
    )
    .eq("fkeCodCompany", perfilActual.fkeCodCompany)
    .order("fhCreateAutoconsumo", { ascending: false })
    .limit(200);

  const empleadoIds = [...new Set((registros ?? []).map((r: any) => r.fkeCodUser))];
  let perfiles: any[] = [];

  if (empleadoIds.length > 0) {
    const { data: perfs } = await adminClient
      .from("perfiles")
      .select("eCodUser, tNameUser")
      .in("eCodUser", empleadoIds);
    perfiles = perfs ?? [];
  }

  const perfilesMap = new Map(perfiles.map((p) => [p.eCodUser, p]));

  return (registros ?? []).map((r: any) => ({
    eCodAutoconsumo:     r.eCodAutoconsumo,
    fhCreateAutoconsumo: r.fhCreateAutoconsumo,
    tNota:               r.tNota,
    empleado:            perfilesMap.get(r.fkeCodUser) ?? null,
    items: (r.autoconsumo_detalle ?? []).map((d: any) => ({
      tNombreProductoSnapshot:     d.tNombreProductoSnapshot,
      tNombrePresentacionSnapshot: d.tNombrePresentacionSnapshot,
      eCantidad:                   d.eCantidad,
      ePrecioReferenciaSnapshot:   d.ePrecioReferenciaSnapshot ?? 0,
      extras: (d.autoconsumo_detalle_extras ?? []).map((e: any) => ({
        tNombreSnapshot:       e.tNombreSnapshot,
        eCantidadSeleccionada: e.eCantidadSeleccionada,
      })),
    })),
    insumosConsumidos: (r.autoconsumo_insumos_consumidos ?? []).map((c: any) => ({
      tNombreInsumoSnapshot: c.tNombreInsumoSnapshot,
      eCantidadDescontada:   c.eCantidadDescontada,
      tUnidadSnapshot:       c.tUnidadSnapshot,
    })),
  }));
}

/**
 * Elimina un registro de autoconsumo y restaura lo descontado — mismo
 * criterio de restauración que cancelarVenta en ventas.ts: repone inventario
 * (solo productos por unidad, ilimitados se ignoran) e insumos_stock a partir
 * de los snapshots guardados, con reintento optimista sobre insumos_stock.
 */
export async function eliminarAutoconsumo(eCodAutoconsumo: string) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    const { data: perfil } = await adminClient
      .from("perfiles")
      .select("tRolUser, fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (perfil?.tRolUser !== "admin") return { error: "No autorizado" };

    const { data: autoconsumo } = await adminClient
      .from("autoconsumos")
      .select("eCodAutoconsumo, fkeCodCompany, fkeCodSucursal")
      .eq("eCodAutoconsumo", eCodAutoconsumo)
      .single();

    if (!autoconsumo) return { error: "Registro no encontrado" };
    if (autoconsumo.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { data: detalles } = await adminClient
      .from("autoconsumo_detalle")
      .select("fkeCodProduct, fkeCodPresentacion, eCantidad")
      .eq("fkeCodAutoconsumo", eCodAutoconsumo);

    // Reactivar inventario (solo productos por unidad, no ilimitados) — NO se
    // toca eCantIngresada: vista_inventario calcula eCantRestante restando
    // autoconsumo_detalle directamente, así que borrar el registro (más abajo,
    // vía ON DELETE CASCADE) ya libera el stock por sí solo. Sumarlo aquí
    // también lo duplicaría.
    for (const detalle of detalles ?? []) {
      let q = adminClient
        .from("inventario")
        .select("eCodInventory, bUnlimitedInventory, version")
        .eq("fkeCodProduct", detalle.fkeCodProduct)
        .eq("fkeCodSucursal", autoconsumo.fkeCodSucursal);

      q = detalle.fkeCodPresentacion
        ? q.eq("fkeCodPresentacion", detalle.fkeCodPresentacion)
        : q.is("fkeCodPresentacion", null);

      const { data: lote } = await q.maybeSingle();
      if (!lote || lote.bUnlimitedInventory) continue;

      await adminClient
        .from("inventario")
        .update({
          version:           (lote.version ?? 0) + 1,
          bStateInventory:   true,
          fhUpdateInventory: new Date().toISOString(),
        })
        .eq("eCodInventory", lote.eCodInventory);
    }

    // Restaurar insumos consumidos, con reintento optimista igual que cancelarVenta
    const { data: consumos } = await adminClient
      .from("autoconsumo_insumos_consumidos")
      .select("fkeCodInsumoStock, eCantidadDescontada")
      .eq("fkeCodAutoconsumo", eCodAutoconsumo);

    for (const consumo of consumos ?? []) {
      if (!consumo.fkeCodInsumoStock) continue;

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

        if (actualizado && actualizado.length > 0) {
          restaurado = true;
        } else {
          intento++;
        }
      }
    }

    // El delete de "autoconsumos" arrastra detalle e insumos consumidos
    // (ON DELETE CASCADE en ambas tablas hijas).
    const { error: deleteError } = await adminClient
      .from("autoconsumos")
      .delete()
      .eq("eCodAutoconsumo", eCodAutoconsumo);

    if (deleteError) return { error: `Error al eliminar: ${deleteError.message}` };

    revalidatePath("/admin/autoconsumo");
    revalidatePath("/admin/inventario");
    revalidatePath("/admin/insumos");
    revalidatePath("/empleado/autoconsumo");
    return { ok: true };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

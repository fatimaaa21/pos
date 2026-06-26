"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath }    from "next/cache";
import { resolverSucursalVenta } from "@/lib/utils/sucursal";
import type { MetodoPago }   from "@/types";

interface ItemVenta {
  eCodProduct:       string;
  eCodPresentacion?: string;
  cantidad:          number;
  precioUnitario:    number;
  eCodMaterial?:     string;
  metrosConsumidos?: number;
  eAnchoCm?:         number;
  eLargoCm?:         number;
}

export async function crearVenta(
  items: ItemVenta[],
  fkeMetodoPago: MetodoPago,
  aplicarIva: boolean = true,
  /** Cargo adicional por tiempo de mesa (billar). Ya incluye IVA si aplica. */
  extraCharge: number = 0,
) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    // Resuelve sucursal: fija para empleado, por cookie (o única) para admin.
    const ctx = await resolverSucursalVenta();
    if ("error" in ctx) return ctx;

    const fkeCodCompany  = ctx.fkeCodCompany;
    const fkeCodSucursal = ctx.fkeCodSucursal;

    type LoteCapturado = {
      eCodInventory:       string;
      eCantRestante:       number;
      bUnlimitedInventory: boolean;
      version:             number;
    };

    const lotesPorItem:   LoteCapturado[] = [];
    const hojasPorItem:   (number | null)[] = []; // hojas a descontar por item (null = no aplica)

    // ── Fase 1: validar stock ─────────────────────────────────────────────────
    for (const item of items) {

      // Productos por medida — el stock es el material, no inventario
      if (item.eCodMaterial) {
        const { data: material, error: materialError } = await adminClient
          .from("materiales")
          .select("eCodMaterial, eMetrosLineales, bStateMaterial")
          .eq("eCodMaterial", item.eCodMaterial)
          .single();

        if (!material) {
          return { error: `Material no encontrado (id: ${item.eCodMaterial}) error: ${materialError?.message}` };
        }

        if (!material.bStateMaterial) {
          return { error: "El material está desactivado" };
        }

        if ((material.eMetrosLineales ?? 0) < (item.metrosConsumidos ?? 0)) {
          return {
            error: `Metros insuficientes en el material. Solo quedan ${material.eMetrosLineales}m disponibles`,
          };
        }

        // Marcar como ilimitado para saltarse Fase 2
        hojasPorItem.push(null); // productos por medida no consumen hojas
        lotesPorItem.push({
          eCodInventory:       "",
          eCantRestante:       0,
          bUnlimitedInventory: true,
          version:             0,
        });
        continue;
      }

      // ── Primero verificar si el producto tiene material vinculado ─────────
      // Para productos de impresión por unidad, el stock lo controla el material,
      // no un registro de inventario. Se salta vista_inventario en ese caso.
      const { data: prodDims } = await adminClient
        .from("productos")
        .select("eAnchoCm, eAltoCm, fkeCodMaterial")
        .eq("eCodProduct", item.eCodProduct)
        .single();

      if (prodDims?.fkeCodMaterial && prodDims.eAnchoCm && prodDims.eAltoCm) {
        // Producto unidad vinculado a hoja — validar solo el material
        const { data: mat } = await adminClient
          .from("materiales")
          .select("eCodMaterial, eAnchoCm, eAltoCm, eMetrosLineales, bStateMaterial")
          .eq("eCodMaterial", prodDims.fkeCodMaterial)
          .single();

        if (!mat) {
          return { error: "Material vinculado al producto no encontrado" };
        }
        if (!mat.bStateMaterial) {
          return { error: "El material vinculado está desactivado" };
        }
        if (!mat.eAnchoCm || !mat.eAltoCm) {
          return { error: "El material no tiene dimensiones configuradas" };
        }

        // Orientación óptima de corte (guillotina)
        const orientA = Math.floor(mat.eAnchoCm / prodDims.eAnchoCm) * Math.floor(mat.eAltoCm / prodDims.eAltoCm);
        const orientB = Math.floor(mat.eAnchoCm / prodDims.eAltoCm)  * Math.floor(mat.eAltoCm / prodDims.eAnchoCm);
        const piezasPorHoja = Math.max(orientA, orientB);

        if (piezasPorHoja < 1) {
          return { error: `El producto (${prodDims.eAnchoCm}×${prodDims.eAltoCm} cm) no cabe en la hoja del material (${mat.eAnchoCm}×${mat.eAltoCm} cm)` };
        }

        // Si el item tiene presentación, multiplicar por las unidades físicas que representa
        let piezasTotales = item.cantidad;
        if (item.eCodPresentacion) {
          const { data: pres } = await adminClient
            .from("presentaciones")
            .select("eCantidadUnidades")
            .eq("eCodPresentacion", item.eCodPresentacion)
            .single();
          piezasTotales = item.cantidad * (pres?.eCantidadUnidades ?? 1);
        }

        const hojasNecesarias = Math.ceil(piezasTotales / piezasPorHoja);

        if ((mat.eMetrosLineales ?? 0) < hojasNecesarias) {
          return {
            error: `Hojas insuficientes. Se necesitan ${hojasNecesarias} hoja${hojasNecesarias !== 1 ? "s" : ""} pero solo quedan ${mat.eMetrosLineales}`,
          };
        }

        // Marcar como ilimitado para saltarse Fase 2 (no hay registro de inventario)
        hojasPorItem.push(hojasNecesarias);
        lotesPorItem.push({
          eCodInventory:       "",
          eCantRestante:       0,
          bUnlimitedInventory: true,
          version:             0,
        });
        continue;
      }

      // ── Productos por unidad sin material — validación normal de inventario ─
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
        return { error: "Producto sin inventario activo" };
      }

      // Preferir ilimitado, si no el de mayor stock
      const lote = lotesDisponibles.find((l) => l.bUnlimitedInventory)
        ?? [...lotesDisponibles].sort((a, b) => (b.eCantRestante ?? 0) - (a.eCantRestante ?? 0))[0];

      if (!lote.bUnlimitedInventory && (lote.eCantRestante ?? 0) < item.cantidad) {
        return {
          error: `Stock insuficiente. Solo quedan ${lote.eCantRestante} unidades disponibles`,
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

      hojasPorItem.push(null);
      lotesPorItem.push({
        eCodInventory:       lote.eCodInventory,
        eCantRestante:       lote.eCantRestante ?? 0,
        bUnlimitedInventory: lote.bUnlimitedInventory,
        version,
      });
    }

    // ── Total ─────────────────────────────────────────────────────────────────
    const eTotalProductos = items.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0);
    const eTotal          = eTotalProductos + extraCharge;

    // ── Encabezado de venta ───────────────────────────────────────────────────
    const { data: venta, error: ventaError } = await adminClient
      .from("ventas")
      .insert({
        fkeCodUser:       user.id,
        fkeCodCompany,
        fkeCodSucursal,
        eTotal,
        fkeMetodoPago,
        fhCreateVenta:    new Date().toISOString(),
        eCostoTiempoMesa: extraCharge > 0 ? extraCharge : null,
      })
      .select("eCodVenta")
      .single();

    if (ventaError || !venta) {
      return { error: `Error al crear venta: ${ventaError?.message}` };
    }

    // ── Detalle de venta ──────────────────────────────────────────────────────
    const detalle = items.map((i, idx) => ({
      fkeCodVenta:        venta.eCodVenta,
      fkeCodProduct:      i.eCodProduct,
      fkeCodPresentacion: i.eCodPresentacion ?? null,
      eCantidad:          i.cantidad,
      ePrecioUnitario:    i.precioUnitario,
      eSubtotal:          i.precioUnitario * i.cantidad,
      eAnchoCm:           i.eAnchoCm    ?? null,
      eLargoCm:           i.eLargoCm    ?? null,
      fkeCodMaterial:     i.eCodMaterial ?? null,
      eHojasConsumidas:   hojasPorItem[idx] ?? null,
    }));

    const { error: detalleError } = await adminClient
      .from("detalle_venta")
      .insert(detalle);

    if (detalleError) {
      await adminClient.from("ventas").delete().eq("eCodVenta", venta.eCodVenta);
      return { error: `Error al guardar detalle: ${detalleError.message}` };
    }

    // ── Fase 2: actualizar inventario (solo productos por unidad) ─────────────
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const lote = lotesPorItem[idx];

      // Productos por medida — se manejan en Fase 3
      if (!lote.eCodInventory) continue;

      // Lotes ilimitados: solo actualizar timestamp
      if (lote.bUnlimitedInventory) {
        await adminClient
          .from("inventario")
          .update({ fhUpdateInventory: new Date().toISOString() })
          .eq("eCodInventory", lote.eCodInventory);
        continue;
      }

      const restanteTrasVenta = lote.eCantRestante - item.cantidad;

      const { data: updated } = await adminClient
        .from("inventario")
        .update({
          version:           lote.version + 1,
          bStateInventory:   restanteTrasVenta > 0,
          fhUpdateInventory: new Date().toISOString(),
        })
        .eq("eCodInventory", lote.eCodInventory)
        .eq("version",       lote.version)
        .select("eCodInventory");

      if (!updated || updated.length === 0) {
        await adminClient.from("detalle_venta").delete().eq("fkeCodVenta", venta.eCodVenta);
        await adminClient.from("ventas").delete().eq("eCodVenta", venta.eCodVenta);
        return {
          error:
            "No se pudo registrar la venta: otro empleado vendió el mismo producto " +
            "al mismo tiempo. Verifica el stock disponible e intenta de nuevo.",
        };
      }
    }

    // ── Fase 3: descontar metros del material (productos por medida / rollo) ───
    for (const item of items) {
      if (!item.eCodMaterial || !item.metrosConsumidos) continue;

      const { data: material } = await adminClient
        .from("materiales")
        .select("eCodMaterial, eMetrosLineales")
        .eq("eCodMaterial", item.eCodMaterial)
        .single();

      if (!material) continue;

      const nuevosMetros = Math.max(
        0,
        (material.eMetrosLineales ?? 0) - item.metrosConsumidos
      );

      await adminClient
        .from("materiales")
        .update({
          eMetrosLineales:  nuevosMetros,
          fhUpdateMaterial: new Date().toISOString(),
        })
        .eq("eCodMaterial", item.eCodMaterial);
    }

    // ── Fase 4: descontar hojas del material (productos por unidad con material) ─
    for (let idx = 0; idx < items.length; idx++) {
      const hojas = hojasPorItem[idx];
      if (!hojas) continue;

      // Obtener el fkeCodMaterial del producto (ya validado en Fase 1)
      const { data: prodDims } = await adminClient
        .from("productos")
        .select("fkeCodMaterial")
        .eq("eCodProduct", items[idx].eCodProduct)
        .single();

      if (!prodDims?.fkeCodMaterial) continue;

      const { data: mat } = await adminClient
        .from("materiales")
        .select("eMetrosLineales")
        .eq("eCodMaterial", prodDims.fkeCodMaterial)
        .single();

      if (!mat) continue;

      await adminClient
        .from("materiales")
        .update({
          eMetrosLineales:  Math.max(0, (mat.eMetrosLineales ?? 0) - hojas),
          fhUpdateMaterial: new Date().toISOString(),
        })
        .eq("eCodMaterial", prodDims.fkeCodMaterial);
    }

    revalidatePath("/empleado/menu");
    revalidatePath("/admin/inventario");
    revalidatePath("/admin/ventas");
    return { eCodVenta: venta.eCodVenta };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function cancelarVenta(formData: FormData) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("tRolUser, fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil) return { error: "Perfil no encontrado" };

    const eCodVenta          = formData.get("eCodVenta")          as string;
    const tMotivoCancelacion = (formData.get("tMotivoCancelacion") as string)?.trim();

    if (!tMotivoCancelacion) return { error: "El motivo de cancelación es requerido" };

    const { data: venta } = await adminClient
      .from("ventas")
      .select("eCodVenta, fkeCodUser, fkeCodCompany, fkeCodSucursal, bCancelada, fhCreateVenta")
      .eq("eCodVenta", eCodVenta)
      .single();

    if (!venta)           return { error: "Venta no encontrada" };
    if (venta.bCancelada) return { error: "Esta venta ya fue cancelada" };

    if (venta.fkeCodCompany !== perfil.fkeCodCompany) {
      return { error: "No tienes acceso a esta venta" };
    }

    const esAdmin    = perfil.tRolUser === "admin";
    const esEmpleado = perfil.tRolUser === "empleado";

    if (!esAdmin && !esEmpleado) return { error: "No autorizado" };

    if (esEmpleado) {
      if (venta.fkeCodUser !== user.id) {
        return { error: "Solo puedes cancelar tus propias ventas" };
      }

      const { data: corteAbierto } = await adminClient
        .from("cortes_caja")
        .select("fhInicioTurno")
        .eq("fkeCodUser", user.id)
        .eq("bStateCorte", "abierto")
        .maybeSingle();

      if (!corteAbierto) {
        return { error: "Solo puedes cancelar ventas mientras tienes un turno activo" };
      }

      if (new Date(venta.fhCreateVenta) < new Date(corteAbierto.fhInicioTurno)) {
        return { error: "Solo puedes cancelar ventas del turno actual" };
      }
    }

    const { data: detalles } = await adminClient
      .from("detalle_venta")
      .select("fkeCodProduct, fkeCodPresentacion, eCantidad")
      .eq("fkeCodVenta", eCodVenta);

    const { error: cancelError } = await adminClient
      .from("ventas")
      .update({
        bCancelada:          true,
        tMotivoCancelacion,
        fhCancelacion:       new Date().toISOString(),
        fkeCodCancelador:    user.id,
      })
      .eq("eCodVenta", eCodVenta);

    if (cancelError) return { error: `Error al cancelar: ${cancelError.message}` };

    // Restaurar inventario (solo productos por unidad)
    for (const detalle of detalles ?? []) {
      let q = adminClient
        .from("inventario")
        .select("eCodInventory, eCantIngresada, bUnlimitedInventory, version")
        .eq("fkeCodProduct", detalle.fkeCodProduct)
        .eq("fkeCodSucursal", venta.fkeCodSucursal);

      q = detalle.fkeCodPresentacion
        ? q.eq("fkeCodPresentacion", detalle.fkeCodPresentacion)
        : q.is("fkeCodPresentacion", null);

      const { data: lote } = await q.maybeSingle();
      if (!lote || lote.bUnlimitedInventory) continue;

      await adminClient
        .from("inventario")
        .update({
          eCantIngresada:    (lote.eCantIngresada ?? 0) + detalle.eCantidad,
          version:           (lote.version ?? 0) + 1,
          bStateInventory:   true,
          fhUpdateInventory: new Date().toISOString(),
        })
        .eq("eCodInventory", lote.eCodInventory);
    }

    revalidatePath("/admin/ventasAdmin");
    revalidatePath("/empleado/ventasEmpleado");
    revalidatePath("/admin/dashboard");
    revalidatePath("/empleado/menu");
    return { ok: true };

  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
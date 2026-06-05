"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath }    from "next/cache";
import type { MetodoPago }   from "@/types";

interface ItemVenta {
  eCodProduct:       string;
  eCodPresentacion?: string;
  cantidad:          number;
  precioUnitario:    number;
}

export async function crearVenta(
  items: ItemVenta[],
  fkeMetodoPago: MetodoPago,
  aplicarIva: boolean = true,
) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "No autenticado" };

    const { data: perfil, error: perfilError } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (perfilError || !perfil?.fkeCodCompany) {
      return { error: "No se encontró el negocio del empleado" };
    }

    const fkeCodCompany = perfil.fkeCodCompany;

    // ── Validar stock por ítem ────────────────────────────────────────────────
    for (const item of items) {
      let query = adminClient
        .from("vista_inventario")
        .select("eCodInventory, eCantRestante, bUnlimitedInventory")
        .eq("fkeCodProduct", item.eCodProduct)
        .eq("bStateInventory", true);

      if (item.eCodPresentacion) {
        query = query.eq("fkeCodPresentacion", item.eCodPresentacion);
      } else {
        query = query.is("fkeCodPresentacion", null);
      }

      const { data: lote, error: loteError } = await query.single();

      if (loteError || !lote) {
        return { error: "Producto sin inventario activo" };
      }

      if (!lote.bUnlimitedInventory && (lote.eCantRestante ?? 0) < item.cantidad) {
        return {
          error: `Stock insuficiente. Solo quedan ${lote.eCantRestante} unidades disponibles`,
        };
      }
    }

    // ── Total a guardar ───────────────────────────────────────────────────────
    // Los precios ya incluyen IVA. eTotal = lo que realmente se cobra.
    // aplicarIva afecta solo cómo se muestra el desglose en pantalla, no el total.
    const eTotal = items.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0);

    // ── Encabezado de venta ───────────────────────────────────────────────────
    const { data: venta, error: ventaError } = await adminClient
      .from("ventas")
      .insert({
        fkeCodUser:    user.id,
        fkeCodCompany,
        eTotal,
        fkeMetodoPago,
        fhCreateVenta: new Date().toISOString(),
      })
      .select("eCodVenta")
      .single();

    if (ventaError || !venta) {
      return { error: `Error al crear venta: ${ventaError?.message}` };
    }

    // ── Detalle de venta ──────────────────────────────────────────────────────
    const detalle = items.map((i) => ({
      fkeCodVenta:         venta.eCodVenta,
      fkeCodProduct:       i.eCodProduct,
      fkeCodPresentacion:  i.eCodPresentacion ?? null,
      eCantidad:           i.cantidad,
      ePrecioUnitario:     i.precioUnitario,
      eSubtotal:           i.precioUnitario * i.cantidad,
    }));

    const { error: detalleError } = await adminClient
      .from("detalle_venta")
      .insert(detalle);

    if (detalleError) {
      return { error: `Error al guardar detalle: ${detalleError.message}` };
    }

    // ── Descontar inventario ──────────────────────────────────────────────────
    for (const item of items) {
      let query = adminClient
        .from("vista_inventario")
        .select("eCodInventory, eCantRestante, bUnlimitedInventory")
        .eq("fkeCodProduct", item.eCodProduct)
        .eq("bStateInventory", true);

      if (item.eCodPresentacion) {
        query = query.eq("fkeCodPresentacion", item.eCodPresentacion);
      } else {
        query = query.is("fkeCodPresentacion", null);
      }

      const { data: lote } = await query.single();
      if (!lote) continue;

      if (lote.bUnlimitedInventory) {
        await adminClient
          .from("inventario")
          .update({ fhUpdateInventory: new Date().toISOString() })
          .eq("eCodInventory", lote.eCodInventory);
        continue;
      }

      const restanteTrasVenta = (lote.eCantRestante ?? 0) - item.cantidad;
      await adminClient
        .from("inventario")
        .update({
          bStateInventory:   restanteTrasVenta > 0,
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

// ─────────────────────────────────────────────────────────────
// CANCELAR VENTA
// Admin  → puede cancelar cualquier venta del negocio
// Empleado → solo sus propias ventas del turno activo
// ─────────────────────────────────────────────────────────────
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

    // ── Leer la venta ─────────────────────────────────────────────────────
    const { data: venta } = await adminClient
      .from("ventas")
      .select("eCodVenta, fkeCodUser, fkeCodCompany, bCancelada, fhCreateVenta")
      .eq("eCodVenta", eCodVenta)
      .single();

    if (!venta)          return { error: "Venta no encontrada" };
    if (venta.bCancelada) return { error: "Esta venta ya fue cancelada" };

    // ── Verificar que la venta pertenece al mismo negocio ─────────────────
    if (venta.fkeCodCompany !== perfil.fkeCodCompany) {
      return { error: "No tienes acceso a esta venta" };
    }

    // ── Reglas por rol ────────────────────────────────────────────────────
    const esAdmin    = perfil.tRolUser === "admin";
    const esEmpleado = perfil.tRolUser === "empleado";

    if (!esAdmin && !esEmpleado) return { error: "No autorizado" };

    if (esEmpleado) {
      // Solo puede cancelar sus propias ventas
      if (venta.fkeCodUser !== user.id) {
        return { error: "Solo puedes cancelar tus propias ventas" };
      }

      // Solo puede cancelar ventas del turno activo
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

    // ── Obtener detalle para restaurar inventario ─────────────────────────
    const { data: detalles } = await adminClient
      .from("detalle_venta")
      .select("fkeCodProduct, fkeCodPresentacion, eCantidad")
      .eq("fkeCodVenta", eCodVenta);

    // ── Marcar la venta como cancelada ────────────────────────────────────
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

    // ── Restaurar inventario ──────────────────────────────────────────────
    for (const detalle of detalles ?? []) {
      let query = adminClient
        .from("vista_inventario")
        .select("eCodInventory, eCantIngresada, bUnlimitedInventory")
        .eq("fkeCodProduct", detalle.fkeCodProduct)
        .eq("bStateInventory", true);   // buscar el lote activo

      query = detalle.fkeCodPresentacion
        ? query.eq("fkeCodPresentacion", detalle.fkeCodPresentacion)
        : query.is("fkeCodPresentacion", null);

      const { data: lote } = await query.maybeSingle();
      if (!lote || lote.bUnlimitedInventory) continue;

      // Devolver las unidades sumando a eCantIngresada
      await adminClient
        .from("inventario")
        .update({
          eCantIngresada:    (lote.eCantIngresada ?? 0) + detalle.eCantidad,
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
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

// ─────────────────────────────────────────────────────────────
// CREAR VENTA
// Incluye optimistic locking para prevenir race conditions
// cuando dos empleados venden el mismo producto simultáneamente.
// ─────────────────────────────────────────────────────────────
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

    // ── Fase 1: validar stock + capturar versiones ────────────────────────────
    //
    // Leemos el stock disponible (vista_inventario) y la versión actual
    // del lote (tabla inventario). Guardamos ambos para usarlos en la
    // Fase 2 sin tener que volver a leer, garantizando consistencia.

    type LoteCapturado = {
      eCodInventory:       string;
      eCantRestante:       number;
      bUnlimitedInventory: boolean;
      version:             number;
    };

    const lotesPorItem: LoteCapturado[] = [];

    for (const item of items) {
      // Stock desde la vista (incluye eCantRestante calculado)
      let q = adminClient
        .from("vista_inventario")
        .select("eCodInventory, eCantRestante, bUnlimitedInventory")
        .eq("fkeCodProduct", item.eCodProduct)
        .eq("bStateInventory", true);

      q = item.eCodPresentacion
        ? q.eq("fkeCodPresentacion", item.eCodPresentacion)
        : q.is("fkeCodPresentacion", null);

      const { data: lote, error: loteError } = await q.single();

      if (loteError || !lote) {
        return { error: "Producto sin inventario activo" };
      }

      if (!lote.bUnlimitedInventory && (lote.eCantRestante ?? 0) < item.cantidad) {
        return {
          error: `Stock insuficiente. Solo quedan ${lote.eCantRestante} unidades disponibles`,
        };
      }

      // Versión desde la tabla base (no está en la vista)
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

    // ── Total ─────────────────────────────────────────────────────────────────
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
      fkeCodVenta:        venta.eCodVenta,
      fkeCodProduct:      i.eCodProduct,
      fkeCodPresentacion: i.eCodPresentacion ?? null,
      eCantidad:          i.cantidad,
      ePrecioUnitario:    i.precioUnitario,
      eSubtotal:          i.precioUnitario * i.cantidad,
    }));

    const { error: detalleError } = await adminClient
      .from("detalle_venta")
      .insert(detalle);

    if (detalleError) {
      // Limpiar la venta huérfana antes de salir
      await adminClient.from("ventas").delete().eq("eCodVenta", venta.eCodVenta);
      return { error: `Error al guardar detalle: ${detalleError.message}` };
    }

    // ── Fase 2: actualizar inventario con optimistic lock ─────────────────────
    //
    // UPDATE solo se aplica si `version` sigue siendo la que leímos en Fase 1.
    // Si otro empleado actualizó el mismo lote entre Fase 1 y aquí,
    // el UPDATE no afecta ninguna fila (0 rows) y detectamos el conflicto.

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const lote = lotesPorItem[idx];

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
          version:           lote.version + 1,         // ← incrementar versión
          bStateInventory:   restanteTrasVenta > 0,
          fhUpdateInventory: new Date().toISOString(),
        })
        .eq("eCodInventory", lote.eCodInventory)
        .eq("version",       lote.version)             // ← guard: solo si nadie más lo tocó
        .select("eCodInventory");

      if (!updated || updated.length === 0) {
        // ── Conflicto de stock ─────────────────────────────────────────────
        // Otro empleado vendió el mismo producto entre nuestra lectura y
        // nuestro intento de actualización. Revertimos esta venta completa.
        await adminClient.from("detalle_venta").delete().eq("fkeCodVenta", venta.eCodVenta);
        await adminClient.from("ventas").delete().eq("eCodVenta", venta.eCodVenta);
        return {
          error:
            "No se pudo registrar la venta: otro empleado vendió el mismo producto " +
            "al mismo tiempo. Verifica el stock disponible e intenta de nuevo.",
        };
      }
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
//
// Al restaurar inventario, consulta la tabla base directamente
// (no la vista) para obtener eCantIngresada + version sin
// depender de columnas calculadas. Esto también maneja lotes
// que quedaron con bStateInventory = false por venta total.
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

    // ── Leer la venta ─────────────────────────────────────────────────────────
    const { data: venta } = await adminClient
      .from("ventas")
      .select("eCodVenta, fkeCodUser, fkeCodCompany, bCancelada, fhCreateVenta")
      .eq("eCodVenta", eCodVenta)
      .single();

    if (!venta)           return { error: "Venta no encontrada" };
    if (venta.bCancelada) return { error: "Esta venta ya fue cancelada" };

    if (venta.fkeCodCompany !== perfil.fkeCodCompany) {
      return { error: "No tienes acceso a esta venta" };
    }

    // ── Reglas por rol ────────────────────────────────────────────────────────
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

    // ── Obtener detalles para restaurar inventario ────────────────────────────
    const { data: detalles } = await adminClient
      .from("detalle_venta")
      .select("fkeCodProduct, fkeCodPresentacion, eCantidad")
      .eq("fkeCodVenta", eCodVenta);

    // ── Marcar venta como cancelada ───────────────────────────────────────────
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

    // ── Restaurar inventario ──────────────────────────────────────────────────
    //
    // Consultamos la tabla base directamente para obtener eCantIngresada y
    // version. No usamos vista_inventario ni filtramos por bStateInventory
    // porque el lote puede estar inactivo (se agotó con esta venta).

    for (const detalle of detalles ?? []) {
      let q = adminClient
        .from("inventario")
        .select("eCodInventory, eCantIngresada, bUnlimitedInventory, version")
        .eq("fkeCodProduct", detalle.fkeCodProduct);

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
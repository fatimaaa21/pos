// src/lib/actions/mesas.ts
"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath }    from "next/cache";
import { crearVenta }        from "@/lib/actions/ventas";
import { getSucursalContext } from "@/lib/utils/sucursal";
import type {
  MesaConEstado,
  OrdenMesaConDetalle,
  OrdenMesaDetalleConProducto,
  MetodoPago,
} from "@/types";

// ─────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────

async function getPerfilActual() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("eCodUser, fkeCodCompany, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  return perfil ? { ...perfil, uid: user.id } : null;
}

// ─────────────────────────────────────────────────────────────
// VERIFICAR MÓDULO ACTIVO
// ─────────────────────────────────────────────────────────────

export async function verificarModuloMesas(
  fkeCodCompany: string
): Promise<boolean> {
  const adminClient = createAdminClient();

  const { data } = await adminClient
    .from("modulos_tenant")
    .select("bStateModulo")
    .eq("fkeCodCompany", fkeCodCompany)
    .eq("tModulo", "mesas")
    .single();

  return data?.bStateModulo === true;
}

// ─────────────────────────────────────────────────────────────
// OBTENER MESAS CON ESTADO
// ─────────────────────────────────────────────────────────────

export async function obtenerMesasConEstado(): Promise<MesaConEstado[]> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return [];

  const adminClient = createAdminClient();

  const ctx = await getSucursalContext();

  const mesasQuery = adminClient
    .from("mesas")
    .select("*")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("bStateMesa", true)
    .order("tNombre");

  if (ctx.fkeCodSucursal) {
    mesasQuery.eq("fkeCodSucursal", ctx.fkeCodSucursal);
  }

  const { data: mesas } = await mesasQuery;

  if (!mesas?.length) return [];

  const { data: ordenes } = await adminClient
    .from("ordenes_mesa")
    .select("*")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("tEstado", "abierta");

  const ordenesPorMesa = new Map(
    (ordenes ?? []).map((o) => [o.fkeCodMesa, o])
  );

  return mesas.map((mesa) => ({
    ...mesa,
    ordenAbierta: ordenesPorMesa.get(mesa.eCodMesa) ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────
// ADMIN: OBTENER TODAS LAS MESAS (activas e inactivas)
// El empleado usa obtenerMesasConEstado (solo activas).
// El admin necesita ver también las inactivas para poder reactivarlas.
// ─────────────────────────────────────────────────────────────

export async function obtenerMesasAdmin(): Promise<MesaConEstado[]> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return [];

  const adminClient = createAdminClient();
  const ctx         = await getSucursalContext();

  const mesasQuery = adminClient
    .from("mesas")
    .select("*")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    // Sin filtro bStateMesa: devuelve activas e inactivas
    .order("tNombre");

  if (ctx.fkeCodSucursal) {
    mesasQuery.eq("fkeCodSucursal", ctx.fkeCodSucursal);
  }

  const { data: mesas } = await mesasQuery;
  if (!mesas?.length) return [];

  const { data: ordenes } = await adminClient
    .from("ordenes_mesa")
    .select("*")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("tEstado", "abierta");

  const ordenesPorMesa = new Map(
    (ordenes ?? []).map((o) => [o.fkeCodMesa, o])
  );

  return mesas.map((mesa) => ({
    ...mesa,
    ordenAbierta: ordenesPorMesa.get(mesa.eCodMesa) ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────
// ADMIN: EDITAR NOMBRE DE MESA
// ─────────────────────────────────────────────────────────────

export async function editarMesa(
  eCodMesa: string,
  tNombre: string
): Promise<{ ok: true } | { error: string }> {
  const nombre = tNombre.trim();
  if (!nombre) return { error: "El nombre es requerido" };

  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { data: mesa } = await adminClient
    .from("mesas")
    .select("fkeCodCompany")
    .eq("eCodMesa", eCodMesa)
    .single();

  if (!mesa || mesa.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }

  const { error } = await adminClient
    .from("mesas")
    .update({ tNombre: nombre })
    .eq("eCodMesa", eCodMesa);

  if (error) return { error: `Error al editar: ${error.message}` };

  revalidatePath("/admin/mesas");
  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// ADMIN: ELIMINAR MESA (hard delete)
// Bloqueado si la mesa tiene una orden abierta.
// ─────────────────────────────────────────────────────────────

export async function eliminarMesa(
  eCodMesa: string
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  // Verificar propiedad
  const { data: mesa } = await adminClient
    .from("mesas")
    .select("fkeCodCompany")
    .eq("eCodMesa", eCodMesa)
    .single();

  if (!mesa || mesa.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }

  // Bloquear si hay orden abierta
  const { data: ordenAbierta } = await adminClient
    .from("ordenes_mesa")
    .select("eCodOrden")
    .eq("fkeCodMesa", eCodMesa)
    .eq("tEstado", "abierta")
    .maybeSingle();

  if (ordenAbierta) {
    return { error: "No puedes eliminar una mesa con una orden abierta" };
  }

  const { error } = await adminClient
    .from("mesas")
    .delete()
    .eq("eCodMesa", eCodMesa);

  if (error) return { error: `Error al eliminar: ${error.message}` };

  revalidatePath("/admin/mesas");
  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// ADMIN: CERRAR ORDEN DE MESA SIN COBRO (force-close)
// Cancela la orden abierta sin generar venta.
// ─────────────────────────────────────────────────────────────

export async function cerrarOrdenMesa(
  eCodOrden: string
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden || orden.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }
  if (orden.tEstado !== "abierta") {
    return { error: "La orden ya no está abierta" };
  }

  const { error } = await adminClient
    .from("ordenes_mesa")
    .update({
      tEstado:   "cancelada",
      fhCerrada: new Date().toISOString(),
    })
    .eq("eCodOrden", eCodOrden);

  if (error) return { error: `Error al cerrar: ${error.message}` };

  revalidatePath("/admin/mesas");
  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// OBTENER DETALLE DE ORDEN ABIERTA
// ─────────────────────────────────────────────────────────────

export async function obtenerOrdenAbierta(
  eCodMesa: string
): Promise<OrdenMesaConDetalle | null> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return null;

  const adminClient = createAdminClient();

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("*")
    .eq("fkeCodMesa", eCodMesa)
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("tEstado", "abierta")
    .maybeSingle();

  if (!orden) return null;

  const { data: detalle } = await adminClient
    .from("ordenes_mesa_detalle")
    .select("*")
    .eq("fkeCodOrden", orden.eCodOrden)
    .order("fhAgregado");

  if (!detalle?.length) {
    return { ...orden, detalle: [], eTotal: 0 };
  }

  // ── Batch: 2 queries en paralelo en lugar de N*2 queries secuenciales ────
  const productIds      = [...new Set(detalle.map((d) => d.fkeCodProduct))];
  const presentacionIds = [...new Set(detalle.map((d) => d.fkeCodPresentacion).filter(Boolean))] as string[];

  const [productosRes, presentacionesRes] = await Promise.all([
    adminClient
      .from("productos")
      .select("eCodProduct, tNameProduct, ImgProduct")
      .in("eCodProduct", productIds),
    presentacionIds.length > 0
      ? adminClient
          .from("presentaciones")
          .select("eCodPresentacion, tNombre")
          .in("eCodPresentacion", presentacionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const productosMap     = new Map((productosRes.data     ?? []).map((p) => [p.eCodProduct,      p]));
  const presentacionesMap = new Map((presentacionesRes.data ?? []).map((p) => [p.eCodPresentacion, p]));

  const detalleConProducto: OrdenMesaDetalleConProducto[] = detalle.map((d) => ({
    ...d,
    producto:     productosMap.get(d.fkeCodProduct)                                           ?? null,
    presentacion: d.fkeCodPresentacion ? (presentacionesMap.get(d.fkeCodPresentacion) ?? null) : null,
  }));

  const eTotal = detalleConProducto.reduce(
    (acc, d) => acc + d.ePrecio * d.eCantidad,
    0
  );

  return {
    ...orden,
    detalle: detalleConProducto,
    eTotal,
  };
}

// ─────────────────────────────────────────────────────────────
// ABRIR ORDEN EN UNA MESA
// ─────────────────────────────────────────────────────────────

export async function abrirOrdenMesa(
  eCodMesa: string
): Promise<{ eCodOrden: string } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  // Verificar que la mesa pertenece al negocio y está activa
  const { data: mesa } = await adminClient
    .from("mesas")
    .select("eCodMesa, fkeCodCompany, fkeCodSucursal, bStateMesa")
    .eq("eCodMesa", eCodMesa)
    .single();

  if (!mesa) return { error: "Mesa no encontrada" };
  if (mesa.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (!mesa.bStateMesa) return { error: "Mesa inactiva" };

  // Verificar que no hay orden abierta (el índice único en BD ya lo protege,
  // pero preferimos un mensaje claro)
  const { data: ordenExistente } = await adminClient
    .from("ordenes_mesa")
    .select("eCodOrden")
    .eq("fkeCodMesa", eCodMesa)
    .eq("tEstado", "abierta")
    .maybeSingle();

  if (ordenExistente) return { error: "La mesa ya tiene una orden abierta" };

  const ctx = await getSucursalContext();

  const { data: orden, error: ordenError } = await adminClient
    .from("ordenes_mesa")
    .insert({
      fkeCodMesa:     eCodMesa,
      fkeCodCompany:  perfil.fkeCodCompany,
      fkeCodSucursal: ctx.fkeCodSucursal ?? mesa.fkeCodSucursal,
      fkeCodUser:     perfil.uid,
      tEstado:        "abierta",
      fhAbierta:      new Date().toISOString(),
    })
    .select("eCodOrden")
    .single();

  if (ordenError || !orden) {
    return { error: `Error al abrir orden: ${ordenError?.message}` };
  }

  revalidatePath("/empleado/mesas");
  return { eCodOrden: orden.eCodOrden };
}

// ─────────────────────────────────────────────────────────────
// AGREGAR PRODUCTO A ORDEN
// ─────────────────────────────────────────────────────────────

interface ItemOrden {
  eCodProduct:       string;
  eCodPresentacion?: string;
  eCantidad:         number;
  ePrecio:           number;
}

export async function agregarItemOrden(
  eCodOrden: string,
  item: ItemOrden
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  // Verificar que la orden es del negocio y está abierta
  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden) return { error: "Orden no encontrada" };
  if (orden.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };

  let q = adminClient
    .from("ordenes_mesa_detalle")
    .select("eCodDetalle, eCantidad")
    .eq("fkeCodOrden", eCodOrden)
    .eq("fkeCodProduct", item.eCodProduct);

  q = item.eCodPresentacion
    ? q.eq("fkeCodPresentacion", item.eCodPresentacion)
    : q.is("fkeCodPresentacion", null);

  const { data: itemExistente } = await q.maybeSingle();

  if (itemExistente) {
    const { error } = await adminClient
      .from("ordenes_mesa_detalle")
      .update({ eCantidad: itemExistente.eCantidad + item.eCantidad })
      .eq("eCodDetalle", itemExistente.eCodDetalle);

    if (error) return { error: `Error al actualizar cantidad: ${error.message}` };
  } else {
    const { error } = await adminClient
      .from("ordenes_mesa_detalle")
      .insert({
        fkeCodOrden:        eCodOrden,
        fkeCodProduct:      item.eCodProduct,
        fkeCodPresentacion: item.eCodPresentacion ?? null,
        eCantidad:          item.eCantidad,
        ePrecio:            item.ePrecio,
        fhAgregado:         new Date().toISOString(),
      });

    if (error) return { error: `Error al agregar producto: ${error.message}` };
}

  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR CANTIDAD DE UN ITEM
// ─────────────────────────────────────────────────────────────

export async function actualizarCantidadItem(
  eCodDetalle: string,
  eCantidad: number
): Promise<{ ok: true } | { error: string }> {
  if (eCantidad < 1) return { error: "La cantidad mínima es 1" };

  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  // Verificar acceso a través de la orden
  const { data: detalle } = await adminClient
    .from("ordenes_mesa_detalle")
    .select("fkeCodOrden")
    .eq("eCodDetalle", eCodDetalle)
    .single();

  if (!detalle) return { error: "Item no encontrado" };

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado")
    .eq("eCodOrden", detalle.fkeCodOrden)
    .single();

  if (!orden || orden.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };

  const { error } = await adminClient
    .from("ordenes_mesa_detalle")
    .update({ eCantidad })
    .eq("eCodDetalle", eCodDetalle);

  if (error) return { error: `Error al actualizar: ${error.message}` };

  revalidatePath("/empleado/mesas");
  return { ok: true };
}


// ─────────────────────────────────────────────────────────────
// ELIMINAR ITEM DE LA ORDEN
// ─────────────────────────────────────────────────────────────

export async function eliminarItemOrden(
  eCodDetalle: string
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: detalle } = await adminClient
    .from("ordenes_mesa_detalle")
    .select("fkeCodOrden")
    .eq("eCodDetalle", eCodDetalle)
    .single();

  if (!detalle) return { error: "Item no encontrado" };

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado")
    .eq("eCodOrden", detalle.fkeCodOrden)
    .single();

  if (!orden || orden.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };

  const { error } = await adminClient
    .from("ordenes_mesa_detalle")
    .delete()
    .eq("eCodDetalle", eCodDetalle);

  if (error) return { error: `Error al eliminar: ${error.message}` };

  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// COBRAR ORDEN DE MESA
// ─────────────────────────────────────────────────────────────

export async function cobrarOrdenMesa(
  eCodOrden: string,
  fkeMetodoPago: MetodoPago
): Promise<{ eCodVenta: string } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("*")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden) return { error: "Orden no encontrada" };
  if (orden.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };

  const { data: detalle } = await adminClient
    .from("ordenes_mesa_detalle")
    .select("*")
    .eq("fkeCodOrden", eCodOrden);

  // ── Cargo por tiempo de mesa (solo negocios tipo billar) ──────────────────
  let cargoBillar = 0;

  const { data: negocio } = await adminClient
    .from("negocios")
    .select("tipo_negocio, costo_hora_billar")
    .eq("eCodCompany", perfil.fkeCodCompany)
    .single();

  if (negocio?.tipo_negocio === "billar" && negocio.costo_hora_billar) {
    const horasTranscurridas =
      (new Date().getTime() - new Date(orden.fhAbierta).getTime()) / (1000 * 60 * 60);
    cargoBillar = Math.round(horasTranscurridas * negocio.costo_hora_billar * 100) / 100;
  }

  // Sin productos y sin cargo de tiempo → no hay nada que cobrar
  if (!detalle?.length && cargoBillar === 0)
    return { error: "La orden no tiene productos" };

  // Construir items en el formato que espera crearVenta
  const items = (detalle ?? []).map((d) => ({
    eCodProduct:      d.fkeCodProduct,
    eCodPresentacion: d.fkeCodPresentacion ?? undefined,
    cantidad:         d.eCantidad,
    precioUnitario:   d.ePrecio,
  }));

  const resultado = await crearVenta(items, fkeMetodoPago, true, cargoBillar);

  if ("error" in resultado) return resultado;

  const { error: cierreError } = await adminClient
    .from("ordenes_mesa")
    .update({
      tEstado:     "cerrada",
      fhCerrada:   new Date().toISOString(),
      fkeCodVenta: resultado.eCodVenta,
    })
    .eq("eCodOrden", eCodOrden);

  if (cierreError) console.error("Error al cerrar orden:", cierreError.message);

  revalidatePath("/empleado/mesas");
  revalidatePath("/admin/menu");
  return { eCodVenta: resultado.eCodVenta };
}

// ─────────────────────────────────────────────────────────────
// ADMIN: GESTIÓN DE MESAS
// ─────────────────────────────────────────────────────────────

export async function crearMesa(
  tNombre: string
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const ctx = await getSucursalContext();
  if (!ctx.fkeCodSucursal) return { error: "Selecciona una sucursal antes de crear mesas" };

  const { error } = await adminClient
    .from("mesas")
    .insert({
      fkeCodCompany:  perfil.fkeCodCompany,
      fkeCodSucursal: ctx.fkeCodSucursal,   // ← nueva
      tNombre:        tNombre.trim(),
      bStateMesa:     true,
      fhCreateMesa:   new Date().toISOString(),
    });

  if (error) return { error: `Error al crear mesa: ${error.message}` };

  revalidatePath("/admin/mesas");
  revalidatePath("/empleado/mesas");
  return { ok: true };
}

export async function toggleMesa(
  eCodMesa: string,
  bStateMesa: boolean
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { data: mesa } = await adminClient
    .from("mesas")
    .select("fkeCodCompany")
    .eq("eCodMesa", eCodMesa)
    .single();

  if (!mesa || mesa.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }

  const { error } = await adminClient
    .from("mesas")
    .update({ bStateMesa })
    .eq("eCodMesa", eCodMesa);

  if (error) return { error: `Error al actualizar mesa: ${error.message}` };

  revalidatePath("/admin/mesas");
  revalidatePath("/empleado/mesas");
  return { ok: true };
}

export async function limpiarOrdenMesa(
  eCodOrden: string
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden || orden.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };

  const { error } = await adminClient
    .from("ordenes_mesa_detalle")
    .delete()
    .eq("fkeCodOrden", eCodOrden);

  if (error) return { error: `Error al limpiar orden: ${error.message}` };

  revalidatePath("/empleado/mesas");
  return { ok: true };
}
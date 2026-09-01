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
  ItemListoCocina,
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
// Incluye conteo de items con tEstadoCocina='listo' por mesa
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

  // ── Conteo de items listos por orden ────────────────────────────────────
  const codOrdenes = (ordenes ?? []).map((o) => o.eCodOrden);
  const itemsListosPorOrden = new Map<string, number>();

  if (codOrdenes.length > 0) {
    const { data: itemsListos } = await adminClient
      .from("ordenes_mesa_detalle")
      .select("fkeCodOrden")
      .in("fkeCodOrden", codOrdenes)
      .eq("tEstadoCocina", "listo");

    for (const item of itemsListos ?? []) {
      const prev = itemsListosPorOrden.get(item.fkeCodOrden) ?? 0;
      itemsListosPorOrden.set(item.fkeCodOrden, prev + 1);
    }
  }

  // ── Segmento activo (o más reciente) por orden — UNA consulta para todas,
  // no una por mesa. Necesario para que el timer del floor plan refleje
  // "Terminar de jugar" (congelado en fhFin) en vez de siempre usar
  // fhAbierta de la orden completa, que nunca se congela.
  const segmentoPorOrden = new Map<string, { fhInicio: string; fhFin: string | null }>();

  if (codOrdenes.length > 0) {
    const { data: segmentos } = await adminClient
      .from("segmentos_tiempo")
      .select("fkeCodOrden, fhInicio, fhFin")
      .in("fkeCodOrden", codOrdenes)
      .order("fhInicio", { ascending: false });

    // Ya vienen ordenados por fhInicio desc — el primero que se ve por
    // orden es el más reciente, así que un Map.set simple con "si no existe
    // todavía" se queda con el correcto sin necesidad de comparar fechas.
    for (const s of segmentos ?? []) {
      if (!segmentoPorOrden.has(s.fkeCodOrden)) {
        segmentoPorOrden.set(s.fkeCodOrden, { fhInicio: s.fhInicio, fhFin: s.fhFin });
      }
    }
  }

  return mesas.map((mesa) => {
    const orden = ordenesPorMesa.get(mesa.eCodMesa) ?? null;
    return {
      ...mesa,
      ordenAbierta: orden,
      itemsListos: orden
        ? (itemsListosPorOrden.get(orden.eCodOrden) ?? 0)
        : 0,
      segmentoActivo: orden
        ? (segmentoPorOrden.get(orden.eCodOrden) ?? null)
        : null,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// ADMIN: OBTENER TODAS LAS MESAS (activas e inactivas)
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
    itemsListos: 0,
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
// ─────────────────────────────────────────────────────────────

export async function eliminarMesa(
  eCodMesa: string
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

  // ── Cuentas activas de esta orden ──────────────────────────────────────────
  // Solo el segmento MÁS RECIENTE define quién sigue en la mesa — no todos
  // los segmentos que alguna vez existieron. Antes se juntaban participantes
  // de TODOS los segmentos históricos (filtrando solo por cuenta.bAbierta),
  // lo cual funcionaba por coincidencia mientras "+ Agregar jugador" solo
  // sumaba gente — pero con "retirarJugador" (que quita a alguien del
  // segmento vigente sin cerrar su cuenta), la cuenta retirada seguía
  // apareciendo para siempre porque su fila vieja en segmento_cuenta del
  // segmento cerrado seguía contando.
  const { data: segmentosOrden } = await adminClient
    .from("segmentos_tiempo")
    .select("eCodSegmento, fhInicio, segmento_cuenta(fkeCodCuenta, cuentas(eCodCuenta, tIdentificador, bAbierta))")
    .eq("fkeCodOrden", orden.eCodOrden)
    .order("fhInicio", { ascending: false })
    .limit(1);

  const cuentasMap = new Map<string, { eCodCuenta: string; tIdentificador: string }>();
  const segmentoMasReciente = (segmentosOrden ?? [])[0];
  for (const sc of (segmentoMasReciente as any)?.segmento_cuenta ?? []) {
    const c = sc.cuentas;
    if (c && c.bAbierta) {
      cuentasMap.set(c.eCodCuenta, { eCodCuenta: c.eCodCuenta, tIdentificador: c.tIdentificador });
    }
  }
  const cuentasActivas = [...cuentasMap.values()];

  const { data: detalle } = await adminClient
    .from("ordenes_mesa_detalle")
    .select("*")
    .eq("fkeCodOrden", orden.eCodOrden)
    .order("fhAgregado");

  if (!detalle?.length) {
    return { ...orden, detalle: [], eTotal: 0, cuentasActivas };
  }

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
    cuentasActivas,
  };
}

// ─────────────────────────────────────────────────────────────
// ABRIR ORDEN EN UNA MESA
// ─────────────────────────────────────────────────────────────

export async function abrirOrdenMesa(
  eCodMesa: string,
  eCodCuentaExistente?: string
): Promise<{ eCodOrden: string; eCodCuenta: string | null } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: mesa } = await adminClient
    .from("mesas")
    .select("eCodMesa, fkeCodCompany, fkeCodSucursal, bStateMesa, tNombre, fkeCodConcepto")
    .eq("eCodMesa", eCodMesa)
    .single();

  if (!mesa) return { error: "Mesa no encontrada" };
  if (mesa.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (!mesa.bStateMesa) return { error: "Mesa inactiva" };

  const { data: ordenExistente } = await adminClient
    .from("ordenes_mesa")
    .select("eCodOrden")
    .eq("fkeCodMesa", eCodMesa)
    .eq("tEstado", "abierta")
    .maybeSingle();

  if (ordenExistente) return { error: "La mesa ya tiene una orden abierta" };

  const { data: negocio } = await adminClient
    .from("negocios")
    .select("tipo_negocio")
    .eq("eCodCompany", perfil.fkeCodCompany)
    .single();

  const esBillar = negocio?.tipo_negocio === "billar";

  if (esBillar && !mesa.fkeCodConcepto) {
    return { error: "La mesa no tiene un concepto de cobro asignado" };
  }

  // Si se pasó una cuenta existente, validarla ANTES de crear nada — evita
  // dejar una orden huérfana si la cuenta resulta inválida.
  if (esBillar && eCodCuentaExistente) {
    const { data: cuentaExistente } = await adminClient
      .from("cuentas")
      .select("fkeCodCompany, bAbierta")
      .eq("eCodCuenta", eCodCuentaExistente)
      .single();

    if (!cuentaExistente) return { error: "La cuenta seleccionada no existe" };
    if (cuentaExistente.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso a esa cuenta" };
    if (!cuentaExistente.bAbierta) return { error: "Esa cuenta ya fue cobrada" };

    // No puede seguir jugando en ninguna otra parte al mismo tiempo — mismo
    // criterio que ya usa "Cobrar cuenta existente" para bloquear ese flujo.
    const { data: segmentosDeEsaCuenta } = await adminClient
      .from("segmento_cuenta")
      .select("segmentos_tiempo(bCerrado)")
      .eq("fkeCodCuenta", eCodCuentaExistente);

    const sigueJugandoEnOtroLado = (segmentosDeEsaCuenta ?? []).some(
      (s: any) => s.segmentos_tiempo?.bCerrado === false
    );
    if (sigueJugandoEnOtroLado) {
      return { error: "Esa cuenta todavía tiene tiempo corriendo en otra mesa — ciérralo antes de abrir aquí" };
    }
  }

  const ctx = await getSucursalContext();
  const fkeCodSucursal = ctx.fkeCodSucursal ?? mesa.fkeCodSucursal;

  const { data: orden, error: ordenError } = await adminClient
    .from("ordenes_mesa")
    .insert({
      fkeCodMesa:     eCodMesa,
      fkeCodCompany:  perfil.fkeCodCompany,
      fkeCodSucursal,
      fkeCodUser:     perfil.uid,
      tEstado:        "abierta",
      fhAbierta:      new Date().toISOString(),
    })
    .select("eCodOrden")
    .single();

  if (ordenError || !orden) {
    return { error: `Error al abrir orden: ${ordenError?.message}` };
  }

  let eCodCuenta: string | null = null;

  if (esBillar) {
    if (eCodCuentaExistente) {
      // Reutilizar la cuenta que ya existe — no crear una genérica nueva.
      eCodCuenta = eCodCuentaExistente;
    } else {
      const { data: cuenta, error: errCuenta } = await adminClient
        .from("cuentas")
        .insert({
          tIdentificador: mesa.tNombre,
          fkeCodCompany:  perfil.fkeCodCompany,
          fkeCodSucursal,
        })
        .select("eCodCuenta")
        .single();

      if (errCuenta || !cuenta) {
        return { error: `Orden abierta pero no se pudo crear la cuenta: ${errCuenta?.message}` };
      }

      eCodCuenta = cuenta.eCodCuenta;
    }

    const { data: segmento, error: errSeg } = await adminClient
      .from("segmentos_tiempo")
      .insert({
        fkeCodOrden:    orden.eCodOrden,
        fkeCodConcepto: mesa.fkeCodConcepto,
      })
      .select("eCodSegmento")
      .single();

    if (errSeg || !segmento) {
      return { error: `Cuenta lista pero no se pudo iniciar el segmento de tiempo: ${errSeg?.message}` };
    }

    await adminClient.from("segmento_cuenta").insert({
      fkeCodSegmento: segmento.eCodSegmento,
      fkeCodCuenta:   eCodCuenta,
      ePorcentaje:    null,
    });
  }

  revalidatePath("/empleado/mesas");
  return { eCodOrden: orden.eCodOrden, eCodCuenta };
}

// ─────────────────────────────────────────────────────────────
// AGREGAR PRODUCTO A ORDEN
// Si el producto tiene bCocina=true, el item entra como 'pendiente'
// ─────────────────────────────────────────────────────────────

interface ItemOrden {
  eCodProduct:       string;
  eCodPresentacion?: string;
  eCantidad:         number;
  ePrecio:           number;
}

/**
 * eCodCuenta es opcional: solo negocios billar lo usan. Para negocios sin
 * cuentas (café, imprenta), pasa null/undefined y se comporta exactamente
 * como antes — solo escribe a ordenes_mesa_detalle.
 */
export async function agregarItemOrden(
  eCodOrden: string,
  item: ItemOrden,
  eCodCuenta?: string | null
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden) return { error: "Orden no encontrada" };
  if (orden.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };

  // ── Verificar si el producto va a cocina ──────────────────────────────────
  const { data: producto } = await adminClient
    .from("productos")
    .select("bCocina")
    .eq("eCodProduct", item.eCodProduct)
    .single();

  const esCocina = producto?.bCocina === true;

  // ── Sin cuenta (negocios no-billar): comportamiento original sin cambios ──
  if (!eCodCuenta) {
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
      const updateData: Record<string, unknown> = {
        eCantidad: itemExistente.eCantidad + item.eCantidad,
      };
      if (esCocina) updateData.tEstadoCocina = "pendiente";

      const { error } = await adminClient
        .from("ordenes_mesa_detalle")
        .update(updateData)
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
          tEstadoCocina:      esCocina ? "pendiente" : null,
        });

      if (error) return { error: `Error al agregar producto: ${error.message}` };
    }

    revalidatePath("/empleado/mesas");
    return { ok: true };
  }

  // ── Con cuenta (billar): verificar cuenta y escribir atómico vía RPC ──────
  const { data: cuenta } = await adminClient
    .from("cuentas")
    .select("eCodCuenta, bAbierta, fkeCodCompany")
    .eq("eCodCuenta", eCodCuenta)
    .single();

  if (!cuenta) return { error: "Cuenta no encontrada" };
  if (cuenta.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso a esta cuenta" };
  if (!cuenta.bAbierta) return { error: "Esta cuenta ya fue cobrada, no se le puede agregar consumo" };

  const { error: errRpc } = await adminClient.rpc("agregar_item_orden_con_cuenta", {
    p_ecodorden:        eCodOrden,
    p_ecodcuenta:       eCodCuenta,
    p_ecodproduct:      item.eCodProduct,
    p_ecodpresentacion: item.eCodPresentacion ?? null,
    p_ecantidad:        item.eCantidad,
    p_eprecio:          item.ePrecio,
    p_escocina:         esCocina,
  });

  if (errRpc) return { error: `Error al agregar producto: ${errRpc.message}` };

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
  // Usa el concepto asignado a LA MESA (conceptos_billar), no el campo legacy
  // negocios.costo_hora_billar — ese campo ya no es fuente de verdad.
  let cargoBillar = 0;
  let cargosTiempo: { tConcepto: string; eMonto: number }[] = [];

  const { data: negocio } = await adminClient
    .from("negocios")
    .select("tipo_negocio")
    .eq("eCodCompany", perfil.fkeCodCompany)
    .single();

  if (negocio?.tipo_negocio === "billar") {
    const { data: mesa } = await adminClient
      .from("mesas")
      .select("fkeCodConcepto")
      .eq("eCodMesa", orden.fkeCodMesa)
      .single();

    if (mesa?.fkeCodConcepto) {
      const { data: concepto } = await adminClient
        .from("conceptos_billar")
        .select("eCostoHora, tNombre")
        .eq("eCodConcepto", mesa.fkeCodConcepto)
        .single();

      if (concepto?.eCostoHora) {
        const horasTranscurridas =
          (new Date().getTime() - new Date(orden.fhAbierta).getTime()) / (1000 * 60 * 60);
        cargoBillar = Math.round(horasTranscurridas * concepto.eCostoHora * 100) / 100;
        if (cargoBillar > 0) {
          cargosTiempo = [{ tConcepto: concepto.tNombre ?? "Tiempo", eMonto: cargoBillar }];
        }
      }
    }
  }

  if (!detalle?.length && cargoBillar === 0)
    return { error: "La orden no tiene productos" };

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
// SEGMENTOS PENDIENTES DE SPLIT — para pedirle al cajero el % antes de cobrar
// Solo regresa segmentos donde ESTA cuenta comparte con 2+ participantes y
// el porcentaje sigue sin definir. Segmentos de un solo participante NO
// aparecen aquí — cobrarCuenta los resuelve solo en 100%, sin preguntar.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// SEGMENTOS DE TIEMPO DE UNA CUENTA — para mostrar el costo estimado en
// vivo en el panel de cobro, separando lo ya resuelto de lo pendiente.
// El cálculo real (duración exacta al momento de cobrar) sigue viviendo
// en cobrarCuenta — esto es solo para que el cajero vea un número mientras
// consume, no la fuente de verdad del cobro final.
// ─────────────────────────────────────────────────────────────

export async function obtenerSegmentosCuenta(
  eCodCuenta: string
): Promise<
  | {
      segmentos: {
        fkeCodSegmento: string;
        fhInicio: string;
        fhFin: string | null;
        eCostoHora: number;
        ePorcentaje: number | null;
      }[];
    }
  | { error: string }
> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("segmento_cuenta")
    .select("fkeCodSegmento, ePorcentaje, segmentos_tiempo(fhInicio, fhFin, fkeCodConcepto)")
    .eq("fkeCodCuenta", eCodCuenta);

  if (error) return { error: error.message };

  const conceptoIds = [...new Set((data ?? []).map((s: any) => s.segmentos_tiempo?.fkeCodConcepto).filter(Boolean))];
  let costoPorConcepto = new Map<string, number>();
  if (conceptoIds.length > 0) {
    const { data: conceptos } = await adminClient
      .from("conceptos_billar")
      .select("eCodConcepto, eCostoHora")
      .in("eCodConcepto", conceptoIds);
    costoPorConcepto = new Map((conceptos ?? []).map((c) => [c.eCodConcepto, c.eCostoHora]));
  }

  const segmentos = (data ?? []).map((s: any) => ({
    fkeCodSegmento: s.fkeCodSegmento,
    fhInicio:       s.segmentos_tiempo?.fhInicio ?? "",
    fhFin:          s.segmentos_tiempo?.fhFin ?? null,
    eCostoHora:     costoPorConcepto.get(s.segmentos_tiempo?.fkeCodConcepto) ?? 0,
    ePorcentaje:    s.ePorcentaje,
  }));

  return { segmentos };
}

// ─────────────────────────────────────────────────────────────
// SEGMENTOS PENDIENTES DE SPLIT — para pedirle al cajero el % antes de cobrar
// Solo regresa segmentos donde ESTA cuenta comparte con 2+ cuentas ABIERTAS
// y el porcentaje sigue sin definir.
// ─────────────────────────────────────────────────────────────

export async function obtenerSegmentosPendientesSplit(
  eCodCuenta: string
): Promise<
  | {
      segmentos: {
        fkeCodSegmento: string;
        fhInicio: string;
        fhFin: string | null;
        bCerrado: boolean;
        eCostoHora: number;
        otrasCuentas: { eCodCuenta: string; tIdentificador: string }[];
      }[];
    }
  | { error: string }
> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: misSegmentos, error: errMios } = await adminClient
    .from("segmento_cuenta")
    .select("fkeCodSegmento, ePorcentaje, segmentos_tiempo(fhInicio, fhFin, bCerrado, fkeCodConcepto)")
    .eq("fkeCodCuenta", eCodCuenta);

  if (errMios) return { error: errMios.message };

  const segmentosSinDefinir = (misSegmentos ?? []).filter((s: any) => s.ePorcentaje === null);
  if (segmentosSinDefinir.length === 0) return { segmentos: [] };

  const segmentoIds = segmentosSinDefinir.map((s: any) => s.fkeCodSegmento);

  const { data: todasParticipaciones } = await adminClient
    .from("segmento_cuenta")
    .select("fkeCodSegmento, fkeCodCuenta, cuentas(eCodCuenta, tIdentificador, bAbierta)")
    .in("fkeCodSegmento", segmentoIds);

  // Costo por hora de cada concepto involucrado — un solo batch, no una
  // consulta por segmento.
  const conceptoIds = [...new Set(
    segmentosSinDefinir.map((s: any) => s.segmentos_tiempo?.fkeCodConcepto).filter(Boolean)
  )];
  let costoPorConcepto = new Map<string, number>();
  if (conceptoIds.length > 0) {
    const { data: conceptos } = await adminClient
      .from("conceptos_billar")
      .select("eCodConcepto, eCostoHora")
      .in("eCodConcepto", conceptoIds);
    costoPorConcepto = new Map((conceptos ?? []).map((c) => [c.eCodConcepto, c.eCostoHora]));
  }

  const resultado = segmentosSinDefinir
    .map((s: any) => {
      const otras = (todasParticipaciones ?? [])
        .filter((p: any) =>
          p.fkeCodSegmento === s.fkeCodSegmento &&
          p.fkeCodCuenta !== eCodCuenta &&
          p.cuentas?.bAbierta === true // si ya cobró, no cuenta como "compartido pendiente"
        )
        .map((p: any) => ({ eCodCuenta: p.cuentas.eCodCuenta, tIdentificador: p.cuentas.tIdentificador }));

      return {
        fkeCodSegmento: s.fkeCodSegmento,
        fhInicio:       s.segmentos_tiempo?.fhInicio ?? "",
        fhFin:          s.segmentos_tiempo?.fhFin ?? null,
        bCerrado:       s.segmentos_tiempo?.bCerrado ?? false,
        eCostoHora:     costoPorConcepto.get(s.segmentos_tiempo?.fkeCodConcepto) ?? 0,
        otrasCuentas:   otras,
      };
    })
    // Solo segmentos REALMENTE compartidos (2+ cuentas AÚN abiertas) requieren input.
    // Si la otra cuenta ya cobró, este segmento se auto-resuelve a 100% en
    // cobrarCuenta (mismo camino que el caso de un solo participante).
    .filter((s) => s.otrasCuentas.length > 0);

  return { segmentos: resultado };
}

// ─────────────────────────────────────────────────────────────
// COBRAR CUENTA (billar, split A/B)
// A diferencia de cobrarOrdenMesa, cobra una CUENTA específica, no toda
// la orden — puede haber varias cuentas activas en la misma mesa.
// Cierra por tiempo cualquier segmento abierto de esta cuenta (no bloquea
// el cobro si el cliente se va sin avisar). Exige que todo segmento tenga
// ePorcentaje definido — vía `splits`, o ya guardado de antes.
// Delega en crearVenta, igual que cobrarOrdenMesa — nunca reinventa el
// insert de venta/detalle (inventario, IVA, material).
// ─────────────────────────────────────────────────────────────

export async function cobrarCuenta(
  eCodCuenta: string,
  splits: { fkeCodSegmento: string; repartos: { eCodCuenta: string; ePorcentaje: number }[] }[],
  fkeMetodoPago: MetodoPago
): Promise<{ eCodVenta: string } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: cuenta } = await adminClient
    .from("cuentas")
    .select("eCodCuenta, bAbierta, fkeCodCompany")
    .eq("eCodCuenta", eCodCuenta)
    .single();

  if (!cuenta) return { error: "Cuenta no encontrada" };
  if (cuenta.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (!cuenta.bAbierta) return { error: "Esta cuenta ya fue cobrada" };

  // ── 1. Cerrar por tiempo cualquier segmento abierto de esta cuenta ────────
  const { data: segmentosCuenta, error: errSC } = await adminClient
    .from("segmento_cuenta")
    .select("eCodSegmentoCuenta, fkeCodSegmento, ePorcentaje, segmentos_tiempo(bCerrado, fkeCodConcepto, fhInicio, fhFin)")
    .eq("fkeCodCuenta", eCodCuenta);

  if (errSC) return { error: errSC.message };

  const segmentos = segmentosCuenta ?? [];
  const abiertos = segmentos.filter((s: any) => s.segmentos_tiempo?.bCerrado === false);

  if (abiertos.length > 0) {
    const ahora = new Date().toISOString();
    const { error: errCierre } = await adminClient
      .from("segmentos_tiempo")
      .update({ fhFin: ahora, bCerrado: true })
      .in("eCodSegmento", abiertos.map((s: any) => s.fkeCodSegmento));
    if (errCierre) return { error: errCierre.message };
    for (const s of abiertos) (s as any).segmentos_tiempo.fhFin = ahora;
  }

  // ── 2. Exigir porcentaje solo donde hay AMBIGÜEDAD real ────────────────────
  // "Un solo participante" significa una sola cuenta ABIERTA en el segmento
  // — no una sola fila en segmento_cuenta. Las filas no se borran cuando una
  // cuenta cobra (solo cuentas.bAbierta pasa a false), así que contar filas
  // crudas seguiría viendo "2 participantes" aunque el otro ya haya cobrado.
  const segmentoIds = segmentos.map((s: any) => s.fkeCodSegmento);
  const { data: todasParticipaciones } = segmentoIds.length > 0
    ? await adminClient
        .from("segmento_cuenta")
        .select("fkeCodSegmento, cuentas(bAbierta)")
        .in("fkeCodSegmento", segmentoIds)
    : { data: [] as { fkeCodSegmento: string; cuentas: { bAbierta: boolean } | null }[] };

  const conteoPorSegmento = new Map<string, number>();
  for (const p of (todasParticipaciones ?? []) as any[]) {
    if (p.cuentas?.bAbierta !== true) continue; // solo cuentan las que siguen abiertas
    conteoPorSegmento.set(p.fkeCodSegmento, (conteoPorSegmento.get(p.fkeCodSegmento) ?? 0) + 1);
  }

  // Auto-resolver: segmentos con un solo participante ABIERTO (esta misma
  // cuenta) y sin porcentaje aún — incluye tanto el caso "nunca se compartió"
  // como "se compartió pero la otra cuenta ya cobró su parte".
  const autoResueltos = segmentos.filter(
    (s: any) => s.ePorcentaje === null && conteoPorSegmento.get(s.fkeCodSegmento) === 1
  );
  for (const s of autoResueltos as any[]) {
    const { error } = await adminClient
      .from("segmento_cuenta")
      .update({ ePorcentaje: 100 })
      .eq("fkeCodSegmento", s.fkeCodSegmento)
      .eq("fkeCodCuenta", eCodCuenta);
    if (error) return { error: error.message };
    s.ePorcentaje = 100; // reflejar en memoria para el cálculo de abajo
  }

  const faltantes = segmentos.filter(
    (s: any) => s.ePorcentaje === null && !splits.find((sp) => sp.fkeCodSegmento === s.fkeCodSegmento)
  );
  if (faltantes.length > 0) {
    return { error: `Falta definir el porcentaje de ${faltantes.length} segmento(s) antes de cobrar` };
  }

  // ── Aplicar reparto completo por segmento ──────────────────────────────────
  // Con 2 participantes existía un "complemento" derivable de un solo valor.
  // Con N≥3 no hay una única incógnita — quien cobra primero en ese segmento
  // tiene que fijar el % de TODAS las cuentas compartiendo ese tiempo de una
  // sola vez (no solo el propio). `splits[i].repartos` trae esa lista
  // completa; se valida que sume 100 antes de escribir nada.
  for (const split of splits) {
    const sumaRepartos = split.repartos.reduce((acc, r) => acc + r.ePorcentaje, 0);
    if (Math.abs(sumaRepartos - 100) > 0.5) {
      return { error: `El reparto del segmento no suma 100% (suma ${sumaRepartos}%)` };
    }

    for (const reparto of split.repartos) {
      const { error } = await adminClient
        .from("segmento_cuenta")
        .update({ ePorcentaje: reparto.ePorcentaje })
        .eq("fkeCodSegmento", split.fkeCodSegmento)
        .eq("fkeCodCuenta", reparto.eCodCuenta);
      if (error) return { error: error.message };
    }
  }

  // ── 3. Calcular cargo de tiempo, ponderado por el % de ESTA cuenta ────────
  const conceptoIds = [...new Set(segmentos.map((s: any) => s.segmentos_tiempo?.fkeCodConcepto).filter(Boolean))];
  let costoPorConcepto  = new Map<string, number>();
  let nombrePorConcepto = new Map<string, string>();
  if (conceptoIds.length > 0) {
    const { data: conceptos } = await adminClient
      .from("conceptos_billar")
      .select("eCodConcepto, eCostoHora, tNombre")
      .in("eCodConcepto", conceptoIds);
    costoPorConcepto  = new Map((conceptos ?? []).map((c) => [c.eCodConcepto, c.eCostoHora]));
    nombrePorConcepto = new Map((conceptos ?? []).map((c) => [c.eCodConcepto, c.tNombre]));
  }

  const cargoPorConcepto = new Map<string, number>();
  for (const s of segmentos as any[]) {
    const st = s.segmentos_tiempo;
    if (!st) continue;
    const splitDelSegmento = splits.find((sp) => sp.fkeCodSegmento === s.fkeCodSegmento);
    const repartoDeEstaCuenta = splitDelSegmento?.repartos.find((r) => r.eCodCuenta === eCodCuenta);
    const porcentaje = repartoDeEstaCuenta?.ePorcentaje ?? s.ePorcentaje ?? 0;
    const horas = Math.max(0, (new Date(st.fhFin ?? new Date()).getTime() - new Date(st.fhInicio).getTime()) / 3600000);
    const previo = cargoPorConcepto.get(st.fkeCodConcepto) ?? 0;
    cargoPorConcepto.set(st.fkeCodConcepto, previo + horas * (costoPorConcepto.get(st.fkeCodConcepto) ?? 0) * (porcentaje / 100));
  }

  const cargosTiempo = [...cargoPorConcepto.entries()]
    .map(([eCodConcepto, monto]) => ({
      tConcepto: nombrePorConcepto.get(eCodConcepto) ?? "Tiempo",
      eMonto:    Math.round(monto * 100) / 100,
    }))
    .filter((c) => c.eMonto > 0);

  const cargoBillar = cargosTiempo.reduce((acc, c) => acc + c.eMonto, 0);

  // ── 4. Productos de esta cuenta ────────────────────────────────────────────
  const { data: productos, error: errProd } = await adminClient
    .from("cuenta_detalle_producto")
    .select("fkeCodProduct, fkeCodPresentacion, eCantidad, ePrecioUnitario")
    .eq("fkeCodCuenta", eCodCuenta);
  if (errProd) return { error: errProd.message };

  const items = (productos ?? []).map((p) => ({
    eCodProduct:      p.fkeCodProduct,
    eCodPresentacion: p.fkeCodPresentacion ?? undefined,
    cantidad:         p.eCantidad,
    precioUnitario:   p.ePrecioUnitario,
  }));

  if (items.length === 0 && cargoBillar === 0) {
    return { error: "Esta cuenta no tiene consumo que cobrar" };
  }

  // ── 5. Delegar en crearVenta — inventario, IVA y material se manejan ahí ──
  const resultado = await crearVenta(items, fkeMetodoPago, true, cargoBillar);
  if ("error" in resultado) return resultado;

  // ── 6. Cerrar la cuenta ─────────────────────────────────────────────────
  const { error: errCierreCuenta } = await adminClient
    .from("cuentas")
    .update({ bAbierta: false, fhCierre: new Date().toISOString(), fkeCodVentaFinal: resultado.eCodVenta })
    .eq("eCodCuenta", eCodCuenta);

  if (errCierreCuenta) {
    // La venta ya se creó; no hay rollback limpio sin duplicar la lógica de
    // reversa de inventario de cancelarVenta. Estado inconsistente (venta
    // cobrada, cuenta sigue abierta) que requiere corrección manual si pasa.
    return {
      error: `Venta creada (${resultado.eCodVenta}) pero no se pudo cerrar la cuenta: ${errCierreCuenta.message}. Requiere corrección manual.`,
    };
  }

  // ── 7. Cerrar la(s) orden(es), SOLO si ninguna otra cuenta activa sigue
  // ligada a ellas. Necesario porque, con "+ Agregar jugador", una orden de
  // mesa puede tener varias cuentas — cerrar la orden al cobrar solo una
  // dejaría a la otra sin poder seguir consumiendo ni cobrarse después.
  // Se buscan órdenes por DOS caminos: vía segmentos_tiempo (mesas, con
  // tiempo) y vía cuenta_detalle_producto (órdenes fantasma de "Guardar
  // para cuenta" en pedido directo, que no tienen ningún segmento de tiempo).
  const eCodOrdenesUnicos: string[] = [];

  if (segmentos.length > 0) {
    const { data: segmentosConOrden } = await adminClient
      .from("segmentos_tiempo")
      .select("eCodSegmento, fkeCodOrden")
      .in("eCodSegmento", segmentos.map((s: any) => s.fkeCodSegmento));

    for (const so of segmentosConOrden ?? []) {
      eCodOrdenesUnicos.push(so.fkeCodOrden);
    }
  }

  const { data: ordenesDesdeProductos } = await adminClient
    .from("cuenta_detalle_producto")
    .select("fkeCodOrden")
    .eq("fkeCodCuenta", eCodCuenta)
    .not("fkeCodOrden", "is", null);

  for (const p of ordenesDesdeProductos ?? []) {
    if (p.fkeCodOrden) eCodOrdenesUnicos.push(p.fkeCodOrden);
  }

  for (const ordenId of [...new Set(eCodOrdenesUnicos)]) {
    // Para órdenes fantasma (sin segmentos), "quedaAlgunaAbierta" se checa
    // vía las cuentas que tengan cuenta_detalle_producto en esa orden —
    // segmentos_tiempo va a regresar vacío para ellas, lo cual está bien
    // porque el `some(...)` sobre un arreglo vacío da false, y el `some`
    // adicional sobre cuenta_detalle_producto cubre ese caso.
    const [{ data: cuentasRestantesPorTiempo }, { data: cuentasRestantesPorProducto }] = await Promise.all([
      adminClient
        .from("segmentos_tiempo")
        .select("segmento_cuenta(cuentas(bAbierta))")
        .eq("fkeCodOrden", ordenId),
      adminClient
        .from("cuenta_detalle_producto")
        .select("cuentas(bAbierta)")
        .eq("fkeCodOrden", ordenId),
    ]);

    const quedaAlgunaAbiertaPorTiempo = (cuentasRestantesPorTiempo ?? []).some((st: any) =>
      (st.segmento_cuenta ?? []).some((sc: any) => sc.cuentas?.bAbierta === true)
    );
    const quedaAlgunaAbiertaPorProducto = (cuentasRestantesPorProducto ?? []).some(
      (p: any) => p.cuentas?.bAbierta === true
    );

    if (!quedaAlgunaAbiertaPorTiempo && !quedaAlgunaAbiertaPorProducto) {
      await adminClient
        .from("ordenes_mesa")
        .update({
          tEstado:     "cerrada",
          fhCerrada:   new Date().toISOString(),
          fkeCodVenta: resultado.eCodVenta,
        })
        .eq("eCodOrden", ordenId);
    }
  }

  revalidatePath("/empleado/mesas");
  return { eCodVenta: resultado.eCodVenta };
}

// ─────────────────────────────────────────────────────────────
// "+ AGREGAR JUGADOR"
// Cierra el segmento actual POR TIEMPO (fhFin = ahora), pero NO define
// ePorcentaje — el split se sigue resolviendo hasta cobrar, en cobrarCuenta.
// Abre un segmento nuevo con las cuentas previas + la nueva.
// ─────────────────────────────────────────────────────────────

export async function agregarJugador(
  eCodOrden: string,
  eCodCuentaNueva: string
): Promise<{ eCodSegmento: string } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden) return { error: "Orden no encontrada" };
  if (orden.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };

  const { data: cuentaNueva } = await adminClient
    .from("cuentas")
    .select("eCodCuenta, bAbierta, fkeCodCompany")
    .eq("eCodCuenta", eCodCuentaNueva)
    .single();

  if (!cuentaNueva) return { error: "Cuenta no encontrada" };
  if (cuentaNueva.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso a esa cuenta" };
  if (!cuentaNueva.bAbierta) return { error: "Esa cuenta ya fue cobrada" };

  const { data: segmentoActual } = await adminClient
    .from("segmentos_tiempo")
    .select("eCodSegmento, fkeCodConcepto, segmento_cuenta(fkeCodCuenta)")
    .eq("fkeCodOrden", eCodOrden)
    .eq("bCerrado", false)
    .maybeSingle();

  if (!segmentoActual) return { error: "No hay un segmento de tiempo abierto en esta orden" };

  const cuentasPrevias = (segmentoActual.segmento_cuenta ?? []).map((sc: any) => sc.fkeCodCuenta);
  if (cuentasPrevias.includes(eCodCuentaNueva)) {
    return { error: "Esa cuenta ya está jugando en esta mesa" };
  }

  const { error: errCierre } = await adminClient
    .from("segmentos_tiempo")
    .update({ fhFin: new Date().toISOString(), bCerrado: true })
    .eq("eCodSegmento", segmentoActual.eCodSegmento);
  if (errCierre) return { error: errCierre.message };

  const { data: nuevoSegmento, error: errNuevo } = await adminClient
    .from("segmentos_tiempo")
    .insert({
      fkeCodOrden:    eCodOrden,
      fkeCodConcepto: segmentoActual.fkeCodConcepto,
    })
    .select("eCodSegmento")
    .single();

  if (errNuevo || !nuevoSegmento) {
    return { error: `Segmento anterior cerrado pero no se pudo abrir el nuevo: ${errNuevo?.message}` };
  }

  const todasLasCuentas = [...new Set([...cuentasPrevias, eCodCuentaNueva])];
  const filas = todasLasCuentas.map((fkeCodCuenta) => ({
    fkeCodSegmento: nuevoSegmento.eCodSegmento,
    fkeCodCuenta,
    ePorcentaje:    null,
  }));

  const { error: errInsert } = await adminClient.from("segmento_cuenta").insert(filas);
  if (errInsert) return { error: errInsert.message };

  revalidatePath("/empleado/mesas");
  return { eCodSegmento: nuevoSegmento.eCodSegmento };
}

// ─────────────────────────────────────────────────────────────
// "UN JUGADOR SE RETIRA" — espejo de agregarJugador, pero quitando en vez de
// sumando. Cierra el segmento actual por tiempo (el % de la cuenta que se va
// se sigue resolviendo con el mecanismo de split ya existente, no aquí) y
// abre uno nuevo SOLO con las cuentas que se quedan. Sin esto, cobrar a una
// cuenta que comparte segmento con otra corta el tiempo de la que se queda
// también — el mismo incidente de "fa" pero desde la mesa, no bloqueable
// del mismo modo que "Cobrar cuenta existente".
// ─────────────────────────────────────────────────────────────

export async function retirarJugador(
  eCodOrden: string,
  eCodCuentaQueSeVa: string
): Promise<{ eCodSegmentoNuevo: string | null } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden) return { error: "Orden no encontrada" };
  if (orden.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };

  const { data: segmentoActual } = await adminClient
    .from("segmentos_tiempo")
    .select("eCodSegmento, fkeCodConcepto, segmento_cuenta(fkeCodCuenta)")
    .eq("fkeCodOrden", eCodOrden)
    .eq("bCerrado", false)
    .maybeSingle();

  if (!segmentoActual) {
    // No hay segmento abierto — no hay nada que cortar. No es error: puede
    // pasar si ya se usó "Terminar de jugar" antes. El cajero puede cobrar
    // directo sin necesidad de este paso.
    return { eCodSegmentoNuevo: null };
  }

  const cuentasActuales = (segmentoActual.segmento_cuenta ?? []).map((sc: any) => sc.fkeCodCuenta);
  if (!cuentasActuales.includes(eCodCuentaQueSeVa)) {
    return { error: "Esa cuenta no está jugando en el segmento actual" };
  }

  const cuentasQueQuedan = cuentasActuales.filter((c) => c !== eCodCuentaQueSeVa);

  const { error: errCierre } = await adminClient
    .from("segmentos_tiempo")
    .update({ fhFin: new Date().toISOString(), bCerrado: true })
    .eq("eCodSegmento", segmentoActual.eCodSegmento);
  if (errCierre) return { error: errCierre.message };

  // Si nadie más se queda jugando, no hace falta abrir un segmento nuevo —
  // el segmento recién cerrado ya cubre a la única cuenta restante también
  // (si cuentasQueQuedan está vacío, significa que eCodCuentaQueSeVa era la
  // única, y esto se volvió equivalente a "Terminar de jugar").
  if (cuentasQueQuedan.length === 0) {
    revalidatePath("/empleado/mesas");
    return { eCodSegmentoNuevo: null };
  }

  const { data: nuevoSegmento, error: errNuevo } = await adminClient
    .from("segmentos_tiempo")
    .insert({
      fkeCodOrden:    eCodOrden,
      fkeCodConcepto: segmentoActual.fkeCodConcepto,
    })
    .select("eCodSegmento")
    .single();

  if (errNuevo || !nuevoSegmento) {
    return { error: `Segmento anterior cerrado pero no se pudo abrir el nuevo: ${errNuevo?.message}` };
  }

  const filas = cuentasQueQuedan.map((fkeCodCuenta) => ({
    fkeCodSegmento: nuevoSegmento.eCodSegmento,
    fkeCodCuenta,
    ePorcentaje:    null,
  }));

  const { error: errInsert } = await adminClient.from("segmento_cuenta").insert(filas);
  if (errInsert) return { error: errInsert.message };

  revalidatePath("/empleado/mesas");
  return { eCodSegmentoNuevo: nuevoSegmento.eCodSegmento };
}

// ─────────────────────────────────────────────────────────────
// "TERMINAR DE JUGAR" — corta el tiempo SIN cobrar todavía.
// Diferente de agregarJugador: no abre un segmento nuevo, no agrega
// ninguna cuenta. Solo cierra por tiempo el/los segmento(s) abiertos de
// esta orden, para que el timer deje de correr mientras el cajero
// atiende el cobro (que puede tardar minutos si hay fila u otra mesa).
// No resuelve "volver a jugar después de terminar" — no hay acción hoy
// para reabrir un segmento sin agregar una cuenta nueva.
// ─────────────────────────────────────────────────────────────

export async function terminarDeJugar(
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

  if (!orden) return { error: "Orden no encontrada" };
  if (orden.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };

  const { data: segmentosAbiertos } = await adminClient
    .from("segmentos_tiempo")
    .select("eCodSegmento")
    .eq("fkeCodOrden", eCodOrden)
    .eq("bCerrado", false);

  if (!segmentosAbiertos || segmentosAbiertos.length === 0) {
    return { error: "No hay ningún segmento de tiempo corriendo en esta mesa" };
  }

  const { error } = await adminClient
    .from("segmentos_tiempo")
    .update({ fhFin: new Date().toISOString(), bCerrado: true })
    .in("eCodSegmento", segmentosAbiertos.map((s) => s.eCodSegmento));

  if (error) return { error: error.message };

  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// "REABRIR SEGMENTO" — corrige un cierre por error ("Terminar de jugar" o
// "Un jugador se retira" apretado sin querer). Dos restricciones no
// negociables, o se corrompe el resto del sistema:
//   1. Solo el segmento MÁS RECIENTE de la orden — reabrir uno viejo dejaría
//      dos segmentos "corriendo" a la vez, rompiendo la suposición de "uno
//      activo a la vez" que usa todo el cálculo de tiempo/costo.
//   2. Solo si NINGÚN participante ya tiene ePorcentaje definido — si alguien
//      ya cobró su parte de ese segmento, reabrirlo desincroniza el cobro ya
//      hecho del tiempo que seguiría corriendo.
// No recupera el tiempo transcurrido mientras estuvo cerrado por error — el
// segmento retoma desde AHORA, no desde que se cerró. Limitación aceptada,
// no un bug: para exactitud total se requiere ajuste manual de fechas en SQL.
// ─────────────────────────────────────────────────────────────

export async function reabrirSegmento(
  eCodOrden: string,
  eCodSegmento: string
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden) return { error: "Orden no encontrada" };
  if (orden.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };

  const { data: masReciente } = await adminClient
    .from("segmentos_tiempo")
    .select("eCodSegmento, bCerrado")
    .eq("fkeCodOrden", eCodOrden)
    .order("fhInicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!masReciente || masReciente.eCodSegmento !== eCodSegmento) {
    return { error: "Solo se puede reabrir el segmento más reciente de la mesa, no uno anterior" };
  }
  if (!masReciente.bCerrado) {
    return { error: "Este segmento ya está corriendo, no hay nada que reabrir" };
  }

  const { data: participaciones } = await adminClient
    .from("segmento_cuenta")
    .select("ePorcentaje")
    .eq("fkeCodSegmento", eCodSegmento);

  const yaResuelto = (participaciones ?? []).some((p) => p.ePorcentaje !== null);
  if (yaResuelto) {
    return { error: "No se puede reabrir: ya se definió un reparto para este segmento (alguien ya cobró su parte)" };
  }

  const { error } = await adminClient
    .from("segmentos_tiempo")
    .update({ bCerrado: false, fhFin: null })
    .eq("eCodSegmento", eCodSegmento);

  if (error) return { error: error.message };

  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// "LIBERAR MESA" — el jugador se fue sin pagar, pero el negocio necesita la
// mesa libre para otro cliente. La deuda de la cuenta NO se pierde: la orden
// se desvincula de la mesa física (fkeCodMesa = null, igual que una orden
// fantasma de pedido directo) mientras conserva su tiempo y productos, para
// cobrarse después vía "Cobrar cuenta existente".
//
// Requiere que NINGÚN segmento de esta orden siga corriendo — si alguien
// sigue jugando, liberar la mesa cortaría su tiempo sin avisar. Hay que usar
// "Terminar de jugar" (o que ya no quede nadie tras "Un jugador se retira")
// antes de poder liberar.
// ─────────────────────────────────────────────────────────────

export async function liberarMesa(
  eCodOrden: string
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany, tEstado, fkeCodMesa")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden) return { error: "Orden no encontrada" };
  if (orden.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (orden.tEstado !== "abierta") return { error: "La orden ya no está abierta" };
  if (!orden.fkeCodMesa) return { error: "Esta orden ya no tiene mesa asignada" };

  const { data: segmentosAbiertos } = await adminClient
    .from("segmentos_tiempo")
    .select("eCodSegmento")
    .eq("fkeCodOrden", eCodOrden)
    .eq("bCerrado", false);

  if (segmentosAbiertos && segmentosAbiertos.length > 0) {
    return { error: "Todavía hay tiempo corriendo en esta mesa — usa \"Terminar de jugar\" antes de liberarla" };
  }

  const { error } = await adminClient
    .from("ordenes_mesa")
    .update({ fkeCodMesa: null })
    .eq("eCodOrden", eCodOrden);

  if (error) return { error: error.message };

  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// PEDIDO DIRECTO → "GUARDAR PARA CUENTA"
// Crea (o reutiliza) una orden "fantasma" SIN mesa (fkeCodMesa = null) —
// existe solo para que agregar_item_orden_con_cuenta tenga un fkeCodOrden
// al cual atar los items en ordenes_mesa_detalle, para que cocina los vea
// igual que si vinieran de una mesa. Requiere la migración que quita el
// NOT NULL de ordenes_mesa.fkeCodMesa.
// Todo-o-nada por carrito: o se cobra normal (crearVenta directo, como
// siempre), o el carrito completo se guarda para una cuenta.
// El inventario NO se descuenta aquí — se descuenta hasta cobrarCuenta.
// ─────────────────────────────────────────────────────────────

export async function guardarCarritoParaCuenta(
  eCodCuenta: string,
  items: { eCodProduct: string; eCodPresentacion?: string; cantidad: number; precioUnitario: number }[]
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return { error: "No autenticado" };
  if (items.length === 0) return { error: "El carrito está vacío" };

  const adminClient = createAdminClient();

  const { data: cuenta } = await adminClient
    .from("cuentas")
    .select("fkeCodCompany, fkeCodSucursal, bAbierta")
    .eq("eCodCuenta", eCodCuenta)
    .single();

  if (!cuenta || cuenta.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso a esa cuenta" };
  if (!cuenta.bAbierta) return { error: "Esa cuenta ya fue cobrada" };

  // ── Reutilizar una orden fantasma existente de esta cuenta, si ya hay una ──
  // (ej. el cajero guarda un pedido directo dos veces para la misma cuenta
  // antes de que se cobre, o la cuenta también tiene consumo de una mesa real
  // mezclado). Se busca explícitamente una orden con fkeCodMesa NULL — antes
  // esto se adivinaba con .limit(1) sin order by, lo cual podía regresar la
  // orden de MESA (si la cuenta tenía consumo mixto) y crear una orden
  // fantasma duplicada por error en vez de reutilizar la correcta.
  const { data: detalleConOrdenes } = await adminClient
    .from("cuenta_detalle_producto")
    .select("fkeCodOrden, ordenes_mesa(fkeCodMesa, tEstado)")
    .eq("fkeCodCuenta", eCodCuenta)
    .not("fkeCodOrden", "is", null);

  let eCodOrdenFantasma: string | null = null;

  for (const d of detalleConOrdenes ?? []) {
    const orden = (d as any).ordenes_mesa;
    if (orden && orden.fkeCodMesa === null && orden.tEstado === "abierta") {
      eCodOrdenFantasma = d.fkeCodOrden as string;
      break;
    }
  }

  if (!eCodOrdenFantasma) {
    const { data: ordenNueva, error: errOrden } = await adminClient
      .from("ordenes_mesa")
      .insert({
        fkeCodMesa:     null,
        fkeCodCompany:  perfil.fkeCodCompany,
        fkeCodSucursal: cuenta.fkeCodSucursal,
        fkeCodUser:     perfil.uid,
        tEstado:        "abierta",
        fhAbierta:      new Date().toISOString(),
      })
      .select("eCodOrden")
      .single();

    if (errOrden || !ordenNueva) return { error: `No se pudo crear la orden: ${errOrden?.message}` };
    eCodOrdenFantasma = ordenNueva.eCodOrden;
  }

  for (const item of items) {
    const { data: producto } = await adminClient
      .from("productos")
      .select("bCocina")
      .eq("eCodProduct", item.eCodProduct)
      .single();

    const { error: errRpc } = await adminClient.rpc("agregar_item_orden_con_cuenta", {
      p_ecodorden:        eCodOrdenFantasma,
      p_ecodcuenta:       eCodCuenta,
      p_ecodproduct:      item.eCodProduct,
      p_ecodpresentacion: item.eCodPresentacion ?? null,
      p_ecantidad:        item.cantidad,
      p_eprecio:          item.precioUnitario,
      p_escocina:         producto?.bCocina === true,
    });

    if (errRpc) return { error: `Error al guardar producto: ${errRpc.message}` };
  }

  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// CONSUMO DE UNA CUENTA (billar) — para el panel de cobro
// A diferencia de obtenerOrdenAbierta.detalle (todo lo de la mesa, para
// cocina), esto trae SOLO lo atribuido a esta cuenta específica.
// ─────────────────────────────────────────────────────────────

export async function obtenerConsumoCuenta(
  eCodCuenta: string
): Promise<{ items: OrdenMesaDetalleConProducto[]; eTotal: number } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: cuenta } = await adminClient
    .from("cuentas")
    .select("fkeCodCompany")
    .eq("eCodCuenta", eCodCuenta)
    .single();

  if (!cuenta || cuenta.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };

  const { data: detalle } = await adminClient
    .from("cuenta_detalle_producto")
    .select("eCodDetalle, fkeCodProduct, fkeCodPresentacion, eCantidad, ePrecioUnitario, fhAgregado, fkeCodOrden")
    .eq("fkeCodCuenta", eCodCuenta)
    .order("fhAgregado");

  if (!detalle?.length) return { items: [], eTotal: 0 };

  const productIds      = [...new Set(detalle.map((d) => d.fkeCodProduct))];
  const presentacionIds = [...new Set(detalle.map((d) => d.fkeCodPresentacion).filter(Boolean))] as string[];

  const [productosRes, presentacionesRes] = await Promise.all([
    adminClient.from("productos").select("eCodProduct, tNameProduct, ImgProduct").in("eCodProduct", productIds),
    presentacionIds.length > 0
      ? adminClient.from("presentaciones").select("eCodPresentacion, tNombre").in("eCodPresentacion", presentacionIds)
      : Promise.resolve({ data: [] }),
  ]);

  const productosMap      = new Map((productosRes.data ?? []).map((p) => [p.eCodProduct, p]));
  const presentacionesMap = new Map((presentacionesRes.data ?? []).map((p) => [p.eCodPresentacion, p]));

  const items: OrdenMesaDetalleConProducto[] = detalle.map((d) => ({
    eCodDetalle:        d.eCodDetalle,
    fkeCodOrden:        d.fkeCodOrden ?? "", // puede ser null si el registro es viejo, previo a este fix
    fkeCodProduct:      d.fkeCodProduct,
    fkeCodPresentacion: d.fkeCodPresentacion,
    eCantidad:          d.eCantidad,
    ePrecio:            d.ePrecioUnitario,
    fhAgregado:         d.fhAgregado,
    producto:     productosMap.get(d.fkeCodProduct) ?? null,
    presentacion: d.fkeCodPresentacion ? (presentacionesMap.get(d.fkeCodPresentacion) ?? null) : null,
  }));

  const eTotal = items.reduce((acc, i) => acc + i.ePrecio * i.eCantidad, 0);

  return { items, eTotal };
}

/**
 * Cambia cantidad en ambas tablas (ordenes_mesa_detalle + cuenta_detalle_producto)
 * vía RPC atómica, referenciado por producto — no por eCodDetalle, porque las
 * dos tablas tienen IDs independientes y NO corresponden 1:1 fila a fila.
 */
export async function actualizarCantidadItemCuenta(
  eCodOrden: string,
  eCodCuenta: string,
  eCodProduct: string,
  eCodPresentacion: string | null | undefined,
  eCantidad: number
): Promise<{ ok: true } | { error: string }> {
  if (eCantidad < 1) return { error: "La cantidad mínima es 1" };

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

  const { error } = await adminClient.rpc("actualizar_cantidad_item_cuenta", {
    p_ecodorden:        eCodOrden,
    p_ecodcuenta:       eCodCuenta,
    p_ecodproduct:      eCodProduct,
    p_ecodpresentacion: eCodPresentacion ?? null,
    p_ecantidad:        eCantidad,
  });

  if (error) return { error: `Error al actualizar: ${error.message}` };

  revalidatePath("/empleado/mesas");
  return { ok: true };
}

/** Elimina de ambas tablas, referenciado por producto — mismo motivo que arriba. */
export async function eliminarItemCuenta(
  eCodOrden: string,
  eCodCuenta: string,
  eCodProduct: string,
  eCodPresentacion: string | null | undefined
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

  const { error } = await adminClient.rpc("eliminar_item_cuenta", {
    p_ecodorden:        eCodOrden,
    p_ecodcuenta:       eCodCuenta,
    p_ecodproduct:      eCodProduct,
    p_ecodpresentacion: eCodPresentacion ?? null,
  });

  if (error) return { error: `Error al eliminar: ${error.message}` };

  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// MÓDULO COCINA: OBTENER ITEMS LISTOS PARA ENTREGAR
// Usada por el modal de entrega en el POS
// ─────────────────────────────────────────────────────────────

export async function obtenerItemsListos(
  eCodOrden: string
): Promise<ItemListoCocina[]> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return [];

  const adminClient = createAdminClient();

  // Verificar acceso
  const { data: orden } = await adminClient
    .from("ordenes_mesa")
    .select("fkeCodCompany")
    .eq("eCodOrden", eCodOrden)
    .single();

  if (!orden || orden.fkeCodCompany !== perfil.fkeCodCompany) return [];

  const { data: detalles } = await adminClient
    .from("ordenes_mesa_detalle")
    .select("eCodDetalle, fkeCodProduct, fkeCodPresentacion, eCantidad, fhAgregado")
    .eq("fkeCodOrden", eCodOrden)
    .eq("tEstadoCocina", "listo")
    .order("fhAgregado");

  if (!detalles?.length) return [];

  const productIds      = [...new Set(detalles.map((d) => d.fkeCodProduct))];
  const presentacionIds = detalles
    .filter((d) => d.fkeCodPresentacion)
    .map((d) => d.fkeCodPresentacion as string);

  const [productosRes, presentacionesRes] = await Promise.all([
    adminClient
      .from("productos")
      .select("eCodProduct, tNameProduct")
      .in("eCodProduct", productIds),
    presentacionIds.length > 0
      ? adminClient
          .from("presentaciones")
          .select("eCodPresentacion, tNombre")
          .in("eCodPresentacion", [...new Set(presentacionIds)])
      : Promise.resolve({ data: [] }),
  ]);

  const productosMap     = new Map((productosRes.data     ?? []).map((p) => [p.eCodProduct,      p.tNameProduct]));
  const presentacionesMap = new Map((presentacionesRes.data ?? []).map((p) => [p.eCodPresentacion, p.tNombre]));

  return detalles.map((d) => ({
    eCodDetalle:         d.eCodDetalle,
    tNameProduct:        productosMap.get(d.fkeCodProduct) ?? "Producto",
    tNombrePresentacion: d.fkeCodPresentacion
      ? (presentacionesMap.get(d.fkeCodPresentacion) ?? null)
      : null,
    eCantidad:  d.eCantidad,
    fhAgregado: d.fhAgregado,
  }));
}

// ─────────────────────────────────────────────────────────────
// MÓDULO COCINA: MARCAR ITEM COMO ENTREGADO
// Llamada por el empleado desde el modal de entrega en el POS
// ─────────────────────────────────────────────────────────────

export async function marcarItemEntregado(
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
    .update({ tEstadoCocina: "entregado" })
    .eq("eCodDetalle", eCodDetalle)
    .eq("tEstadoCocina", "listo"); // guard: solo si sigue listo

  if (error) return { error: error.message };

  revalidatePath("/empleado/mesas");
  return { ok: true };
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
      fkeCodSucursal: ctx.fkeCodSucursal,
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
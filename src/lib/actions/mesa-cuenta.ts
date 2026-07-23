"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Abre una mesa atada a una cuenta (ya existente o recién creada).
 * Mantiene el guard existente: la mesa debe tener concepto asignado.
 * Crea el primer segmento de tiempo con la cuenta al 100% (ePorcentaje
 * se deja NULL a propósito — se define hasta el cobro, no aquí).
 */
export async function abrirMesaConCuenta(
  fkeCodMesa: string,
  fkeCodCuenta: string,
  fkeCodUser: string,
  fkeCodCompany: string,
  fkeCodSucursal: string
) {
  const supabase = createAdminClient();

  const { data: mesa, error: errMesa } = await supabase
    .from("mesas")
    .select("eCodMesa, fkeCodConcepto")
    .eq("eCodMesa", fkeCodMesa)
    .single();

  if (errMesa || !mesa) return { error: "Mesa no encontrada" };
  if (!mesa.fkeCodConcepto) {
    return { error: "La mesa no tiene un concepto de cobro asignado" };
  }

  const { data: orden, error: errOrden } = await supabase
    .from("ordenes_mesa")
    .insert({
      fkeCodMesa,
      fkeCodCompany,
      fkeCodUser,
      fkeCodSucursal,
      tEstado: "abierta",
    })
    .select("eCodOrden")
    .single();

  if (errOrden || !orden) return { error: errOrden?.message ?? "No se pudo abrir la orden" };

  const { data: segmento, error: errSeg } = await supabase
    .from("segmentos_tiempo")
    .insert({
      fkeCodOrden: orden.eCodOrden,
      fkeCodConcepto: mesa.fkeCodConcepto,
    })
    .select("eCodSegmento")
    .single();

  if (errSeg || !segmento) return { error: errSeg?.message ?? "No se pudo crear el segmento" };

  const { error: errSC } = await supabase.from("segmento_cuenta").insert({
    fkeCodSegmento: segmento.eCodSegmento,
    fkeCodCuenta,
    ePorcentaje: null, // se define al cerrar el segmento o al cobrar
  });

  if (errSC) return { error: errSC.message };

  return { eCodOrden: orden.eCodOrden, eCodSegmento: segmento.eCodSegmento };
}

/**
 * "+ Agregar jugador": cierra el segmento actual (por tiempo, NO por
 * porcentaje — el split se sigue definiendo hasta el cobro) y abre uno
 * nuevo con las cuentas anteriores + la nueva.
 *
 * fkeCodCuenta puede ser una cuenta existente (seleccionada tras
 * buscarCuentasAbiertas) o el resultado de crearCuenta si es alguien nuevo.
 */
export async function agregarJugador(fkeCodOrden: string, fkeCodCuentaNueva: string) {
  const supabase = createAdminClient();

  const { data: segmentoActual, error: errActual } = await supabase
    .from("segmentos_tiempo")
    .select("eCodSegmento, fkeCodConcepto, segmento_cuenta(fkeCodCuenta)")
    .eq("fkeCodOrden", fkeCodOrden)
    .eq("bCerrado", false)
    .single();

  if (errActual || !segmentoActual) {
    return { error: "No hay un segmento abierto para esta orden" };
  }

  const { error: errCierre } = await supabase
    .from("segmentos_tiempo")
    .update({ fhFin: new Date().toISOString(), bCerrado: true })
    .eq("eCodSegmento", segmentoActual.eCodSegmento);

  if (errCierre) return { error: errCierre.message };

  const { data: nuevoSegmento, error: errNuevo } = await supabase
    .from("segmentos_tiempo")
    .insert({
      fkeCodOrden,
      fkeCodConcepto: segmentoActual.fkeCodConcepto,
    })
    .select("eCodSegmento")
    .single();

  if (errNuevo || !nuevoSegmento) return { error: errNuevo?.message ?? "No se pudo abrir el nuevo segmento" };

  const cuentasPrevias = (segmentoActual.segmento_cuenta ?? []).map((sc: any) => sc.fkeCodCuenta);
  const todasLasCuentas = [...new Set([...cuentasPrevias, fkeCodCuentaNueva])];

  const filas = todasLasCuentas.map((fkeCodCuenta) => ({
    fkeCodSegmento: nuevoSegmento.eCodSegmento,
    fkeCodCuenta,
    ePorcentaje: null,
  }));

  const { error: errInsert } = await supabase.from("segmento_cuenta").insert(filas);
  if (errInsert) return { error: errInsert.message };

  return { eCodSegmento: nuevoSegmento.eCodSegmento, cuentas: todasLasCuentas };
}
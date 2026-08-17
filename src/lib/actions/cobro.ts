"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { crearVenta }        from "@/lib/actions/ventas";
import type { MetodoPago }   from "@/types";

type SplitInput = { fkeCodSegmento: string; ePorcentaje: number };

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

/**
 * Cobra una cuenta delegando en crearVenta — NO reinventa el insert de
 * ventas/detalle_venta. Esto es corrección de una versión anterior de esta
 * función que insertaba directo y se saltaba inventario, IVA, y descuento
 * de material. No repetir ese error.
 */
export async function cobrarCuenta(
  eCodCuenta: string,
  splits: SplitInput[],
  fkeMetodoPago: MetodoPago
): Promise<{ eCodVenta: string } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data: cuenta } = await adminClient
    .from("cuentas")
    .select("eCodCuenta, bAbierta, fkeCodCompany, fkeCodSucursal")
    .eq("eCodCuenta", eCodCuenta)
    .single();

  if (!cuenta) return { error: "Cuenta no encontrada" };
  if (cuenta.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (!cuenta.bAbierta) return { error: "Esta cuenta ya fue cobrada" };

  // 1. Cerrar por tiempo cualquier segmento abierto donde participe esta cuenta
  const { data: segmentosCuenta, error: errSC } = await adminClient
    .from("segmento_cuenta")
    .select(
      "eCodSegmentoCuenta, fkeCodSegmento, ePorcentaje, segmentos_tiempo(bCerrado, fkeCodConcepto, fhInicio, fhFin)"
    )
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

  // 2. Exigir split para todo segmento con ePorcentaje NULL que no venga en `splits`
  const faltantes = segmentos.filter(
    (s: any) => s.ePorcentaje === null && !splits.find((sp) => sp.fkeCodSegmento === s.fkeCodSegmento)
  );
  if (faltantes.length > 0) {
    return { error: `Falta definir el porcentaje de ${faltantes.length} segmento(s) antes de cobrar` };
  }

  for (const split of splits) {
    const { error } = await adminClient
      .from("segmento_cuenta")
      .update({ ePorcentaje: split.ePorcentaje })
      .eq("fkeCodSegmento", split.fkeCodSegmento)
      .eq("fkeCodCuenta", eCodCuenta);
    if (error) return { error: error.message };
  }

  // 3. Calcular cargo de tiempo (equivalente al `cargoBillar` de cobrarOrdenMesa,
  //    pero por segmento y ponderado por el porcentaje de esta cuenta)
  const conceptoIds = [...new Set(segmentos.map((s: any) => s.segmentos_tiempo?.fkeCodConcepto).filter(Boolean))];
  let costoPorConcepto  = new Map<string, number>();
  let nombrePorConcepto = new Map<string, string>();
  if (conceptoIds.length > 0) {
    const { data: conceptos, error: errConceptos } = await adminClient
      .from("conceptos_billar")
      .select("eCodConcepto, eCostoHora, tNombre")
      .in("eCodConcepto", conceptoIds);
    if (errConceptos) return { error: errConceptos.message };
    costoPorConcepto  = new Map((conceptos ?? []).map((c) => [c.eCodConcepto, c.eCostoHora]));
    nombrePorConcepto = new Map((conceptos ?? []).map((c) => [c.eCodConcepto, c.tNombre]));
  }

  const cargoPorConcepto = new Map<string, number>();
  for (const s of segmentos as any[]) {
    const st = s.segmentos_tiempo;
    if (!st) continue;
    const porcentaje = splits.find((sp) => sp.fkeCodSegmento === s.fkeCodSegmento)?.ePorcentaje ?? s.ePorcentaje ?? 0;
    const inicio = new Date(st.fhInicio).getTime();
    const fin = new Date(st.fhFin ?? new Date()).getTime();
    const horas = Math.max(0, (fin - inicio) / 1000 / 3600);
    const costoHora = costoPorConcepto.get(st.fkeCodConcepto) ?? 0;
    const previo = cargoPorConcepto.get(st.fkeCodConcepto) ?? 0;
    cargoPorConcepto.set(st.fkeCodConcepto, previo + horas * costoHora * (porcentaje / 100));
  }

  const cargosTiempo = [...cargoPorConcepto.entries()]
    .map(([eCodConcepto, monto]) => ({
      tConcepto: nombrePorConcepto.get(eCodConcepto) ?? "Tiempo",
      eMonto:    Math.round(monto * 100) / 100,
    }))
    .filter((c) => c.eMonto > 0);

  const cargoBillar = cargosTiempo.reduce((acc, c) => acc + c.eMonto, 0);

  // 4. Productos de esta cuenta -> mismo formato ItemVenta que espera crearVenta
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

  // 5. Delegar en crearVenta — aquí se valida/descuenta inventario, se aplica
  //    IVA, y se maneja material. No se reimplementa nada de eso aquí.
  const resultado = await crearVenta(items, fkeMetodoPago, true, cargosTiempo);
  if ("error" in resultado) return resultado;

  // 6. Cerrar la cuenta
  const { error: errCierreCuenta } = await adminClient
    .from("cuentas")
    .update({
      bAbierta: false,
      fhCierre: new Date().toISOString(),
      fkeCodVentaFinal: resultado.eCodVenta,
    })
    .eq("eCodCuenta", eCodCuenta);

  if (errCierreCuenta) {
    // La venta ya se creó — no hay rollback limpio aquí sin duplicar la
    // lógica de reversa de inventario de cancelarVenta. Estado inconsistente
    // (venta cobrada, cuenta sigue "abierta") que requiere corrección manual
    // si pasa. Se deja explícito, no se esconde.
    return {
      error: `Venta creada (${resultado.eCodVenta}) pero no se pudo cerrar la cuenta: ${errCierreCuenta.message}. Requiere corrección manual.`,
    };
  }

  return { eCodVenta: resultado.eCodVenta };
}
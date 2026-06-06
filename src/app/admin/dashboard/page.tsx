import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DashboardClient,
  type TurnoActivo,
  type CorteConEmpleadoDash,
  type DesglosePago,
  type TendenciaDia,
  type TopProducto,
} from "./DasboardClient";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";

export default async function DashboardPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  // ── Auth ───────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user.id)
    .single();

  const fkeCodCompany = perfil?.fkeCodCompany;
  if (!fkeCodCompany) return null;

  // ── Rangos de fecha (UTC) ──────────────────────────────────────────────────
  const ahora  = new Date();
  const pad    = (n: number) => String(n).padStart(2, "0");

  // Hoy (inicio UTC)
  const hoyStr    = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}`;
  const inicioDia = `${hoyStr}T00:00:00.000Z`;

  // Ayer (inicio hasta hoy)
  const ayerDate  = new Date(ahora);
  ayerDate.setDate(ayerDate.getDate() - 1);
  const ayerStr   = `${ayerDate.getFullYear()}-${pad(ayerDate.getMonth() + 1)}-${pad(ayerDate.getDate())}`;
  const inicioAyer = `${ayerStr}T00:00:00.000Z`;

  // 6 días atrás (7 días totales incluyendo hoy)
  const d6    = new Date(ahora);
  d6.setDate(d6.getDate() - 6);
  const hace6D = `${d6.getFullYear()}-${pad(d6.getMonth() + 1)}-${pad(d6.getDate())}T00:00:00.000Z`;

  // ── Batch 1: queries independientes en paralelo ────────────────────────────
  const [
    { data: ventasHoyRaw },
    { data: ventasAyerRaw },
    { data: ventas7DiasRaw },
    { data: turnosAbiertosRaw },
    { data: cortesPendientesRaw },
    { data: inventarioRaw },
    { data: negocioRaw },
  ] = await Promise.all([
    // Ventas de hoy
    adminClient
      .from("ventas")
      .select("eCodVenta, eTotal, fkeMetodoPago, fhCreateVenta, fkeCodUser")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bCancelada", false)
      .gte("fhCreateVenta", inicioDia),

    // Ventas de ayer (para comparación de tendencia)
    adminClient
      .from("ventas")
      .select("eTotal, fkeMetodoPago")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bCancelada", false)
      .gte("fhCreateVenta", inicioAyer)
      .lt("fhCreateVenta", inicioDia),

    // Ventas 7 días (para gráfica)
    adminClient
      .from("ventas")
      .select("eTotal, fhCreateVenta")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bCancelada", false)
      .gte("fhCreateVenta", hace6D)
      .order("fhCreateVenta", { ascending: true }),

    // Turnos abiertos
    adminClient
      .from("cortes_caja")
      .select("*")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bStateCorte", "abierto"),

    // Cortes pendientes de revisión
    adminClient
      .from("cortes_caja")
      .select("eCodCorte, fkeCodUser, tNombreTurno, fhCierreTurno, eDiferencia, bStateCorte")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bStateCorte", "pendiente")
      .order("fhCierreTurno", { ascending: false })
      .limit(5),

    // Inventario activo (sin ilimitados)
    adminClient
      .from("vista_inventario")
      .select("fkeCodProduct, eCantRestante, eStockMinimo, bUnlimitedInventory, bStateInventory")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bStateInventory", true)
      .eq("bUnlimitedInventory", false),

    // Nombre del negocio
    adminClient
      .from("negocios")
      .select("tNameCompany")
      .eq("eCodCompany", fkeCodCompany)
      .single(),
  ]);

  const ventasHoy      = ventasHoyRaw      ?? [];
  const ventasAyer     = ventasAyerRaw     ?? [];
  const ventas7Dias    = ventas7DiasRaw    ?? [];
  const turnosAbiertos = turnosAbiertosRaw ?? [];
  const cortesPend     = cortesPendientesRaw ?? [];
  const inventario     = inventarioRaw     ?? [];

  // ── Batch 2: queries que dependen del batch 1 ─────────────────────────────
  const metodosIds        = [...new Set([
    ...ventasHoy.map((v) => v.fkeMetodoPago),
    ...ventasAyer.map((v) => v.fkeMetodoPago),
  ])];
  const empleadosTurnoIds = [...new Set(turnosAbiertos.map((t) => t.fkeCodUser))];
  const empleadosPendIds  = [...new Set(cortesPend.map((c) => c.fkeCodUser))];
  const idsProductosInv   = [...new Set(inventario.map((i) => i.fkeCodProduct))];

  const [
    { data: metodosRaw },
    { data: perfilesTurnosRaw },
    { data: perfilesPendRaw },
    { data: productosActivosRaw },
  ] = await Promise.all([
    metodosIds.length > 0
      ? adminClient
          .from("metodos_pago")
          .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay")
          .in("eCodPay", metodosIds)
      : Promise.resolve({ data: [] }),

    empleadosTurnoIds.length > 0
      ? adminClient
          .from("perfiles")
          .select("eCodUser, tNameUser")
          .in("eCodUser", empleadosTurnoIds)
      : Promise.resolve({ data: [] }),

    empleadosPendIds.length > 0
      ? adminClient
          .from("perfiles")
          .select("eCodUser, tNameUser")
          .in("eCodUser", empleadosPendIds)
      : Promise.resolve({ data: [] }),

    idsProductosInv.length > 0
      ? adminClient
          .from("productos")
          .select("eCodProduct, bStateProduct")
          .in("eCodProduct", idsProductosInv)
          .eq("bStateProduct", true)
      : Promise.resolve({ data: [] }),
  ]);

  const metodosPago      = (metodosRaw as MetodoPagoGlobal[]) ?? [];
  const perfilesTurnos   = perfilesTurnosRaw ?? [];
  const perfilesPend     = perfilesPendRaw   ?? [];
  const productosActivos = new Set((productosActivosRaw ?? []).map((p: any) => p.eCodProduct));

  // ── Map de método → nombre normalizado ────────────────────────────────────
  const metodosMap = new Map(
    metodosPago.map((m) => [m.eCodPay, m.tNamePay.toLowerCase()])
  );
  const esEfectivo = (id: string) => (metodosMap.get(id) ?? "").includes("efectivo");

  // ── KPIs de hoy ───────────────────────────────────────────────────────────
  const totalHoy     = ventasHoy.reduce((acc, v) => acc + v.eTotal, 0);
  const numVentas    = ventasHoy.length;
  const ticketProm   = numVentas > 0 ? totalHoy / numVentas : 0;
  const efectivoHoy  = ventasHoy
    .filter((v) => esEfectivo(v.fkeMetodoPago))
    .reduce((acc, v) => acc + v.eTotal, 0);

  // KPIs de ayer (para comparación)
  const totalAyer     = ventasAyer.reduce((acc, v) => acc + v.eTotal, 0);
  const numVentasAyer = ventasAyer.length;

  // ── Desglose de métodos de pago ───────────────────────────────────────────
  const gruposPorMetodo = new Map<string, number>();
  for (const v of ventasHoy) {
    gruposPorMetodo.set(v.fkeMetodoPago, (gruposPorMetodo.get(v.fkeMetodoPago) ?? 0) + v.eTotal);
  }

  const desglosePagos: DesglosePago[] = [];
  for (const [eCodPay, total] of gruposPorMetodo) {
    const metodo = metodosPago.find((m) => m.eCodPay === eCodPay);
    desglosePagos.push({
      eCodPay,
      nombre:     metodo?.tNamePay ?? "Otro",
      icono:      metodo?.tIconPay ?? "CreditCard",
      total,
      porcentaje: totalHoy > 0 ? (total / totalHoy) * 100 : 0,
    });
  }
  desglosePagos.sort((a, b) => b.total - a.total);

  // ── Tendencia 7 días ──────────────────────────────────────────────────────
  const diasLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const tendencia: TendenciaDia[] = [];

  for (let i = 6; i >= 0; i--) {
    const d    = new Date(ahora);
    d.setDate(d.getDate() - i);
    const ds   = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const total = ventas7Dias
      .filter((v) => v.fhCreateVenta.startsWith(ds))
      .reduce((acc, v) => acc + v.eTotal, 0);

    tendencia.push({
      label:  i === 0 ? "Hoy" : diasLabels[d.getDay()],
      total,
      esHoy:  i === 0,
      fecha:  ds,
    });
  }

  // ── Turnos activos con datos de ventas ────────────────────────────────────
  const turnosConDatos: TurnoActivo[] = turnosAbiertos.map((turno: any) => {
    const empleado = perfilesTurnos.find((p: any) => p.eCodUser === turno.fkeCodUser) ?? null;

    // Ventas de este empleado desde que abrió su turno
    const ventasTurno = ventasHoy.filter(
      (v) =>
        v.fkeCodUser === turno.fkeCodUser &&
        v.fhCreateVenta >= turno.fhInicioTurno
    );

    return {
      eCodCorte:     turno.eCodCorte,
      fkeCodUser:    turno.fkeCodUser,
      tNombreTurno:  turno.tNombreTurno ?? null,
      fhInicioTurno: turno.fhInicioTurno,
      eFondoInicial: turno.eFondoInicial ?? 0,
      bStateCorte:   turno.bStateCorte,
      empleado:      empleado as TurnoActivo["empleado"],
      ventasTurno: {
        total: ventasTurno.reduce((acc, v) => acc + v.eTotal, 0),
        count: ventasTurno.length,
      },
    };
  });

  // ── Cortes pendientes con nombres ─────────────────────────────────────────
  const cortesPendientes: CorteConEmpleadoDash[] = cortesPend.map((c: any) => ({
    eCodCorte:     c.eCodCorte,
    fkeCodUser:    c.fkeCodUser,
    tNombreTurno:  c.tNombreTurno ?? null,
    fhCierreTurno: c.fhCierreTurno ?? null,
    eDiferencia:   c.eDiferencia   ?? null,
    bStateCorte:   c.bStateCorte,
    empleado:      perfilesPend.find((p: any) => p.eCodUser === c.fkeCodUser) ?? null,
  }));

  // ── Alertas de inventario ─────────────────────────────────────────────────
  // Agrupar stock por producto (puede haber múltiples lotes del mismo producto)
  const stockPorProducto = new Map<string, { restante: number; minimo: number }>();
  for (const lote of inventario) {
    const prev = stockPorProducto.get(lote.fkeCodProduct);
    stockPorProducto.set(lote.fkeCodProduct, {
      restante: (prev?.restante ?? 0) + (lote.eCantRestante ?? 0),
      minimo:   Math.max(prev?.minimo ?? 0, lote.eStockMinimo ?? 0),
    });
  }

  let agotados  = 0;
  let stockBajo = 0;
  for (const [pid, { restante, minimo }] of stockPorProducto) {
    if (!productosActivos.has(pid)) continue; // solo productos activos en menú
    if (restante === 0) agotados++;
    else if (minimo > 0 && restante <= minimo) stockBajo++;
  }

  // ── Batch 3: top productos vendidos hoy ───────────────────────────────────
  const ventaIds = ventasHoy.map((v: any) => v.eCodVenta);
  let topProductos: TopProducto[] = [];

  if (ventaIds.length > 0) {
    // 1. Detalles de todas las ventas de hoy
    const { data: detallesRaw } = await adminClient
      .from("detalle_venta")
      .select("fkeCodProduct, eCantidad, eSubtotal")
      .in("fkeCodVenta", ventaIds);

    // 2. Agrupar por producto
    const agrupado = new Map<string, { cantVendida: number; totalRevenue: number }>();
    for (const d of detallesRaw ?? []) {
      const prev = agrupado.get(d.fkeCodProduct);
      agrupado.set(d.fkeCodProduct, {
        cantVendida:  (prev?.cantVendida  ?? 0) + d.eCantidad,
        totalRevenue: (prev?.totalRevenue ?? 0) + d.eSubtotal,
      });
    }

    // 3. Top 5 por cantidad vendida
    const top5Ids = [...agrupado.entries()]
      .sort((a, b) => b[1].cantVendida - a[1].cantVendida)
      .slice(0, 5)
      .map(([id]) => id);

    if (top5Ids.length > 0) {
      // 4. Datos de los productos
      const { data: prodRaw } = await adminClient
        .from("productos")
        .select("eCodProduct, tNameProduct, ImgProduct, fkeCodCategory")
        .in("eCodProduct", top5Ids);

      // 5. Nombres de categorías
      const catIds = [...new Set((prodRaw ?? []).map((p: any) => p.fkeCodCategory).filter(Boolean))];
      const { data: catRaw } = catIds.length > 0
        ? await adminClient
            .from("categorias")
            .select("eCodCategory, tNameCategory")
            .in("eCodCategory", catIds)
        : { data: [] };

      const catMap = new Map((catRaw ?? []).map((c: any) => [c.eCodCategory, c.tNameCategory]));

      // 6. Construir array final respetando el orden por cantidad
      topProductos = top5Ids.map((id) => {
        const p     = (prodRaw ?? []).find((p: any) => p.eCodProduct === id);
        const stats = agrupado.get(id)!;
        return {
          eCodProduct:  id,
          tNameProduct: p?.tNameProduct ?? "Producto",
          ImgProduct:   p?.ImgProduct   ?? null,
          categoria:    p?.fkeCodCategory ? (catMap.get(p.fkeCodCategory) ?? null) : null,
          cantVendida:  stats.cantVendida,
          totalRevenue: stats.totalRevenue,
        };
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardClient
      nombreNegocio={negocioRaw?.tNameCompany ?? "Mi negocio"}
      totalHoy={totalHoy}
      numVentas={numVentas}
      ticketPromedio={ticketProm}
      efectivoHoy={efectivoHoy}
      totalAyer={totalAyer}
      numVentasAyer={numVentasAyer}
      desglosePagos={desglosePagos}
      turnosAbiertos={turnosConDatos}
      cortesPendientes={cortesPendientes}
      alertas={{ agotados, stockBajo }}
      tendencia={tendencia}
      topProductos={topProductos}
    />
  );
}
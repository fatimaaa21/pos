// src/app/ticket/[eCodVenta]/page.tsx
//
// Server Component: obtiene todos los datos de la venta
// y los pasa al TicketClient para renderizado + impresión.

import { redirect }        from "next/navigation";
import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TicketClient }      from "./TicketClient";

export default async function TicketPage({
  params,
}: {
  params: Promise<{ eCodVenta: string }>;
}) {
  const { eCodVenta } = await params;

  const supabase    = await createClient();
  const adminClient = createAdminClient();

  // ── Auth ─────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany, tNameUser")
    .eq("eCodUser", user.id)
    .single();

  const fkeCodCompany = perfil?.fkeCodCompany;
  if (!fkeCodCompany) redirect("/auth/login");

  // ── Venta ─────────────────────────────────────────────────────────────────
  // Solo se puede ver el ticket de ventas del propio negocio
  const { data: venta } = await adminClient
    .from("ventas")
    .select("eCodVenta, eTotal, fhCreateVenta, fkeMetodoPago, fkeCodUser, eCostoTiempoMesa")
    .eq("eCodVenta", eCodVenta)
    .eq("fkeCodCompany", fkeCodCompany)
    .single();

  if (!venta) redirect("/empleado/menu");

  // ── Detalles ──────────────────────────────────────────────────────────────
  const { data: detallesRaw } = await adminClient
    .from("detalle_venta")
    .select(
      "eCodDetalle, fkeCodProduct, fkeCodPresentacion, eCantidad, ePrecioUnitario, eSubtotal"
    )
    .eq("fkeCodVenta", eCodVenta);

  // ── Extras de cada línea ──────────────────────────────────────────────────
  const idsDetalle = (detallesRaw ?? []).map((d) => d.eCodDetalle);

  const { data: extrasRaw } =
    idsDetalle.length > 0
      ? await adminClient
          .from("detalle_venta_extras")
          .select("fkeCodDetalle, tNombreSnapshot, ePrecioSnapshot, eCantidadSeleccionada")
          .in("fkeCodDetalle", idsDetalle)
      : { data: [] };

  const extrasPorDetalle = new Map<
    string,
    { tNombre: string; ePrecio: number; eCantidad: number }[]
  >();
  for (const e of extrasRaw ?? []) {
    const lista = extrasPorDetalle.get(e.fkeCodDetalle) ?? [];
    lista.push({ tNombre: e.tNombreSnapshot, ePrecio: e.ePrecioSnapshot, eCantidad: e.eCantidadSeleccionada });
    extrasPorDetalle.set(e.fkeCodDetalle, lista);
  }

  // ── Productos ─────────────────────────────────────────────────────────────
  const productIds = [
    ...new Set((detallesRaw ?? []).map((d) => d.fkeCodProduct)),
  ];

  const { data: productos } =
    productIds.length > 0
      ? await adminClient
          .from("productos")
          .select("eCodProduct, tNameProduct")
          .in("eCodProduct", productIds)
      : { data: [] };

  // ── Presentaciones ────────────────────────────────────────────────────────
  const presIds = [
    ...new Set(
      (detallesRaw ?? [])
        .map((d) => d.fkeCodPresentacion as string | null)
        .filter(Boolean) as string[]
    ),
  ];

  const { data: presentaciones } =
    presIds.length > 0
      ? await adminClient
          .from("presentaciones")
          .select("eCodPresentacion, tNombre")
          .in("eCodPresentacion", presIds)
      : { data: [] };

  // ── Cargos de tiempo (billar, dominó, etc) ─────────────────────────────────
  const { data: cargosTiempo } = await adminClient
    .from("venta_cargos_tiempo")
    .select("eCodCargo, tConcepto, eMonto")
    .eq("fkeCodVenta", eCodVenta);

  // ── Método de pago ────────────────────────────────────────────────────────
  const { data: metodo } = await adminClient
    .from("metodos_pago")
    .select("tNamePay")
    .eq("eCodPay", venta.fkeMetodoPago)
    .single();

  // ── Negocio ───────────────────────────────────────────────────────────────
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("tNameCompany, imgCompany, aplicarIva")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  // ── Empleado que realizó la venta ─────────────────────────────────────────
  // Puede ser distinto al usuario actual (admin viendo ticket de empleado)
  const { data: empleado } = await adminClient
    .from("perfiles")
    .select("tNameUser")
    .eq("eCodUser", venta.fkeCodUser)
    .single();

  // ── Combinar ──────────────────────────────────────────────────────────────
  const productosMap     = new Map((productos ?? []).map((p) => [p.eCodProduct, p]));
  const presentacionesMap = new Map(
    (presentaciones ?? []).map((p) => [p.eCodPresentacion, p])
  );

  const detalles = (detallesRaw ?? []).map((d) => ({
    ...d,
    producto:     productosMap.get(d.fkeCodProduct) ?? null,
    presentacion: d.fkeCodPresentacion
      ? (presentacionesMap.get(d.fkeCodPresentacion) ?? null)
      : null,
    extras: extrasPorDetalle.get(d.eCodDetalle) ?? [],
  }));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <TicketClient
      venta={{
        eCodVenta:        venta.eCodVenta,
        eTotal:           venta.eTotal,
        fhCreateVenta:    venta.fhCreateVenta,
        eCostoTiempoMesa: venta.eCostoTiempoMesa ?? null,
      }}
      detalles={detalles}
      cargosTiempo={cargosTiempo ?? []}
      negocio={{
        tNameCompany: negocio?.tNameCompany ?? "Mi negocio",
        imgCompany:   negocio?.imgCompany   ?? null,
        aplicarIva:   negocio?.aplicarIva   ?? true,
      }}
      metodoPago={metodo?.tNamePay ?? "Efectivo"}
      empleadoNombre={empleado?.tNameUser ?? "—"}
    />
  );
}
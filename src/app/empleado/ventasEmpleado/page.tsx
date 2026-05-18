// src/app/empleado/mis-ventas/page.tsx

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VentasEmpleadoClient } from "./ventasEmpleadoClient";

export default async function VentasEmpleadoPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient(); // bypasea RLS

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // ── Paso 1: ventas del empleado ───────────────────────────────────────────
  const { data: ventas, error: ventasError } = await adminClient
    .from("ventas")
    .select("eCodVenta, eTotal, eMetodoPago, fhCreateVenta")
    .eq("fkeCodUser", user.id)
    .order("fhCreateVenta", { ascending: false });

  if (ventasError) {
    console.error("Error cargando ventas:", ventasError.message);
  }

  // ── Paso 2: detalles de esas ventas ──────────────────────────────────────
  const ids = (ventas ?? []).map((v) => v.eCodVenta);
  let detalles: any[] = [];

  if (ids.length > 0) {
    const { data: det, error: detError } = await adminClient
      .from("detalle_venta")
      .select("eCodDetalle, fkeCodVenta, fkeCodProduct, eCantidad, ePrecioUnitario, eSubtotal")
      .in("fkeCodVenta", ids);

    if (detError) {
      console.error("Error cargando detalles:", detError.message);
    } else {
      detalles = det ?? [];
    }
  }

  // ── Paso 3: nombres de productos ─────────────────────────────────────────
  const productIds = [...new Set(detalles.map((d) => d.fkeCodProduct))];
  let productos: any[] = [];

  if (productIds.length > 0) {
    const { data: prods, error: prodsError } = await adminClient
      .from("productos")
      .select("eCodProduct, tNameProduct, ImgProduct")
      .in("eCodProduct", productIds);

    if (prodsError) {
      console.error("Error cargando productos:", prodsError.message);
    } else {
      productos = prods ?? [];
    }
  }

  // ── Paso 4: combinar en memoria ───────────────────────────────────────────
  const productosMap = new Map(productos.map((p) => [p.eCodProduct, p]));

  const detallesConProducto = detalles.map((d) => ({
    ...d,
    producto: productosMap.get(d.fkeCodProduct) ?? null,
  }));

  const ventasCompletas = (ventas ?? []).map((v) => ({
    ...v,
    detalle_venta: detallesConProducto.filter((d) => d.fkeCodVenta === v.eCodVenta),
  }));

  // ── Total del día ─────────────────────────────────────────────────────────
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);

  const totalHoy = ventasCompletas
    .filter((v) => new Date(v.fhCreateVenta) >= hoy)
    .reduce((acc, v) => acc + v.eTotal, 0);

  return <VentasEmpleadoClient ventas={ventasCompletas} totalHoy={totalHoy} />;
}
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { VentasAdminClient } from "./ventasAdminClient";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";

export default async function VentasAdminPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfilActual } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user.id)
    .single();

  const fkeCodCompany = perfilActual?.fkeCodCompany;
  if (!fkeCodCompany) return null;

  // ── Métodos de pago activos del negocio ───────────────────────────────────
  // 1. IDs que el admin seleccionó para su negocio
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("metodosPago")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  const idsSeleccionados: string[] = negocio?.metodosPago ?? [];

  // 2. Solo esos métodos, en el orden definido por Sistemas
  let metodosPago: MetodoPagoGlobal[] = [];
  if (idsSeleccionados.length > 0) {
    const { data: metodos } = await adminClient
      .from("metodos_pago")
      .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay, orden")
      .in("eCodPay", idsSeleccionados)
      .eq("bStatePay", true)
      .order("orden");

    metodosPago = (metodos as MetodoPagoGlobal[]) ?? [];
  }

  // ── Ventas ────────────────────────────────────────────────────────────────
  const { data: ventas, error: ventasError } = await adminClient
    .from("ventas")
    .select("eCodVenta, eTotal, fkeMetodoPago, fhCreateVenta, fkeCodUser")
    .eq("fkeCodCompany", fkeCodCompany)
    .order("fhCreateVenta", { ascending: false });

  if (ventasError) console.error("Error ventas:", ventasError.message);

  // ── Detalles ──────────────────────────────────────────────────────────────
  const ids = (ventas ?? []).map((v) => v.eCodVenta);
  let detalles: any[] = [];

  if (ids.length > 0) {
    const { data: det, error: detError } = await adminClient
      .from("detalle_venta")
      .select("eCodDetalle, fkeCodVenta, fkeCodProduct, eCantidad, ePrecioUnitario, eSubtotal")
      .in("fkeCodVenta", ids);

    if (detError) console.error("Error detalles:", detError.message);
    else detalles = det ?? [];
  }

  // ── Productos ─────────────────────────────────────────────────────────────
  const productIds = [...new Set(detalles.map((d) => d.fkeCodProduct))];
  let productos: any[] = [];

  if (productIds.length > 0) {
    const { data: prods, error: prodsError } = await adminClient
      .from("productos")
      .select("eCodProduct, tNameProduct, ImgProduct")
      .in("eCodProduct", productIds);

    if (prodsError) console.error("Error productos:", prodsError.message);
    else productos = prods ?? [];
  }

  // ── Perfiles de empleados ─────────────────────────────────────────────────
  const empleadoIds = [...new Set((ventas ?? []).map((v) => v.fkeCodUser))];
  let perfiles: any[] = [];

  if (empleadoIds.length > 0) {
    const { data: perfs, error: perfsError } = await adminClient
      .from("perfiles")
      .select("eCodUser, tNameUser")
      .in("eCodUser", empleadoIds);

    if (perfsError) console.error("Error perfiles:", perfsError.message);
    else perfiles = perfs ?? [];
  }

  // ── Combinar ──────────────────────────────────────────────────────────────
  const productosMap = new Map(productos.map((p) => [p.eCodProduct, p]));
  const perfilesMap  = new Map(perfiles.map((p) => [p.eCodUser, p]));

  const detallesConProducto = detalles.map((d) => ({
    ...d,
    producto: productosMap.get(d.fkeCodProduct) ?? null,
  }));

  const ventasCompletas = (ventas ?? []).map((v) => ({
    ...v,
    empleado:      perfilesMap.get(v.fkeCodUser) ?? null,
    detalle_venta: detallesConProducto.filter((d) => d.fkeCodVenta === v.eCodVenta),
  }));

  const empleadosFiltro = perfiles.map((p) => ({
    id:     p.eCodUser  as string,
    nombre: p.tNameUser as string,
  }));

  return (
    <VentasAdminClient
      ventas={ventasCompletas}
      empleados={empleadosFiltro}
      metodosPago={metodosPago}
    />
  );
}
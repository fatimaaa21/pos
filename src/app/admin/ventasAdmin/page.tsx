import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { VentasAdminClient } from "./ventasAdminClient";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import { getSucursalContext } from "@/lib/utils/sucursal";

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

  const ctx            = await getSucursalContext();
  const fkeCodSucursal = ctx.fkeCodSucursal;

  // ── Configuración del negocio ─────────────────────────────────────────────
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("aplicarIva")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  const aplicarIva: boolean = negocio?.aplicarIva ?? true;

  // ── Ventas ────────────────────────────────────────────────────────────────
  let ventasQuery = adminClient
    .from("ventas")
    .select("eCodVenta, eTotal, fkeMetodoPago, fhCreateVenta, fkeCodUser, bCancelada, tMotivoCancelacion, fhCancelacion")
    .eq("fkeCodCompany", fkeCodCompany)
    .order("fhCreateVenta", { ascending: false });

  if (fkeCodSucursal) ventasQuery = ventasQuery.eq("fkeCodSucursal", fkeCodSucursal);

  const { data: ventas, error: ventasError } = await ventasQuery;

  if (ventasError) console.error("Error ventas:", ventasError.message);

  // ── Métodos de pago ───────────────────────────────────────────────────────
  const idsEnVentas = [...new Set((ventas ?? []).map((v) => v.fkeMetodoPago))];
  let metodosPago: MetodoPagoGlobal[] = [];

  if (idsEnVentas.length > 0) {
    const { data: metodos, error: metodosError } = await adminClient
      .from("metodos_pago")
      .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay")
      .in("eCodPay", idsEnVentas);

    if (metodosError) console.error("Error métodos:", metodosError.message);
    metodosPago = (metodos as MetodoPagoGlobal[]) ?? [];
  }

  // ── Detalles ──────────────────────────────────────────────────────────────
  const ids = (ventas ?? []).map((v) => v.eCodVenta);
  let detalles: any[] = [];

  if (ids.length > 0) {
    const { data: det, error: detError } = await adminClient
      .from("detalle_venta")
      .select("eCodDetalle, fkeCodVenta, fkeCodProduct, fkeCodPresentacion, eCantidad, ePrecioUnitario, eSubtotal, eAnchoCm, eLargoCm, fkeCodMaterial")
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

  // ── Presentaciones ────────────────────────────────────────────────────────
  const presIds = [
    ...new Set(
      detalles
        .map((d) => d.fkeCodPresentacion as string | null)
        .filter(Boolean) as string[]
    ),
  ];
  const presentacionesMap = new Map<string, { tNombre: string }>();

  if (presIds.length > 0) {
    const { data: pres, error: presError } = await adminClient
      .from("presentaciones")
      .select("eCodPresentacion, tNombre")
      .in("eCodPresentacion", presIds);

    if (presError) console.error("Error presentaciones:", presError.message);
    for (const p of pres ?? []) {
      presentacionesMap.set(p.eCodPresentacion, { tNombre: p.tNombre });
    }
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
    producto:     productosMap.get(d.fkeCodProduct) ?? null,
    presentacion: d.fkeCodPresentacion
      ? (presentacionesMap.get(d.fkeCodPresentacion) ?? null)
      : null,
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
      aplicarIva={aplicarIva}
    />
  );
}
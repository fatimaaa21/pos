import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VentasEmpleadoClient } from "./ventasEmpleadoClient";

export default async function VentasEmpleadoPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // ── Perfil del empleado → negocio ─────────────────────────────────────────
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user.id)
    .single();

  // ── Métodos de pago activos del negocio ───────────────────────────────────
  const { data: negocio } = await supabase
    .from("negocios")
    .select("metodosPago")
    .eq("eCodCompany", perfil?.fkeCodCompany)
    .single();

  const metodosPago: string[] = negocio?.metodosPago ?? ["efectivo", "tarjeta", "transferencia"];

  // ── Ventas del empleado ───────────────────────────────────────────────────
  const { data: ventas, error: ventasError } = await adminClient
    .from("ventas")
    .select("eCodVenta, eTotal, fkeMetodoPago, fhCreateVenta, metodos_pago(tNamePay, tIconPay)")
    .eq("fkeCodUser", user.id)
    .order("fhCreateVenta", { ascending: false });

  if (ventasError) console.error("Error cargando ventas:", ventasError.message);

  const ids = (ventas ?? []).map((v) => v.eCodVenta);
  let detalles: any[] = [];

  if (ids.length > 0) {
    const { data: det } = await adminClient
      .from("detalle_venta")
      .select("eCodDetalle, fkeCodVenta, fkeCodProduct, eCantidad, ePrecioUnitario, eSubtotal")
      .in("fkeCodVenta", ids);
    detalles = det ?? [];
  }

  const productIds = [...new Set(detalles.map((d) => d.fkeCodProduct))];
  let productos: any[] = [];

  if (productIds.length > 0) {
    const { data: prods } = await adminClient
      .from("productos")
      .select("eCodProduct, tNameProduct, ImgProduct")
      .in("eCodProduct", productIds);
    productos = prods ?? [];
  }

  const productosMap = new Map(productos.map((p) => [p.eCodProduct, p]));
  const detallesConProducto = detalles.map((d) => ({
    ...d,
    producto: productosMap.get(d.fkeCodProduct) ?? null,
  }));

  const ventasCompletas = (ventas ?? []).map((v: any) => ({
    ...v,
    metodoPagoNombre: v.metodos_pago?.tNamePay ?? v.fkeMetodoPago,
    metodoPagoIcono:  v.metodos_pago?.tIconPay ?? null,
    detalle_venta: detallesConProducto.filter((d) => d.fkeCodVenta === v.eCodVenta),
  }));

  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const totalHoy = ventasCompletas
    .filter((v) => new Date(v.fhCreateVenta) >= hoy)
    .reduce((acc, v) => acc + v.eTotal, 0);

  return (
    <VentasEmpleadoClient
      ventas={ventasCompletas}
      totalHoy={totalHoy}
      metodosPago={metodosPago}
    />
  );
}
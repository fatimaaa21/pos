import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VentasEmpleadoClient } from "./ventasEmpleadoClient";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";

export default async function VentasEmpleadoPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // ── Ventas del empleado ───────────────────────────────────────────────────
  const { data: ventas, error: ventasError } = await adminClient
    .from("ventas")
    .select("eCodVenta, eTotal, fkeMetodoPago, fhCreateVenta")
    .eq("fkeCodUser", user.id)
    .order("fhCreateVenta", { ascending: false });

  if (ventasError) console.error("Error cargando ventas:", ventasError.message);

  // ── Métodos de pago ───────────────────────────────────────────────────────
  // Se cargan desde los IDs reales de las ventas, sin filtrar por estado
  // ni por la configuración actual del negocio. Así las ventas históricas
  // siempre muestran el nombre e ícono correctos aunque el método haya
  // sido desactivado o eliminado después.
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
    const { data: det } = await adminClient
      .from("detalle_venta")
      .select("eCodDetalle, fkeCodVenta, fkeCodProduct, eCantidad, ePrecioUnitario, eSubtotal")
      .in("fkeCodVenta", ids);
    detalles = det ?? [];
  }

  // ── Productos ─────────────────────────────────────────────────────────────
  const productIds = [...new Set(detalles.map((d) => d.fkeCodProduct))];
  let productos: any[] = [];

  if (productIds.length > 0) {
    const { data: prods } = await adminClient
      .from("productos")
      .select("eCodProduct, tNameProduct, ImgProduct")
      .in("eCodProduct", productIds);
    productos = prods ?? [];
  }

  // ── Combinar ──────────────────────────────────────────────────────────────
  const productosMap = new Map(productos.map((p) => [p.eCodProduct, p]));
  const detallesConProducto = detalles.map((d) => ({
    ...d,
    producto: productosMap.get(d.fkeCodProduct) ?? null,
  }));

  const ventasCompletas = (ventas ?? []).map((v) => ({
    ...v,
    detalle_venta: detallesConProducto.filter((d) => d.fkeCodVenta === v.eCodVenta),
  }));

  // ── Total del día (hora local) ────────────────────────────────────────────
  const ahora = new Date();
  const inicioDiaLocal = new Date(
    ahora.getFullYear(),
    ahora.getMonth(),
    ahora.getDate()
  );
  const totalHoy = ventasCompletas
    .filter((v) => new Date(v.fhCreateVenta) >= inicioDiaLocal)
    .reduce((acc, v) => acc + v.eTotal, 0);

  return (
    <VentasEmpleadoClient
      ventas={ventasCompletas}
      totalHoy={totalHoy}
      metodosPago={metodosPago}
    />
  );
}
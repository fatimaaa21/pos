import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MenuClient }        from "./MenuClient";
import type {
  Categoria, ProductoConStock,
  PresentacionConStock, CorteCaja, VentasDelTurno,
} from "@/types";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";

export default async function MenuPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfil?.fkeCodCompany;

  // ── Métodos de pago activos ───────────────────────────────────────────────
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("metodosPago")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  const idsSeleccionados: string[] = negocio?.metodosPago ?? [];
  let metodosPago: MetodoPagoGlobal[] = [];

  if (idsSeleccionados.length > 0) {
    const { data: metodos } = await adminClient
      .from("metodos_pago")
      .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay")
      .in("eCodPay", idsSeleccionados)
      .eq("bStatePay", true);

    metodosPago = (metodos as MetodoPagoGlobal[]) ?? [];
  }

  // ── Turno activo ──────────────────────────────────────────────────────────
  const { data: corteAbierto } = await adminClient
    .from("cortes_caja")
    .select("*")
    .eq("fkeCodUser", user!.id)
    .eq("bStateCorte", "abierto")
    .maybeSingle();

  const tieneTurno = corteAbierto !== null;

  // ── Ventas del turno ──────────────────────────────────────────────────────
  let ventasDelTurno: VentasDelTurno = {
    eTotalEfectivo: 0, eTotalTarjeta: 0,
    eTotalTransferencia: 0, eTotalVentas: 0, eNumVentas: 0,
  };

  if (corteAbierto) {
    const { data: ventasTurno } = await adminClient
      .from("ventas")
      .select("eTotal, fkeMetodoPago")
      .eq("fkeCodUser", user!.id)
      .gte("fhCreateVenta", corteAbierto.fhInicioTurno);

    if (ventasTurno && ventasTurno.length > 0) {
      const metodosIds = [...new Set(ventasTurno.map((v) => v.fkeMetodoPago))];
      const { data: metodosInfo } = await adminClient
        .from("metodos_pago")
        .select("eCodPay, tNamePay")
        .in("eCodPay", metodosIds);

      const metodosMap = new Map(
        (metodosInfo ?? []).map((m) => [m.eCodPay, m.tNamePay.toLowerCase()])
      );

      const esEfectivo = (id: string) => (metodosMap.get(id) ?? "").includes("efectivo");
      const esTarjeta  = (id: string) => (metodosMap.get(id) ?? "").includes("tarjeta");

      ventasDelTurno = {
        eTotalEfectivo: ventasTurno.filter((v) => esEfectivo(v.fkeMetodoPago)).reduce((a, v) => a + v.eTotal, 0),
        eTotalTarjeta:  ventasTurno.filter((v) => esTarjeta(v.fkeMetodoPago)).reduce((a, v) => a + v.eTotal, 0),
        eTotalTransferencia: ventasTurno.filter((v) => !esEfectivo(v.fkeMetodoPago) && !esTarjeta(v.fkeMetodoPago)).reduce((a, v) => a + v.eTotal, 0),
        eTotalVentas: ventasTurno.reduce((a, v) => a + v.eTotal, 0),
        eNumVentas:   ventasTurno.length,
      };
    }
  }

  // ── Categorías ────────────────────────────────────────────────────────────
  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory")
    .eq("bStateCategory", true)
    .order("tNameCategory");

  // ── Inventario: lotes activos (por producto O por presentación) ───────────
  const { data: lotes, error } = await supabase
    .from("vista_inventario")
    .select("fkeCodProduct, fkeCodPresentacion, eCantRestante, bUnlimitedInventory")
    .eq("bStateInventory", true)
    .or("bUnlimitedInventory.eq.true,eCantRestante.gt.0");

  if (error) console.error("Error menú:", JSON.stringify(error));

  if (!lotes || lotes.length === 0) {
    return (
      <MenuClient
        categorias={(categorias as Categoria[]) ?? []}
        productos={[]}
        metodosPago={metodosPago}
        tieneTurno={tieneTurno}
        corte={(corteAbierto as CorteCaja | null) ?? null}
        ventasDelTurno={ventasDelTurno}
      />
    );
  }

  // ── Separar lotes con y sin presentación ─────────────────────────────────
  const lotesSinPres  = lotes.filter((l) => !l.fkeCodPresentacion);
  const lotesConPres  = lotes.filter((l) =>  l.fkeCodPresentacion);

  // Stock por producto (sin presentación)
  const stockProducto    = new Map<string, number>();
  const infinitoProducto = new Map<string, boolean>();

  for (const l of lotesSinPres) {
    if (l.bUnlimitedInventory) {
      infinitoProducto.set(l.fkeCodProduct, true);
    } else {
      const actual = stockProducto.get(l.fkeCodProduct) ?? 0;
      stockProducto.set(l.fkeCodProduct, actual + (l.eCantRestante ?? 0));
    }
  }

  // Stock por presentación
  const stockPorPres    = new Map<string, number>();    // key = fkeCodPresentacion
  const infinitoPorPres = new Map<string, boolean>();

  for (const l of lotesConPres) {
    const pid = l.fkeCodPresentacion!;
    if (l.bUnlimitedInventory) {
      infinitoPorPres.set(pid, true);
    } else {
      const actual = stockPorPres.get(pid) ?? 0;
      stockPorPres.set(pid, actual + (l.eCantRestante ?? 0));
    }
  }

  // ── Productos con stock ───────────────────────────────────────────────────
  // IDs de productos que tienen cualquier stock activo
  const idsConStock = [
    ...new Set([
      ...lotesSinPres.map((l) => l.fkeCodProduct),
      ...lotesConPres.map((l) => l.fkeCodProduct),
    ]),
  ];

  const { data: productos } = await supabase
    .from("productos")
    .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
    .in("eCodProduct", idsConStock)
    .eq("bStateProduct", true);

  // ── Presentaciones activas con stock ─────────────────────────────────────
  // Buscar detalles de las presentaciones con inventario
  const presentacionIds = [...new Set(lotesConPres.map((l) => l.fkeCodPresentacion!))];
  let presentacionesDetalle: any[] = [];

  if (presentacionIds.length > 0) {
    const { data: pres } = await supabase
      .from("presentaciones")
      .select("eCodPresentacion, fkeCodProduct, tNombre, ePricePresentacion, eCostPresentacion")
      .in("eCodPresentacion", presentacionIds)
      .eq("bStatePresentacion", true);

    presentacionesDetalle = pres ?? [];
  }

  // Agrupar presentaciones por producto
  const presByProducto = new Map<string, PresentacionConStock[]>();

  for (const p of presentacionesDetalle) {
    const stock   = stockPorPres.get(p.eCodPresentacion) ?? 0;
    const bInf    = infinitoPorPres.get(p.eCodPresentacion) ?? false;
    const pcs: PresentacionConStock = {
      eCodPresentacion:   p.eCodPresentacion,
      tNombre:            p.tNombre,
      ePricePresentacion: p.ePricePresentacion,
      eCostPresentacion:  p.eCostPresentacion,
      stockDisponible:    bInf ? Number.MAX_SAFE_INTEGER : stock,
      bInfinito:          bInf,
    };

    const lista = presByProducto.get(p.fkeCodProduct) ?? [];
    lista.push(pcs);
    presByProducto.set(p.fkeCodProduct, lista);
  }

  // ── Armar ProductoConStock ────────────────────────────────────────────────
  const productosConStock: ProductoConStock[] = (productos ?? []).map((p) => {
    const pres = presByProducto.get(p.eCodProduct);

    if (pres && pres.length > 0) {
      // Producto con presentaciones:
      // • stockDisponible = suma de todas las presentaciones (para mostrar disponibilidad total)
      // • bInfinito = true si alguna presentación es ilimitada
      const totalStock = pres.reduce((acc, pr) => acc + (pr.bInfinito ? Number.MAX_SAFE_INTEGER : pr.stockDisponible), 0);
      const anyInfinito = pres.some((pr) => pr.bInfinito);

      return {
        eCodProduct:     p.eCodProduct,
        tNameProduct:    p.tNameProduct,
        fkeCodCategory:  p.fkeCodCategory,
        ePriceProduct:   p.ePriceProduct,
        ImgProduct:      p.ImgProduct,
        stockDisponible: anyInfinito ? Number.MAX_SAFE_INTEGER : totalStock,
        bInfinito:       anyInfinito,
        presentaciones:  pres,
      };
    }

    // Producto sin presentaciones (comportamiento original)
    return {
      eCodProduct:     p.eCodProduct,
      tNameProduct:    p.tNameProduct,
      fkeCodCategory:  p.fkeCodCategory,
      ePriceProduct:   p.ePriceProduct,
      ImgProduct:      p.ImgProduct,
      bInfinito:       infinitoProducto.get(p.eCodProduct) ?? false,
      stockDisponible: infinitoProducto.get(p.eCodProduct)
        ? Number.MAX_SAFE_INTEGER
        : (stockProducto.get(p.eCodProduct) ?? 0),
    };
  });

  return (
    <MenuClient
      categorias={(categorias as Categoria[]) ?? []}
      productos={productosConStock}
      metodosPago={metodosPago}
      tieneTurno={tieneTurno}
      corte={(corteAbierto as CorteCaja | null) ?? null}
      ventasDelTurno={ventasDelTurno}
    />
  );
}
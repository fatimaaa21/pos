import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MenuClient }        from "./MenuClient";
import type { Categoria, ProductoConStock, CorteCaja, VentasDelTurno } from "@/types";
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

  // ── Métodos de pago activos para el negocio ───────────────────────────────
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

  // ── Turno activo del empleado ─────────────────────────────────────────────
  const { data: corteAbierto } = await adminClient
    .from("cortes_caja")
    .select("*")
    .eq("fkeCodUser", user!.id)
    .eq("bStateCorte", "abierto")
    .maybeSingle();

  const tieneTurno = corteAbierto !== null;

  // ── Ventas acumuladas en el turno actual ──────────────────────────────────
  // Se calcula aquí (server) para que ModalCerrarCaja tenga datos frescos
  // sin necesitar otro fetch desde el cliente.
  let ventasDelTurno: VentasDelTurno = {
    eTotalEfectivo:      0,
    eTotalTarjeta:       0,
    eTotalTransferencia: 0,
    eTotalVentas:        0,
    eNumVentas:          0,
  };

  if (corteAbierto) {
    const { data: ventasTurno } = await adminClient
      .from("ventas")
      .select("eTotal, fkeMetodoPago")
      .eq("fkeCodUser", user!.id)
      .gte("fhCreateVenta", corteAbierto.fhInicioTurno);

    if (ventasTurno && ventasTurno.length > 0) {
      // Resolver nombres de métodos para clasificar (efectivo vs tarjeta vs resto)
      // fkeMetodoPago es un UUID dinámico, no el string "efectivo"
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
        eTotalEfectivo: ventasTurno
          .filter((v) => esEfectivo(v.fkeMetodoPago))
          .reduce((a, v) => a + v.eTotal, 0),
        eTotalTarjeta: ventasTurno
          .filter((v) => esTarjeta(v.fkeMetodoPago))
          .reduce((a, v) => a + v.eTotal, 0),
        eTotalTransferencia: ventasTurno
          .filter((v) => !esEfectivo(v.fkeMetodoPago) && !esTarjeta(v.fkeMetodoPago))
          .reduce((a, v) => a + v.eTotal, 0),
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

  // ── Inventario: lotes con stock > 0 ó infinitos, ambos activos ────────────
  const { data: lotes, error } = await supabase
    .from("vista_inventario")
    .select("fkeCodProduct, eCantRestante, bUnlimitedInventory")
    .eq("bStateInventory", true)
    .or("bUnlimitedInventory.eq.true,eCantRestante.gt.0");

  if (error) console.error("Error menú:", JSON.stringify(error));

  // Retorno temprano si no hay productos — turno/métodos siguen pasando
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

  const idsConStock = [...new Set(lotes.map((l) => l.fkeCodProduct))];

  const { data: productos } = await supabase
    .from("productos")
    .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
    .in("eCodProduct", idsConStock)
    .eq("bStateProduct", true);

  // Calcular stock y marcar infinitos
  const stockPorProducto    = new Map<string, number>();
  const infinitoPorProducto = new Map<string, boolean>();

  for (const lote of lotes) {
    if (lote.bUnlimitedInventory) {
      infinitoPorProducto.set(lote.fkeCodProduct, true);
    } else {
      const actual = stockPorProducto.get(lote.fkeCodProduct) ?? 0;
      stockPorProducto.set(lote.fkeCodProduct, actual + (lote.eCantRestante ?? 0));
    }
  }

  const productosConStock: ProductoConStock[] = (productos ?? []).map((p) => ({
    eCodProduct:     p.eCodProduct,
    tNameProduct:    p.tNameProduct,
    fkeCodCategory:  p.fkeCodCategory,
    ePriceProduct:   p.ePriceProduct,
    ImgProduct:      p.ImgProduct,
    bInfinito:       infinitoPorProducto.get(p.eCodProduct) ?? false,
    stockDisponible: infinitoPorProducto.get(p.eCodProduct)
      ? Number.MAX_SAFE_INTEGER
      : (stockPorProducto.get(p.eCodProduct) ?? 0),
  }));

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
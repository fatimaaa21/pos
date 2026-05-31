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

  // ── Configuración del negocio (métodos + IVA) ─────────────────────────────
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("metodosPago, aplicarIva")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  const idsSeleccionados: string[] = negocio?.metodosPago ?? [];
  // Si la columna aún no existe en DB, `aplicarIva` vendrá null → default true
  const aplicarIva: boolean = negocio?.aplicarIva ?? true;

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
        eTotalEfectivo:      ventasTurno.filter((v) =>  esEfectivo(v.fkeMetodoPago)).reduce((a, v) => a + v.eTotal, 0),
        eTotalTarjeta:       ventasTurno.filter((v) =>  esTarjeta(v.fkeMetodoPago)).reduce((a, v)  => a + v.eTotal, 0),
        eTotalTransferencia: ventasTurno.filter((v) => !esEfectivo(v.fkeMetodoPago) && !esTarjeta(v.fkeMetodoPago)).reduce((a, v) => a + v.eTotal, 0),
        eTotalVentas:        ventasTurno.reduce((a, v) => a + v.eTotal, 0),
        eNumVentas:          ventasTurno.length,
      };
    }
  }

  // ── Categorías ────────────────────────────────────────────────────────────
  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory")
    .eq("bStateCategory", true)
    .order("tNameCategory");

  // ── Lotes activos ─────────────────────────────────────────────────────────
  const { data: lotes, error } = await adminClient
    .from("vista_inventario")
    .select("fkeCodProduct, fkeCodPresentacion, eCantRestante, bUnlimitedInventory")
    .eq("fkeCodCompany", fkeCodCompany)
    .eq("bStateInventory", true)
    .or("bUnlimitedInventory.eq.true,eCantRestante.gt.0");

  if (error) console.error("Error menú lotes:", JSON.stringify(error));

  if (!lotes || lotes.length === 0) {
    return (
      <MenuClient
        categorias={(categorias as Categoria[]) ?? []}
        productos={[]}
        metodosPago={metodosPago}
        tieneTurno={tieneTurno}
        corte={(corteAbierto as CorteCaja | null) ?? null}
        ventasDelTurno={ventasDelTurno}
        aplicarIva={aplicarIva}
      />
    );
  }

  // ── Separar lotes con y sin presentación ─────────────────────────────────
  const lotesSinPres = lotes.filter((l: any) => !l.fkeCodPresentacion);
  const lotesConPres = lotes.filter((l: any) =>  l.fkeCodPresentacion);

  const stockProducto    = new Map<string, number>();
  const infinitoProducto = new Map<string, boolean>();

  for (const l of lotesSinPres) {
    if (l.bUnlimitedInventory) {
      infinitoProducto.set(l.fkeCodProduct, true);
    } else {
      stockProducto.set(l.fkeCodProduct, (stockProducto.get(l.fkeCodProduct) ?? 0) + (l.eCantRestante ?? 0));
    }
  }

  const stockPorPres    = new Map<string, number>();
  const infinitoPorPres = new Map<string, boolean>();

  for (const l of lotesConPres) {
    const pid = l.fkeCodPresentacion as string;
    if (l.bUnlimitedInventory) {
      infinitoPorPres.set(pid, true);
    } else {
      stockPorPres.set(pid, (stockPorPres.get(pid) ?? 0) + (l.eCantRestante ?? 0));
    }
  }

  const idsConStock = [
    ...new Set([
      ...lotesSinPres.map((l: any) => l.fkeCodProduct as string),
      ...lotesConPres.map((l: any) => l.fkeCodProduct as string),
    ]),
  ];

  const { data: productos } = await adminClient
    .from("productos")
    .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
    .in("eCodProduct", idsConStock)
    .eq("bStateProduct", true);

  const presentacionIds = [...new Set(lotesConPres.map((l: any) => l.fkeCodPresentacion as string))];
  let presentacionesDetalle: any[] = [];

  if (presentacionIds.length > 0) {
    const { data: pres } = await adminClient
      .from("presentaciones")
      .select("eCodPresentacion, fkeCodProduct, tNombre, ePricePresentacion, eCostPresentacion")
      .in("eCodPresentacion", presentacionIds)
      .eq("bStatePresentacion", true);
    presentacionesDetalle = pres ?? [];
  }

  const presByProducto = new Map<string, PresentacionConStock[]>();

  for (const p of presentacionesDetalle) {
    const bInf  = infinitoPorPres.get(p.eCodPresentacion) ?? false;
    const stock = bInf ? Number.MAX_SAFE_INTEGER : (stockPorPres.get(p.eCodPresentacion) ?? 0);

    const pcs: PresentacionConStock = {
      eCodPresentacion:   p.eCodPresentacion,
      tNombre:            p.tNombre,
      ePricePresentacion: p.ePricePresentacion,
      eCostPresentacion:  p.eCostPresentacion,
      stockDisponible:    stock,
      bInfinito:          bInf,
    };

    const lista = presByProducto.get(p.fkeCodProduct) ?? [];
    lista.push(pcs);
    presByProducto.set(p.fkeCodProduct, lista);
  }

  const productosConStock: ProductoConStock[] = (productos ?? []).map((p) => {
    const pres = presByProducto.get(p.eCodProduct);

    if (pres && pres.length > 0) {
      const anyInfinito = pres.some((pr) => pr.bInfinito);
      const totalStock  = pres.reduce(
        (acc, pr) => acc + (pr.bInfinito ? Number.MAX_SAFE_INTEGER : pr.stockDisponible),
        0
      );
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

    const bInf = infinitoProducto.get(p.eCodProduct) ?? false;
    return {
      eCodProduct:     p.eCodProduct,
      tNameProduct:    p.tNameProduct,
      fkeCodCategory:  p.fkeCodCategory,
      ePriceProduct:   p.ePriceProduct,
      ImgProduct:      p.ImgProduct,
      bInfinito:       bInf,
      stockDisponible: bInf ? Number.MAX_SAFE_INTEGER : (stockProducto.get(p.eCodProduct) ?? 0),
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
      aplicarIva={aplicarIva}
    />
  );
}
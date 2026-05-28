import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MenuClient }        from "./MenuClient";
import type { Categoria, ProductoConStock, CorteCaja, VentasDelTurno } from "@/types";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";

export default async function MenuPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  // ── Turno abierto ─────────────────────────────────────────────────────────
  const { data: turnoAbierto } = user
    ? await adminClient
        .from("cortes_caja")
        .select("*")
        .eq("fkeCodUser", user.id)
        .eq("bStateCorte", "abierto")
        .maybeSingle()
    : { data: null };

  const tieneTurno = !!turnoAbierto;

  // ── Ventas del turno actual ───────────────────────────────────────────────
  let ventasDelTurno: VentasDelTurno = {
    eTotalEfectivo:      0,
    eTotalTarjeta:       0,
    eTotalTransferencia: 0,
    eTotalVentas:        0,
    eNumVentas:          0,
  };

  if (turnoAbierto && user) {
    const { data: ventas } = await adminClient
      .from("ventas")
      .select("eTotal, fkeMetodoPago")   // ← fkeMetodoPago, no eMetodoPago
      .eq("fkeCodUser", user.id)
      .gte("fhCreateVenta", turnoAbierto.fhInicioTurno);

    if (ventas) {
      ventasDelTurno.eTotalEfectivo      = ventas.filter(v => v.fkeMetodoPago === "efectivo").reduce((a, v) => a + v.eTotal, 0);
      ventasDelTurno.eTotalTarjeta       = ventas.filter(v => v.fkeMetodoPago === "tarjeta").reduce((a, v) => a + v.eTotal, 0);
      ventasDelTurno.eTotalTransferencia = ventas.filter(v => v.fkeMetodoPago === "transferencia").reduce((a, v) => a + v.eTotal, 0);
      ventasDelTurno.eTotalVentas        = ventas.reduce((a, v) => a + v.eTotal, 0);
      ventasDelTurno.eNumVentas          = ventas.length;
    }
  }

  // ── Perfil del empleado ───────────────────────────────────────────────────
  const { data: perfil } = user
    ? await supabase
        .from("perfiles")
        .select("fkeCodCompany")
        .eq("eCodUser", user.id)
        .single()
    : { data: null };

  // ── Métodos de pago activos ───────────────────────────────────────────────
  const { data: metodosPago } = await adminClient
    .from("metodos_pago")
    .select("eCodPay, tNamePay, tIconPay")
    .eq("bStatePay", true)
    .order("orden", { ascending: true });

  // ── Categorías ────────────────────────────────────────────────────────────
  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory")
    .eq("bStateCategory", true)
    .order("tNameCategory");

  // ── Inventario ────────────────────────────────────────────────────────────
  const { data: lotes, error } = await supabase
    .from("vista_inventario")
    .select("fkeCodProduct, eCantRestante")
    .eq("bStateInventory", true)
    .gt("eCantRestante", 0);

  if (error) console.error("Error:", JSON.stringify(error));

  const metodosSeguros = (metodosPago ?? []) as MetodoPagoGlobal[];

  if (!lotes || lotes.length === 0) {
    return (
      <MenuClient
        categorias={(categorias as Categoria[]) ?? []}
        productos={[]}
        tieneTurno={tieneTurno}
        corte={(turnoAbierto ?? null) as CorteCaja | null}
        ventasDelTurno={ventasDelTurno}
        metodosPago={metodosSeguros}
      />
    );
  }

  const idsConStock = [...new Set(lotes.map((l) => l.fkeCodProduct))];

  const { data: productos } = await supabase
    .from("productos")
    .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
    .in("eCodProduct", idsConStock)
    .eq("bStateProduct", true);

  const stockPorProducto = new Map<string, number>();
  for (const lote of lotes) {
    const actual = stockPorProducto.get(lote.fkeCodProduct) ?? 0;
    stockPorProducto.set(lote.fkeCodProduct, actual + lote.eCantRestante);
  }

  const productosConStock: ProductoConStock[] = (productos ?? []).map((p) => ({
    eCodProduct:     p.eCodProduct,
    tNameProduct:    p.tNameProduct,
    fkeCodCategory:  p.fkeCodCategory,
    ePriceProduct:   p.ePriceProduct,
    ImgProduct:      p.ImgProduct,
    stockDisponible: stockPorProducto.get(p.eCodProduct) ?? 0,
  }));

  return (
    <MenuClient
      categorias={(categorias as Categoria[]) ?? []}
      productos={productosConStock}
      tieneTurno={tieneTurno}
      corte={(turnoAbierto ?? null) as CorteCaja | null}
      ventasDelTurno={ventasDelTurno}
      metodosPago={metodosSeguros}
    />
  );
}
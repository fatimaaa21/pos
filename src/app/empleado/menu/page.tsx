import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MenuClient }        from "./MenuClient";
import type { Categoria, ProductoConStock } from "@/types";
import type { MetodoPagoGlobal }            from "@/lib/actions/metodos-pago";

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

  // ── Métodos de pago ───────────────────────────────────────────────────────
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
      .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay, orden")
      .in("eCodPay", idsSeleccionados)
      .eq("bStatePay", true)
      .order("orden");
    metodosPago = (metodos as MetodoPagoGlobal[]) ?? [];
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

  if (!lotes || lotes.length === 0) {
    return (
      <MenuClient
        categorias={(categorias as Categoria[]) ?? []}
        productos={[]}
        metodosPago={metodosPago}
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
    // Centinela: Number.MAX_SAFE_INTEGER nunca bloquea el botón + en el carrito
    stockDisponible: infinitoPorProducto.get(p.eCodProduct)
      ? Number.MAX_SAFE_INTEGER
      : (stockPorProducto.get(p.eCodProduct) ?? 0),
  }));

  return (
    <MenuClient
      categorias={(categorias as Categoria[]) ?? []}
      productos={productosConStock}
      metodosPago={metodosPago}
    />
  );
}
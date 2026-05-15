import { createClient } from "@/lib/supabase/server";
import { MenuClient } from "./MenuClient";
import type { Categoria, ProductoConStock } from "@/types";

export default async function MenuPage() {
  const supabase = await createClient();

  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory")
    .eq("bStateCategory", true)
    .order("tNameCategory");

  // ── Usar la vista que calcula eCantRestante dinámicamente ──
  const { data: lotes, error } = await supabase
    .from("vista_inventario")          // ← vista, no tabla
    .select("fkeCodProduct, eCantRestante")
    .eq("bStateInventory", true)
    .gt("eCantRestante", 0);           // ← filtrar por restante, no ingresada

  if (error) console.error("Error:", JSON.stringify(error));

  if (!lotes || lotes.length === 0) {
    return <MenuClient categorias={(categorias as Categoria[]) ?? []} productos={[]} />;
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
    />
  );
}
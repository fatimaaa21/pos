// src/app/empleado/menu/page.tsx
import { createClient } from "@/lib/supabase/server";
import { MenuClient } from "./MenuClient";
import type { Categoria, ProductoConStock } from "@/types";

export default async function MenuPage() {
  const supabase = await createClient();

  // Categorías activas
  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory")
    .eq("bStateCategory", true)
    .order("tNameCategory");

  // 1. IDs de productos que están en inventario y activos
  const { data: lotes, error } = await supabase
    .from("inventario")
    .select("fkeCodProduct, eCantIngresada")
    .eq("bStateInventory", true);

  if (error) console.error("Error:", JSON.stringify(error));

  if (!lotes || lotes.length === 0) {
    return <MenuClient categorias={(categorias as Categoria[]) ?? []} productos={[]} />;
  }

  const idsConStock = [...new Set(lotes.map((l) => l.fkeCodProduct))];

  // 2. Traer esos productos
  const { data: productos } = await supabase
    .from("productos")
    .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
    .in("eCodProduct", idsConStock)
    .eq("bStateProduct", true);

  // 3. Usar eCantIngresada como stock por ahora
  const stockPorProducto = new Map<string, number>();
  for (const lote of lotes) {
    const actual = stockPorProducto.get(lote.fkeCodProduct) ?? 0;
    stockPorProducto.set(lote.fkeCodProduct, actual + lote.eCantIngresada);
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
import { createClient } from "@/lib/supabase/server";
import { InventarioEmpleadoClient } from "./InventarioClient";
import type { ProductoConStock, Categoria } from "@/types";

export default async function InventarioEmpleadoPage() {
  const supabase = await createClient();

  // Categorías activas
  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory")
    .eq("bStateCategory", true)
    .order("tNameCategory");

  // Stock desde la vista (igual que el menú)
  const { data: lotes } = await supabase
    .from("vista_inventario")
    .select("fkeCodProduct, eCantRestante, eCantIngresada, eStockMinimo")
    .eq("bStateInventory", true);

  const ingresadoPorProducto = new Map<string, number>();

  if (!lotes || lotes.length === 0) {
    return (
      <InventarioEmpleadoClient
        categorias={(categorias as Categoria[]) ?? []}
        productos={[]}
      />
    );
  }

  const idsConStock = [...new Set(lotes.map((l) => l.fkeCodProduct))];

  const { data: productos } = await supabase
    .from("productos")
    .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
    .in("eCodProduct", idsConStock)
    .eq("bStateProduct", true);

  // Sumar restantes por producto (puede haber varios lotes)
  const stockPorProducto = new Map<string, number>();
  const minimoPorProducto = new Map<string, number>();

  for (const lote of lotes) {
    const actual = stockPorProducto.get(lote.fkeCodProduct) ?? 0;
    stockPorProducto.set(lote.fkeCodProduct, actual + lote.eCantRestante);

    const ingresado = ingresadoPorProducto.get(lote.fkeCodProduct) ?? 0;
    ingresadoPorProducto.set(lote.fkeCodProduct, ingresado + lote.eCantIngresada);

    const minActual = minimoPorProducto.get(lote.fkeCodProduct) ?? 0;
    minimoPorProducto.set(lote.fkeCodProduct, Math.max(minActual, lote.eStockMinimo));
  }

  const productosConStock = (productos ?? []).map((p) => ({
    eCodProduct:     p.eCodProduct,
    tNameProduct:    p.tNameProduct,
    fkeCodCategory:  p.fkeCodCategory,
    ePriceProduct:   p.ePriceProduct,
    ImgProduct:      p.ImgProduct,
    stockDisponible: stockPorProducto.get(p.eCodProduct) ?? 0,
    stockMinimo:     minimoPorProducto.get(p.eCodProduct) ?? 0,
    stockIngresado:  ingresadoPorProducto.get(p.eCodProduct) ?? 0,  // ← nuevo
  }));

  return (
    <InventarioEmpleadoClient
      categorias={(categorias as Categoria[]) ?? []}
      productos={productosConStock}
    />
  );
}
import { createClient } from "@/lib/supabase/server";
import { MenuClient } from "./MenuClient";
import type { Categoria, ProductoConStock } from "@/types";

export default async function MenuPage() {
  const supabase = await createClient();

  const { data: categorias, error: errorCat } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory, bStateCategory")
    .eq("bStateCategory", true)
    .order("tNameCategory");

  // Usar el nombre exacto de la FK que indica el hint de Supabase
  const { data: productosConStock, error: errorProd } = await supabase
    .from("productos")
    .select(`
      *,
      inventario!inventario_fkeCodProduct_fkey (
        eCantRestante,
        bStateInventory
      )
    `)
    .eq("bStateProduct", true)
    .order("tNameProduct");

  if (errorCat)  console.error("Error cargando categorías:", errorCat);
  if (errorProd) console.error("Error cargando productos:", errorProd);

  const productos: ProductoConStock[] = (productosConStock ?? [])
    .map((p: any) => {
      const stockTotal = (p.inventario ?? [])
        .filter((lote: any) => lote.bStateInventory)
        .reduce((acc: number, lote: any) => acc + (lote.eCantRestante ?? 0), 0);

      return { ...p, stockDisponible: stockTotal };
    })
    .filter((p: ProductoConStock) => p.stockDisponible > 0);

  return (
    <MenuClient
      categorias={(categorias as Categoria[]) ?? []}
      productos={productos}
    />
  );
}
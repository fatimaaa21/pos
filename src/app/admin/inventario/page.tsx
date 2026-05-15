import { createClient } from "@/lib/supabase/server";
import { InventarioClient } from "./InventarioClient";
import type { InventarioConProducto } from "./InventarioClient";

export default async function InventarioPage() {
  const supabase = await createClient();

  const { data: inventario, error } = await supabase
    .from("inventario")
    .select(`
      *,
      productos!inventario_fkeCodProduct_fkey (
        tNameProduct,
        ImgProduct,
        ePriceProduct,
        categorias (
          tNameCategory
        )
      )
    `)
    .order("fhCreateInventory", { ascending: false });

  if (error) console.error("Error cargando inventario:", error);

  return <InventarioClient inventario={(inventario as InventarioConProducto[]) ?? []} />;
}
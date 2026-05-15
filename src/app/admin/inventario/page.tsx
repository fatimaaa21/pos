// src/app/admin/inventario/page.tsx
import { createClient } from "@/lib/supabase/server";
import { InventarioClient } from "./InventarioClient";
import type { InventarioConProducto } from "./InventarioClient";

export default async function InventarioPage() {
  const supabase = await createClient();

  const { data: inventario, error } = await supabase
    .from("vista_inventario")           // ← vista en lugar de tabla
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
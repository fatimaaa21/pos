import { createClient } from "@/lib/supabase/server";
import { InventarioClient } from "./InventarioClient";
import type { InventarioConProducto } from "./InventarioClient";

export default async function InventarioPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfilActual } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfilActual?.fkeCodCompany;

  // Obtener IDs de productos del negocio actual
  const { data: productosDelNegocio } = await supabase
    .from("productos")
    .select("eCodProduct")
    .eq("fkeCodCompany", fkeCodCompany);

  const idsProductos = (productosDelNegocio ?? []).map((p) => p.eCodProduct);

  // Si no hay productos, retornar vacío
  if (idsProductos.length === 0) {
    return <InventarioClient inventario={[]} />;
  }

  const { data: inventario, error } = await supabase
    .from("vista_inventario")
    .select(`
      *,
      productos!inventario_fkeCodProduct_fkey (
        tNameProduct,
        ImgProduct,
        ePriceProduct,
        categorias (
          eCodCategory,
          tNameCategory
        )
      )
    `)
    .in("fkeCodProduct", idsProductos)
    .order("fhCreateInventory", { ascending: false });

  if (error) console.error("Error cargando inventario:", error);

  return <InventarioClient inventario={(inventario as InventarioConProducto[]) ?? []} />;
}
import { createClient } from "@/lib/supabase/server";
import { ProductClient } from "./ProductosClient";
import type { Producto } from "@/types";

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: productos, error } = await supabase
    .from("productos")
    .select("*")
    .order("tNameProduct");

  if (error) console.error("Error cargando productos:", error);

  return <ProductClient productos={(productos as Producto[]) ?? []} />;
}
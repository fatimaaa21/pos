import { createClient } from "@/lib/supabase/server";
import { ProductClient } from "./ProductosClient";
import type { Producto } from "@/types";

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfilActual } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfilActual?.fkeCodCompany;

  const { data: productos, error } = await supabase
    .from("productos")
    .select(`*, categorias (eCodCategory, tNameCategory)`)
    .eq("fkeCodCompany", fkeCodCompany)
    .order("eCodProduct", { ascending: true });

  if (error) console.error("Error cargando productos:", error);

  return <ProductClient productos={(productos as Producto[]) ?? []} />;
}
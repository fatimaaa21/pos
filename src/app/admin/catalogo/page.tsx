import { createClient } from "@/lib/supabase/server";
import { CatalogoClient } from "./CatalogoClient";
import type { Categoria } from "@/types";

export default async function CatalogoPage() {
  const supabase = await createClient();

  // Traemos categorías junto con sus productos (solo los campos necesarios)
  const { data: categorias, error } = await supabase
    .from("categorias")
    .select(`
      *,
      productos (
        eCodProduct,
        tNameProduct,
        bStateProduct,
        ePriceProduct
      )
    `)
    .order("tNameCategory");

  if (error) console.error("Error cargando categorías:", error);

  return <CatalogoClient categorias={(categorias as Categoria[]) ?? []} />;
}
import { createClient } from "@/lib/supabase/server";
import { CatalogoClient } from "./CatalogoClient";
import type { Categoria } from "@/types";

export default async function CatalogoPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfilActual } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfilActual?.fkeCodCompany;

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
    .eq("fkeCodCompany", fkeCodCompany)
    .order("tNameCategory");

  if (error) console.error("Error cargando categorías:", error);

  return <CatalogoClient categorias={(categorias as Categoria[]) ?? []} />;
}
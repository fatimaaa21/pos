import { createClient } from "@/lib/supabase/server";
import { CatalogoClient } from "./CatalogoClient";
import type { Categoria } from "@/types";

export default async function CatalogoPage() {
  const supabase = await createClient();

  const { data: categorias, error } = await supabase
    .from("categorias")
    .select("*")
    .order("tNameCategory");

  if (error) console.error("Error cargando categorías:", error);

  return <CatalogoClient categorias={(categorias as Categoria[]) ?? []} />;
}
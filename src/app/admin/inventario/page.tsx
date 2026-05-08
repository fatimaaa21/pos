import { createClient } from "@/lib/supabase/server";
import { InventarioClient } from "./InventarioClient";
import type { Inventario } from "@/types";

export default async function InventarioPage() {
  const supabase = await createClient();

  const { data: inventario, error } = await supabase
    .from("inventario")
    .select("*");

  if (error) console.error("Error cargando inventario:", error);

  return <InventarioClient inventario={(inventario as Inventario[]) ?? []} />;
}
import { createClient } from "@/lib/supabase/server";
import { UsuariosClient } from "./UsuariosClient";
import type { Perfil } from "@/types";

export default async function UsuariosPage() {
  const supabase = await createClient();

  const { data: usuarios, error } = await supabase
    .from("perfiles")
    .select("*")
    .order("fhCreateUser", { ascending: false });

  if (error) console.error("Error cargando usuarios:", error);

  return <UsuariosClient usuarios={(usuarios as Perfil[]) ?? []} />;
}
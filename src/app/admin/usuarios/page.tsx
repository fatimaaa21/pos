import { createClient } from "@/lib/supabase/server";
import { UsuariosClient } from "./UsuariosClient";
import type { Perfil } from "@/types";

export default async function UsuariosPage() {
  const supabase = await createClient();

  // Obtener el perfil del admin actual para saber su negocio
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: perfilActual } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  // Solo traer usuarios del mismo negocio
  const { data: usuarios, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("fkeCodCompany", perfilActual?.fkeCodCompany)
    .order("fhCreateUser", { ascending: false });

  if (error) console.error("Error cargando usuarios:", error);

  return <UsuariosClient usuarios={(usuarios as Perfil[]) ?? []} />;
}
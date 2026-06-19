import { createClient }       from "@/lib/supabase/server";
import { createAdminClient }  from "@/lib/supabase/admin";
import { redirect }           from "next/navigation";
import { MesasAdminClient }   from "./MesasAdminClient";
import { obtenerMesasAdmin }  from "@/lib/actions/mesas";
import type { MesaConEstado } from "@/types";

export default async function AdminMesasPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil || perfil.tRolUser !== "admin") redirect("/admin/dashboard");

  // Verificar módulo activo
  const { data: modulo } = await adminClient
    .from("modulos_tenant")
    .select("bStateModulo")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("tModulo", "mesas")
    .single();

  if (!modulo?.bStateModulo) redirect("/admin/dashboard");

  // obtenerMesasAdmin devuelve activas + inactivas (admin necesita ver ambas
  // para poder reactivar mesas desactivadas)
  const mesas = await obtenerMesasAdmin();

  return <MesasAdminClient mesasIniciales={mesas as MesaConEstado[]} />;
}
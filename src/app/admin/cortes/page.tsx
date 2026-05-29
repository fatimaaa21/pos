import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CortesAdminClient } from "./CortesAdminClient";
import type { CorteCaja }    from "@/types";

export default async function CortesAdminPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfilActual } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user.id)
    .single();

  const fkeCodCompany = perfilActual?.fkeCodCompany;
  if (!fkeCodCompany) return null;

  // Todos los cortes del negocio ordenados por más reciente
  const { data: cortes, error } = await adminClient
    .from("cortes_caja")
    .select("*")
    .eq("fkeCodCompany", fkeCodCompany)
    .order("fhCreateCorte", { ascending: false });

  if (error) console.error("Error cargando cortes:", error.message);

  // Perfiles de los empleados que tienen cortes
  const empleadoIds = [...new Set((cortes ?? []).map(c => c.fkeCodUser))];
  let perfiles: any[] = [];

  if (empleadoIds.length > 0) {
    const { data: perfs } = await adminClient
      .from("perfiles")
      .select("eCodUser, tNameUser")
      .in("eCodUser", empleadoIds);

    perfiles = perfs ?? [];
  }

  const perfilesMap = new Map(perfiles.map(p => [p.eCodUser, p]));

  const cortesConEmpleado = (cortes ?? []).map(c => ({
    ...c,
    empleado: perfilesMap.get(c.fkeCodUser) ?? null,
  }));

  return <CortesAdminClient cortes={cortesConEmpleado} />;
}
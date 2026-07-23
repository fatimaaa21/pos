import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect }          from "next/navigation";
import { SucursalesAdminClient } from "./SucursalesAdminClient";
import type { Sucursal } from "@/types";

export default async function SucursalesPage() {
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

  const { data: sucursales } = await adminClient
    .from("sucursales")
    .select("eCodSucursal, fkeCodCompany, tNombre, tDireccion, bStateSucursal, fhCreateSucursal, tTokenCocina")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .order("fhCreateSucursal");

  // La URL de la pantalla de cocina no debe mostrarse si el módulo está
  // desactivado — antes esta pantalla ignoraba modulos_tenant por completo
  // y mostraba el botón solo con base en si existía tTokenCocina.
  const { data: moduloCocina } = await adminClient
    .from("modulos_tenant")
    .select("bStateModulo")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("tModulo", "cocina")
    .maybeSingle();

  const moduloCocinaActivo = moduloCocina?.bStateModulo === true;

  return (
    <SucursalesAdminClient
      sucursalesIniciales={(sucursales as Sucursal[]) ?? []}
      moduloCocinaActivo={moduloCocinaActivo}
    />
  );
}
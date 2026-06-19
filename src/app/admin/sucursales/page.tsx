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
    .select("*")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .order("fhCreateSucursal");

  return (
    <SucursalesAdminClient
      sucursalesIniciales={(sucursales as Sucursal[]) ?? []}
    />
  );
}
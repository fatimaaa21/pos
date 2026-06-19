import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { cookies }           from "next/headers";

const COOKIE_SUCURSAL = "kivi_sucursal_activa";

/**
 * Devuelve el contexto de sucursal para el usuario actual.
 *
 * - Empleado: siempre su propia sucursal (fkeCodSucursal del perfil)
 * - Admin:    la sucursal seleccionada en la cookie, o null (= todas)
 */
export async function getSucursalContext(): Promise<{
  fkeCodCompany:    string;
  fkeCodSucursal:   string | null; // null = todas las sucursales (admin)
  tRolUser:         string;
  uid:              string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const adminClient = createAdminClient();
  const { data: perfil } = await adminClient
    .from("perfiles")
    .select("fkeCodCompany, fkeCodSucursal, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil?.fkeCodCompany) throw new Error("Perfil sin negocio");

  // Empleado: usa su sucursal fija
  if (perfil.tRolUser === "empleado") {
    return {
      fkeCodCompany:  perfil.fkeCodCompany,
      fkeCodSucursal: perfil.fkeCodSucursal,
      tRolUser:       perfil.tRolUser,
      uid:            user.id,
    };
  }

  // Admin: lee la cookie
  const cookieStore = await cookies();
  const cookieSucursal = cookieStore.get(COOKIE_SUCURSAL)?.value ?? null;

  return {
    fkeCodCompany:  perfil.fkeCodCompany,
    fkeCodSucursal: cookieSucursal,
    tRolUser:       perfil.tRolUser,
    uid:            user.id,
  };
}
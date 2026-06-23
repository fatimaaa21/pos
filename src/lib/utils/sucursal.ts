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

// ─────────────────────────────────────────────────────────────
// Agregar al final de src/lib/utils/sucursal.ts
// (usa getSucursalContext, ya definido arriba en el mismo archivo)
// ─────────────────────────────────────────────────────────────

/**
 * Resuelve la sucursal a usar para iniciar turno o registrar una venta.
 *
 * - Empleado: su sucursal fija. Error si no tiene una asignada.
 * - Admin con sucursal específica seleccionada (cookie): esa.
 * - Admin con "Todas las sucursales" seleccionado:
 *     - 1 sola sucursal activa en el negocio → se resuelve automático (no hay ambigüedad real).
 *     - 2+ sucursales activas → error: debe elegir una específica desde el selector.
 */
export async function resolverSucursalVenta(): Promise<
  | { fkeCodCompany: string; fkeCodSucursal: string; uid: string }
  | { error: string }
> {
  const ctx = await getSucursalContext();

  if (ctx.tRolUser === "empleado") {
    if (!ctx.fkeCodSucursal) {
      return { error: "El empleado no tiene una sucursal asignada" };
    }
    return {
      fkeCodCompany:  ctx.fkeCodCompany,
      fkeCodSucursal: ctx.fkeCodSucursal,
      uid:            ctx.uid,
    };
  }

  // Admin con sucursal específica ya elegida en el selector
  if (ctx.fkeCodSucursal) {
    return {
      fkeCodCompany:  ctx.fkeCodCompany,
      fkeCodSucursal: ctx.fkeCodSucursal,
      uid:            ctx.uid,
    };
  }

  // Admin con "Todas las sucursales" — solo es ambiguo si hay más de una
  const adminClient = createAdminClient();
  const { data: sucursales } = await adminClient
    .from("sucursales")
    .select("eCodSucursal")
    .eq("fkeCodCompany", ctx.fkeCodCompany)
    .eq("bStateSucursal", true);

  if (!sucursales || sucursales.length === 0) {
    return { error: "No hay sucursales activas configuradas para este negocio" };
  }

  if (sucursales.length === 1) {
    return {
      fkeCodCompany:  ctx.fkeCodCompany,
      fkeCodSucursal: sucursales[0].eCodSucursal,
      uid:            ctx.uid,
    };
  }

  return {
    error: "Selecciona una sucursal específica desde el menú superior para poder vender",
  };
}
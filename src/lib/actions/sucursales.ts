"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath }    from "next/cache";
import { cookies }           from "next/headers";
import type { Sucursal }     from "@/types";

const COOKIE_SUCURSAL = "kivi_sucursal_activa";

// ─────────────────────────────────────────────────────────────
// COOKIE — sucursal activa del admin
// ─────────────────────────────────────────────────────────────

export async function getSucursalActivaCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_SUCURSAL)?.value ?? null;
}

export async function setSucursalActivaCookie(eCodSucursal: string) {
  const cookieStore = await cookies();
  if (!eCodSucursal) {
    cookieStore.delete(COOKIE_SUCURSAL);
    return;
  }
  cookieStore.set(COOKIE_SUCURSAL, eCodSucursal, {
    httpOnly: false,
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 30,
  });
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

async function getPerfilActual() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("eCodUser, fkeCodCompany, fkeCodSucursal, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  return perfil ? { ...perfil, uid: user.id } : null;
}

// ─────────────────────────────────────────────────────────────
// OBTENER SUCURSALES DEL NEGOCIO
// ─────────────────────────────────────────────────────────────

export async function obtenerSucursales(): Promise<Sucursal[]> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return [];

  const adminClient = createAdminClient();

  const { data } = await adminClient
    .from("sucursales")
    .select("*")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("bStateSucursal", true)
    .order("fhCreateSucursal");

  return (data as Sucursal[]) ?? [];
}

// ─────────────────────────────────────────────────────────────
// CREAR SUCURSAL
// ─────────────────────────────────────────────────────────────

export async function crearSucursal(
  tNombre:     string,
  tDireccion?: string
): Promise<{ sucursal: Sucursal } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  // Restricción: máximo 2 sucursales por defecto
  const { count } = await adminClient
    .from("sucursales")
    .select("eCodSucursal", { count: "exact", head: true })
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("bStateSucursal", true);

  if ((count ?? 0) >= 2) {
    return { error: "Tu plan incluye máximo 2 sucursales. Contacta a Kivi para agregar más." };
  }

  const { data, error } = await adminClient
    .from("sucursales")
    .insert({
      fkeCodCompany:    perfil.fkeCodCompany,
      tNombre:          tNombre.trim(),
      tDireccion:       tDireccion?.trim() ?? null,
      bStateSucursal:   true,
      fhCreateSucursal: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes("unique")) return { error: "Ya existe una sucursal con ese nombre" };
    return { error: `Error al crear sucursal: ${error.message}` };
  }

  revalidatePath("/admin");
  return { sucursal: data as Sucursal };
}

// ─────────────────────────────────────────────────────────────
// EDITAR SUCURSAL
// ─────────────────────────────────────────────────────────────

export async function editarSucursal(
  eCodSucursal: string,
  tNombre:      string,
  tDireccion?:  string
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { data: sucursal } = await adminClient
    .from("sucursales")
    .select("fkeCodCompany")
    .eq("eCodSucursal", eCodSucursal)
    .single();

  if (!sucursal || sucursal.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }

  const { error } = await adminClient
    .from("sucursales")
    .update({
      tNombre:    tNombre.trim(),
      tDireccion: tDireccion?.trim() ?? null,
    })
    .eq("eCodSucursal", eCodSucursal);

  if (error) return { error: `Error al editar: ${error.message}` };

  revalidatePath("/admin");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// TOGGLE SUCURSAL
// ─────────────────────────────────────────────────────────────

export async function toggleSucursal(
  eCodSucursal:  string,
  bStateSucursal: boolean
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { data: sucursal } = await adminClient
    .from("sucursales")
    .select("fkeCodCompany")
    .eq("eCodSucursal", eCodSucursal)
    .single();

  if (!sucursal || sucursal.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }

  const { error } = await adminClient
    .from("sucursales")
    .update({ bStateSucursal })
    .eq("eCodSucursal", eCodSucursal);

  if (error) return { error: `Error al actualizar: ${error.message}` };

  revalidatePath("/admin");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// ELIMINAR SUCURSAL (hard delete)
// Bloqueado si tiene empleados o ventas asociadas.
// Agregar al final de src/lib/actions/sucursales.ts
// ─────────────────────────────────────────────────────────────

export async function eliminarSucursal(
  eCodSucursal: string
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  // Verificar propiedad
  const { data: sucursal } = await adminClient
    .from("sucursales")
    .select("fkeCodCompany")
    .eq("eCodSucursal", eCodSucursal)
    .single();

  if (!sucursal || sucursal.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }

  // Bloquear si tiene empleados asignados
  const { count: empleados } = await adminClient
    .from("perfiles")
    .select("eCodUser", { count: "exact", head: true })
    .eq("fkeCodSucursal", eCodSucursal);

  if ((empleados ?? 0) > 0) {
    return { error: "No puedes eliminar una sucursal con empleados asignados. Reasígnalos primero." };
  }

  // Bloquear si tiene ventas registradas
  const { count: ventas } = await adminClient
    .from("ventas")
    .select("eCodVenta", { count: "exact", head: true })
    .eq("fkeCodSucursal", eCodSucursal);

  if ((ventas ?? 0) > 0) {
    return { error: "No puedes eliminar una sucursal con ventas registradas. Desactívala en su lugar." };
  }

  const { error } = await adminClient
    .from("sucursales")
    .delete()
    .eq("eCodSucursal", eCodSucursal);

  if (error) return { error: `Error al eliminar: ${error.message}` };

  revalidatePath("/admin");
  return { ok: true };
}
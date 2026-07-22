"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSucursalContext } from "@/lib/utils/sucursal";

async function getPerfilActual() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("eCodUser, fkeCodCompany, fkeCodSucursal, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  return perfil ? { ...perfil, uid: user.id } : null;
}

/**
 * Busca cuentas ABIERTAS que matcheen el nombre (parcial). Devuelve contexto
 * para que el cajero distinga homónimos — NUNCA auto-selecciona.
 */
export async function buscarCuentasAbiertas(
  nombre: string
): Promise<{ cuentas: { eCodCuenta: string; tIdentificador: string; fhApertura: string }[] } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("cuentas")
    .select("eCodCuenta, tIdentificador, fhApertura")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("bAbierta", true)
    .ilike("tIdentificador", `%${nombre}%`)
    .order("fhApertura", { ascending: false })
    .limit(10);

  if (error) return { error: error.message };
  return { cuentas: data ?? [] };
}

/** Crea una cuenta nueva — se llama tras confirmar que ninguna existente aplica. */
export async function crearCuenta(
  nombre: string
): Promise<{ cuenta: { eCodCuenta: string; tIdentificador: string; fhApertura: string } } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return { error: "No autenticado" };
  if (!nombre?.trim()) return { error: "El nombre no puede estar vacío" };

  const adminClient = createAdminClient();

  const { data: negocio } = await adminClient
    .from("negocios")
    .select("tipo_negocio")
    .eq("eCodCompany", perfil.fkeCodCompany)
    .single();

  if (negocio?.tipo_negocio !== "billar") {
    return { error: "Las cuentas solo aplican a negocios tipo billar" };
  }

  const ctx = await getSucursalContext();

  const { data, error } = await adminClient
    .from("cuentas")
    .insert({
      tIdentificador: nombre.trim(),
      fkeCodCompany:  perfil.fkeCodCompany,
      fkeCodSucursal: ctx.fkeCodSucursal ?? null,
    })
    .select("eCodCuenta, tIdentificador, fhApertura")
    .single();

  if (error || !data) return { error: error?.message ?? "No se pudo crear la cuenta" };
  return { cuenta: data };
}

/** Renombra una cuenta abierta — usado para reemplazar el nombre genérico
 * ("Mesa 1") por el nombre real en cuanto se sabe que hay más de un jugador. */
export async function renombrarCuenta(
  eCodCuenta: string,
  nuevoNombre: string
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return { error: "No autenticado" };
  if (!nuevoNombre?.trim()) return { error: "El nombre no puede estar vacío" };

  const adminClient = createAdminClient();

  const { data: cuenta } = await adminClient
    .from("cuentas")
    .select("fkeCodCompany, bAbierta")
    .eq("eCodCuenta", eCodCuenta)
    .single();

  if (!cuenta || cuenta.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };
  if (!cuenta.bAbierta) return { error: "Esta cuenta ya fue cobrada" };

  const { error: errUpdate } = await adminClient
    .from("cuentas")
    .update({ tIdentificador: nuevoNombre.trim() })
    .eq("eCodCuenta", eCodCuenta);

  if (errUpdate) return { error: errUpdate.message };
  return { ok: true };
}

/** Datos básicos de una cuenta por ID — usado cuando solo se tiene el ID
 * (ej. tras seleccionar en ModalBuscarCuenta) y se necesita mostrar el
 * nombre antes de confirmar una acción, como el cobro suelto. */
export async function obtenerCuenta(
  eCodCuenta: string
): Promise<{ eCodCuenta: string; tIdentificador: string; bAbierta: boolean } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return { error: "No autenticado" };

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("cuentas")
    .select("eCodCuenta, tIdentificador, bAbierta, fkeCodCompany")
    .eq("eCodCuenta", eCodCuenta)
    .single();

  if (error || !data) return { error: "Cuenta no encontrada" };
  if (data.fkeCodCompany !== perfil.fkeCodCompany) return { error: "Sin acceso" };

  return { eCodCuenta: data.eCodCuenta, tIdentificador: data.tIdentificador, bAbierta: data.bAbierta };
}
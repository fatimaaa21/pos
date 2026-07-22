"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath }    from "next/cache";
import type { ConceptoBillar } from "@/types";

async function getPerfilActual() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("eCodUser, fkeCodCompany, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  return perfil ? { ...perfil, uid: user.id } : null;
}

// ─────────────────────────────────────────────────────────────
// OBTENER CONCEPTOS (activos e inactivos, para la pantalla de admin)
// ─────────────────────────────────────────────────────────────

export async function obtenerConceptosBillar(): Promise<ConceptoBillar[]> {
  const perfil = await getPerfilActual();
  if (!perfil?.fkeCodCompany) return [];

  const adminClient = createAdminClient();

  const { data } = await adminClient
    .from("conceptos_billar")
    .select("*")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .order("fhCreate");

  return data ?? [];
}

// ─────────────────────────────────────────────────────────────
// CREAR CONCEPTO
// ─────────────────────────────────────────────────────────────

export async function crearConceptoBillar(
  tNombre: string,
  eCostoHora: number
): Promise<{ ok: true; eCodConcepto: string } | { error: string }> {
  const nombre = tNombre.trim();
  if (!nombre) return { error: "El nombre es requerido" };
  if (!Number.isFinite(eCostoHora) || eCostoHora <= 0) {
    return { error: "El costo por hora debe ser un número mayor a 0" };
  }

  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  // Evitar duplicados obvios (mismo nombre, activo) dentro del negocio
  const { data: existente } = await adminClient
    .from("conceptos_billar")
    .select("eCodConcepto")
    .eq("fkeCodCompany", perfil.fkeCodCompany)
    .eq("tNombre", nombre)
    .eq("bActivo", true)
    .maybeSingle();

  if (existente) return { error: `Ya existe un concepto activo llamado "${nombre}"` };

  const { data, error } = await adminClient
    .from("conceptos_billar")
    .insert({
      fkeCodCompany: perfil.fkeCodCompany,
      tNombre:       nombre,
      eCostoHora,
      bActivo:       true,
    })
    .select("eCodConcepto")
    .single();

  if (error || !data) return { error: `Error al crear concepto: ${error?.message}` };

  revalidatePath("/admin/mesas");
  revalidatePath("/admin/configuracion");
  return { ok: true, eCodConcepto: data.eCodConcepto };
}

// ─────────────────────────────────────────────────────────────
// EDITAR CONCEPTO (nombre y/o costo por hora)
// ─────────────────────────────────────────────────────────────

export async function editarConceptoBillar(
  eCodConcepto: string,
  tNombre: string,
  eCostoHora: number
): Promise<{ ok: true } | { error: string }> {
  const nombre = tNombre.trim();
  if (!nombre) return { error: "El nombre es requerido" };
  if (!Number.isFinite(eCostoHora) || eCostoHora <= 0) {
    return { error: "El costo por hora debe ser un número mayor a 0" };
  }

  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { data: concepto } = await adminClient
    .from("conceptos_billar")
    .select("fkeCodCompany")
    .eq("eCodConcepto", eCodConcepto)
    .single();

  if (!concepto || concepto.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }

  const { error } = await adminClient
    .from("conceptos_billar")
    .update({ tNombre: nombre, eCostoHora })
    .eq("eCodConcepto", eCodConcepto);

  if (error) return { error: `Error al editar: ${error.message}` };

  // NOTA: esto NO recalcula segmentos ya cerrados ni órdenes en curso — el
  // cambio de tarifa aplica hacia adelante. Un segmento con una mesa abierta
  // ahora mismo, a medio jugar, va a cobrar la tarifa vieja en la parte ya
  // transcurrida y la nueva en el resto, porque el cálculo en cobrarOrdenMesa
  // usa el costo ACTUAL del concepto sobre el tiempo TOTAL transcurrido —
  // no prorratea por el momento del cambio. Si cambias una tarifa con mesas
  // de ese concepto ocupadas en este momento, el cobro de esas mesas va a
  // usar la tarifa nueva retroactivamente sobre todo el tiempo jugado, no
  // solo desde el cambio. Esto puede sorprender al cliente si sube el precio
  // a medio partido.
  revalidatePath("/admin/mesas");
  revalidatePath("/empleado/mesas");
  revalidatePath("/admin/configuracion");
  
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// DESACTIVAR / REACTIVAR CONCEPTO
// No borra: si mesas o segmentos_tiempo lo referencian, un DELETE real
// rompería historial de ventas o fallaría por FK constraint.
// ─────────────────────────────────────────────────────────────

export async function toggleConceptoBillar(
  eCodConcepto: string,
  bActivo: boolean
): Promise<{ ok: true } | { error: string }> {
  const perfil = await getPerfilActual();
  if (!perfil) return { error: "No autenticado" };
  if (perfil.tRolUser !== "admin") return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { data: concepto } = await adminClient
    .from("conceptos_billar")
    .select("fkeCodCompany")
    .eq("eCodConcepto", eCodConcepto)
    .single();

  if (!concepto || concepto.fkeCodCompany !== perfil.fkeCodCompany) {
    return { error: "Sin acceso" };
  }

  // Al desactivar: verificar que ninguna mesa activa siga apuntando a este
  // concepto. Si la dejas desactivada con mesas todavía asignadas, esas
  // mesas van a fallar el guard de abrirOrdenMesa/abrirMesaLayout ("mesa sin
  // concepto de cobro asignado" solo dispara si fkeCodConcepto es NULL, NO
  // si apunta a un concepto inactivo) — es decir, HOY ese guard no cubre
  // este caso. Bloqueo aquí en vez de dejar que revienta después al abrir mesa.
  if (!bActivo) {
    const { data: mesasConEsteConcepto } = await adminClient
      .from("mesas")
      .select("eCodMesa, tNombre")
      .eq("fkeCodConcepto", eCodConcepto)
      .eq("bStateMesa", true);

    if (mesasConEsteConcepto && mesasConEsteConcepto.length > 0) {
      const nombres = mesasConEsteConcepto.map((m) => m.tNombre).join(", ");
      return {
        error: `No puedes desactivar este concepto: las mesas ${nombres} todavía lo tienen asignado. Reasígnalas a otro concepto primero.`,
      };
    }
  }

  const { error } = await adminClient
    .from("conceptos_billar")
    .update({ bActivo })
    .eq("eCodConcepto", eCodConcepto);

  if (error) return { error: `Error al actualizar: ${error.message}` };

  revalidatePath("/admin/mesas");
  revalidatePath("/empleado/mesas");
  revalidatePath("/admin/configuracion");
  
  return { ok: true };
}
// src/lib/actions/conceptos-billar.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { revalidatePath }    from "next/cache";
import type { ConceptoBillar } from "@/types";

// ── Helper de auth ────────────────────────────────────────────────────────────

async function getFkeCodCompany(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil || perfil.tRolUser !== "admin") return null;
  return perfil.fkeCodCompany;
}

// ── Listar ────────────────────────────────────────────────────────────────────

export async function listarConceptosBillar(): Promise<ConceptoBillar[]> {
  const fkeCodCompany = await getFkeCodCompany();
  if (!fkeCodCompany) return [];

  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("conceptos_billar")
    .select("*")
    .eq("fkeCodCompany", fkeCodCompany)
    .eq("bActivo", true)
    .order("fhCreate");

  return (data as ConceptoBillar[]) ?? [];
}

// ── Crear ─────────────────────────────────────────────────────────────────────

export async function crearConceptoBillar(
  tNombre: string,
  eCostoHora: number
): Promise<{ error: string } | ConceptoBillar> {
  const fkeCodCompany = await getFkeCodCompany();
  if (!fkeCodCompany) return { error: "No autorizado" };

  if (!tNombre.trim()) return { error: "El nombre es obligatorio" };
  if (!Number.isFinite(eCostoHora) || eCostoHora <= 0) return { error: "Costo inválido" };

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("conceptos_billar")
    .insert({
      fkeCodCompany,
      tNombre:    tNombre.trim(),
      eCostoHora,
      bActivo:    true,
    })
    .select("*")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/mesas");
  revalidatePath("/empleado/mesas");
  return data as ConceptoBillar;
}

// ── Actualizar ────────────────────────────────────────────────────────────────

export async function actualizarConceptoBillar(
  eCodConcepto: string,
  tNombre: string,
  eCostoHora: number
): Promise<{ error: string } | { ok: true }> {
  const fkeCodCompany = await getFkeCodCompany();
  if (!fkeCodCompany) return { error: "No autorizado" };

  if (!tNombre.trim()) return { error: "El nombre es obligatorio" };
  if (!Number.isFinite(eCostoHora) || eCostoHora <= 0) return { error: "Costo inválido" };

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("conceptos_billar")
    .update({ tNombre: tNombre.trim(), eCostoHora })
    .eq("eCodConcepto", eCodConcepto)
    .eq("fkeCodCompany", fkeCodCompany);

  if (error) return { error: error.message };

  revalidatePath("/admin/configuracion");
  revalidatePath("/admin/mesas");
  revalidatePath("/empleado/mesas");
  return { ok: true };
}

// ── Eliminar ──────────────────────────────────────────────────────────────────
// Bloquea el borrado si hay mesas usando el concepto — evita dejar mesas
// "huérfanas" sin tarifa, que romperían el cobro en cobrarOrdenMesa.

export async function eliminarConceptoBillar(
  eCodConcepto: string
): Promise<{ error: string } | { ok: true }> {
  const fkeCodCompany = await getFkeCodCompany();
  if (!fkeCodCompany) return { error: "No autorizado" };

  const adminClient = createAdminClient();

  const { count } = await adminClient
    .from("mesas")
    .select("eCodMesa", { count: "exact", head: true })
    .eq("fkeCodConcepto", eCodConcepto);

  if (count && count > 0) {
    return { error: `Hay ${count} mesa(s) usando este concepto. Reasígnalas antes de eliminarlo.` };
  }

  const { error } = await adminClient
    .from("conceptos_billar")
    .delete()
    .eq("eCodConcepto", eCodConcepto)
    .eq("fkeCodCompany", fkeCodCompany);

  if (error) return { error: error.message };

  revalidatePath("/admin/configuracion");
  return { ok: true };
}

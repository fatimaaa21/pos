"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Presentacion } from "@/types";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function obtenerPresentaciones(
  eCodProduct: string
): Promise<{ presentaciones?: Presentacion[]; error?: string }> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("presentaciones")
      .select("*")
      .eq("fkeCodProduct", eCodProduct)
      .order("fhCreate", { ascending: true });

    if (error) return { error: error.message };
    return { presentaciones: (data as Presentacion[]) ?? [] };
  } catch (e: any) {
    return { error: e?.message ?? "Error desconocido" };
  }
}

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function crearPresentacion(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const fkeCodProduct      = formData.get("fkeCodProduct") as string;
    const tNombre            = (formData.get("tNombre") as string)?.trim();
    const ePricePresentacion = parseFloat(formData.get("ePricePresentacion") as string);
    const eCostPresentacion  = parseFloat(formData.get("eCostPresentacion") as string) || 0;

    if (!fkeCodProduct || !tNombre || isNaN(ePricePresentacion) || ePricePresentacion < 0) {
      return { error: "Nombre y precio son obligatorios" };
    }

    const ahora = new Date().toISOString();
    const { data, error } = await adminClient
      .from("presentaciones")
      .insert({
        fkeCodProduct,
        tNombre,
        ePricePresentacion,
        eCostPresentacion,
        bStatePresentacion: true,
        fhCreate: ahora,
        fhUpdate: ahora,
      })
      .select()
      .single();

    if (error) return { error: `Error al crear presentación: ${error.message}` };

    revalidatePath("/admin/productos");
    return { presentacion: data as Presentacion };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function editarPresentacion(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const eCodPresentacion   = formData.get("eCodPresentacion") as string;
    const tNombre            = (formData.get("tNombre") as string)?.trim();
    const ePricePresentacion = parseFloat(formData.get("ePricePresentacion") as string);
    const eCostPresentacion  = parseFloat(formData.get("eCostPresentacion") as string) || 0;

    if (!eCodPresentacion || !tNombre || isNaN(ePricePresentacion)) {
      return { error: "Datos inválidos" };
    }

    const { data, error } = await adminClient
      .from("presentaciones")
      .update({
        tNombre,
        ePricePresentacion,
        eCostPresentacion,
        fhUpdate: new Date().toISOString(),
      })
      .eq("eCodPresentacion", eCodPresentacion)
      .select()
      .single();

    if (error) return { error: `Error al editar: ${error.message}` };

    revalidatePath("/admin/productos");
    return { presentacion: data as Presentacion };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function eliminarPresentacion(eCodPresentacion: string) {
  try {
    const adminClient = createAdminClient();

    // Bloquear si tiene inventario activo
    const { data: invActivo } = await adminClient
      .from("inventario")
      .select("eCodInventory")
      .eq("fkeCodPresentacion", eCodPresentacion)
      .eq("bStateInventory", true)
      .limit(1);

    if (invActivo && invActivo.length > 0) {
      return {
        error:
          "No puedes eliminar esta presentación porque tiene inventario activo. " +
          "Desactívala o espera a que se agote el stock.",
      };
    }

    const { error } = await adminClient
      .from("presentaciones")
      .delete()
      .eq("eCodPresentacion", eCodPresentacion);

    if (error) return { error: `Error al eliminar: ${error.message}` };

    revalidatePath("/admin/productos");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

// ── TOGGLE ESTADO ─────────────────────────────────────────────────────────────

export async function toggleEstadoPresentacion(eCodPresentacion: string, nuevoEstado: boolean) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("presentaciones")
      .update({ bStatePresentacion: nuevoEstado, fhUpdate: new Date().toISOString() })
      .eq("eCodPresentacion", eCodPresentacion);

    if (error) return { error: error.message };

    revalidatePath("/admin/productos");
    return { ok: true };
  } catch (e: any) {
    return { error: e?.message };
  }
}
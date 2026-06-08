"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { revalidatePath }    from "next/cache";
import type { Material }     from "@/types";

export async function getMateriales(): Promise<Material[]> {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return [];

    const { data, error } = await adminClient
      .from("materiales")
      .select("*")
      .eq("fkeCodCompany", perfil.fkeCodCompany)
      .order("fhCreateMaterial", { ascending: false });

    if (error) { console.error(error); return []; }
    return data as Material[];
  } catch { return []; }
}

export async function crearMaterial(formData: FormData) {
  try {
    const supabase    = await createClient();
    const adminClient = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return { error: "Negocio no encontrado" };

    const tNombre         = (formData.get("tNombre") as string)?.trim();
    const tipo_material   = formData.get("tipo_material") as "rollo" | "hoja";
    const eMetrosLineales = parseFloat(formData.get("eMetrosLineales") as string);
    const eAnchoCmRaw     = formData.get("eAnchoCm") as string;
    const eAnchoCm        = eAnchoCmRaw ? parseFloat(eAnchoCmRaw) : null;
    const eAltoCmRaw      = formData.get("eAltoCm") as string;
    const eAltoCm         = eAltoCmRaw ? parseFloat(eAltoCmRaw) : null;
    const eStockMinimo = parseFloat(formData.get("eStockMinimo") as string) || 0;

    if (!tNombre)
      return { error: "El nombre es requerido" };
    if (!["rollo", "hoja"].includes(tipo_material))
      return { error: "Tipo de material inválido" };
    if (isNaN(eMetrosLineales) || eMetrosLineales <= 0)
      return { error: tipo_material === "rollo"
        ? "Los metros lineales deben ser mayores a 0"
        : "La cantidad de hojas debe ser mayor a 0" };
    if (tipo_material === "rollo" && (!eAnchoCm || isNaN(eAnchoCm) || eAnchoCm <= 0))
      return { error: "El ancho del rollo es requerido y debe ser mayor a 0" };
    if (tipo_material === "hoja" && (!eAnchoCm || isNaN(eAnchoCm) || eAnchoCm <= 0))
      return { error: "El ancho de la hoja es requerido y debe ser mayor a 0" };
    if (tipo_material === "hoja" && (!eAltoCm || isNaN(eAltoCm) || eAltoCm <= 0))
      return { error: "El alto de la hoja es requerido y debe ser mayor a 0" };

    const ahora = new Date().toISOString();
    const { data, error } = await adminClient
      .from("materiales")
      .insert({
        fkeCodCompany:    perfil.fkeCodCompany,
        tNombre,
        tipo_material,
        eAnchoCm,
        eAltoCm:          tipo_material === "hoja" ? eAltoCm : null,
        eMetrosLineales,
        eStockMinimo,
        bStateMaterial:    true,
        fhCreateMaterial: ahora,
        fhUpdateMaterial: ahora,
      })
      .select()
      .single();

    if (error) return { error: `Error al crear material: ${error.message}` };

    revalidatePath("/admin/inventario");
    return { material: data as Material };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function editarMaterial(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const eCodMaterial    = formData.get("eCodMaterial")    as string;
    const tNombre         = (formData.get("tNombre") as string)?.trim();
    const tipo_material   = formData.get("tipo_material")   as "rollo" | "hoja";
    const eMetrosLineales = parseFloat(formData.get("eMetrosLineales") as string);
    const eAnchoCmRaw     = formData.get("eAnchoCm")        as string;
    const eAnchoCm        = eAnchoCmRaw ? parseFloat(eAnchoCmRaw) : null;
    const eAltoCmRaw      = formData.get("eAltoCm")         as string;
    const eAltoCm         = eAltoCmRaw ? parseFloat(eAltoCmRaw) : null;
    const eStockMinimo = parseFloat(formData.get("eStockMinimo") as string) || 0;

    if (!tNombre)
      return { error: "El nombre es requerido" };
    if (isNaN(eMetrosLineales) || eMetrosLineales < 0)
      return { error: "Cantidad inválida" };
    if (tipo_material === "rollo" && (!eAnchoCm || isNaN(eAnchoCm) || eAnchoCm <= 0))
      return { error: "El ancho del rollo es requerido" };
    if (tipo_material === "hoja" && (!eAnchoCm || isNaN(eAnchoCm) || eAnchoCm <= 0))
      return { error: "El ancho de la hoja es requerido" };
    if (tipo_material === "hoja" && (!eAltoCm || isNaN(eAltoCm) || eAltoCm <= 0))
      return { error: "El alto de la hoja es requerido" };

    const { data, error } = await adminClient
      .from("materiales")
      .update({
        tNombre,
        tipo_material,
        eAnchoCm,
        eAltoCm:          tipo_material === "hoja" ? eAltoCm : null,
        eMetrosLineales,
        eStockMinimo,
        fhUpdateMaterial: new Date().toISOString(),
      })
      .eq("eCodMaterial", eCodMaterial)
      .select()
      .single();

    if (error) return { error: `Error al editar: ${error.message}` };

    revalidatePath("/admin/inventario");
    return { material: data as Material };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function toggleEstadoMaterial(eCodMaterial: string, nuevoEstado: boolean) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("materiales")
      .update({
        bStateMateria:    nuevoEstado,
        fhUpdateMaterial: new Date().toISOString(),
      })
      .eq("eCodMaterial", eCodMaterial);

    if (error) return { error: error.message };

    revalidatePath("/admin/inventario");
    return { ok: true };
  } catch (e: any) {
    return { error: e?.message };
  }
}

export async function eliminarMaterial(eCodMaterial: string) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("materiales")
      .delete()
      .eq("eCodMaterial", eCodMaterial);

    if (error) return { error: `Error al eliminar: ${error.message}` };

    revalidatePath("/admin/inventario");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
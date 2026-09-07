"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Presentacion } from "@/types";

async function getPerfilActual(): Promise<{ fkeCodCompany: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil?.fkeCodCompany) return null;

  return { fkeCodCompany: perfil.fkeCodCompany };
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function obtenerPresentaciones(
  eCodProduct: string
): Promise<{ presentaciones?: Presentacion[]; error?: string }> {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: producto, error: errorProducto } = await adminClient
      .from("productos")
      .select("fkeCodCompany")
      .eq("eCodProduct", eCodProduct)
      .single();

    if (errorProducto || !producto) return { error: "Producto no encontrado" };
    if (producto.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

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
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const fkeCodProduct      = formData.get("fkeCodProduct") as string;
    const tNombre            = (formData.get("tNombre") as string)?.trim();
    const ePricePresentacion = parseFloat(formData.get("ePricePresentacion") as string);
    const eCostPresentacion  = parseFloat(formData.get("eCostPresentacion")  as string) || 0;
    const eCantidadUnidades  = parseInt(formData.get("eCantidadUnidades")    as string) || 1;

    if (!fkeCodProduct || !tNombre || isNaN(ePricePresentacion) || ePricePresentacion < 0) {
      return { error: "Nombre y precio son obligatorios" };
    }
    if (eCantidadUnidades < 1) {
      return { error: "La cantidad de unidades debe ser al menos 1" };
    }

    const { data: producto, error: errorProducto } = await adminClient
      .from("productos")
      .select("fkeCodCompany")
      .eq("eCodProduct", fkeCodProduct)
      .single();

    if (errorProducto || !producto) return { error: "Producto no encontrado" };
    if (producto.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const ahora = new Date().toISOString();
    const { data, error } = await adminClient
      .from("presentaciones")
      .insert({
        fkeCodProduct,
        tNombre,
        ePricePresentacion,
        eCostPresentacion,
        eCantidadUnidades,
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
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const eCodPresentacion   = formData.get("eCodPresentacion") as string;
    const tNombre            = (formData.get("tNombre") as string)?.trim();
    const ePricePresentacion = parseFloat(formData.get("ePricePresentacion") as string);
    const eCostPresentacion  = parseFloat(formData.get("eCostPresentacion")  as string) || 0;
    const eCantidadUnidades  = parseInt(formData.get("eCantidadUnidades")    as string) || 1;

    if (!eCodPresentacion || !tNombre || isNaN(ePricePresentacion)) {
      return { error: "Datos inválidos" };
    }

    const { data: presentacionActual, error: errorLectura } = await adminClient
      .from("presentaciones")
      .select("fkeCodProduct, productos(fkeCodCompany)")
      .eq("eCodPresentacion", eCodPresentacion)
      .single();

    if (errorLectura || !presentacionActual) return { error: "Presentación no encontrada" };

    const productoInfo = (presentacionActual as any).productos;
    if (productoInfo?.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { data, error } = await adminClient
      .from("presentaciones")
      .update({
        tNombre,
        ePricePresentacion,
        eCostPresentacion,
        eCantidadUnidades,
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
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: presentacionActual, error: errorLectura } = await adminClient
      .from("presentaciones")
      .select("fkeCodProduct, productos(fkeCodCompany)")
      .eq("eCodPresentacion", eCodPresentacion)
      .single();

    if (errorLectura || !presentacionActual) return { error: "Presentación no encontrada" };

    const productoInfo = (presentacionActual as any).productos;
    if (productoInfo?.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

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
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: presentacionActual, error: errorLectura } = await adminClient
      .from("presentaciones")
      .select("productos(fkeCodCompany)")
      .eq("eCodPresentacion", eCodPresentacion)
      .single();

    if (errorLectura || !presentacionActual) return { error: "Presentación no encontrada" };

    const productoInfo = (presentacionActual as any).productos;
    if (productoInfo?.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

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
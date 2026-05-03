"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Categoria } from "@/types";
import { revalidatePath } from "next/cache";


export async function crearCategoria(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const tNameCategory = formData.get("tNameCategory") as string;
    const ImgCategory = formData.get("ImgCategory") as string;

    const { data: categoria, error: categoriaError } = await adminClient
      .from("categorias")
      .insert({
        tNameCategory,
        ImgCategory,
        bStateCategory: true,
        fhCreateCategory: new Date().toISOString(),
      })
      .select()
      .single();

    if (categoriaError) {
      return { error: `Error al crear categoría: ${categoriaError.message}` };
    }

    revalidatePath("/admin/catalogo");
    return { categoria: categoria as Categoria };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function editarCategoria(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const eCodCategory = formData.get("eCodCategory") as string;
    const tNameCategory = formData.get("tNameCategory") as string;
    const ImgCategory = formData.get("ImgCategory") as string;

    const { data: categoria, error } = await adminClient
      .from("categorias")
      .update({
        tNameCategory,
        ImgCategory,
        fhUpdateCategory: new Date().toISOString(),
      })
      .eq("eCodCategory", eCodCategory)
      .select()
      .single();

    if (error) return { error: `Error al actualizar categoría: ${error.message}` };

    revalidatePath("/admin/catalogo");
    return { categoria: categoria as Categoria };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function toggleEstadoCategoria(eCodCategory: string, nuevoEstado: boolean) {
  try {
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("categorias")
      .update({
        bStateCategory: nuevoEstado,
        fhUpdateCategory: new Date().toISOString(),
      })
      .eq("eCodCategory", eCodCategory);

    if (error) return { error: `Error al actualizar estado: ${error.message}` };

    revalidatePath("/admin/catalogo");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function eliminarCategoria(eCodCategory: string) {
  try {
    const adminClient = createAdminClient();

    // Verificar si hay productos asociados a esta categoría
    const { data: productosAsociados, error: errorConsulta } = await adminClient
      .from("productos")
      .select("eCodProduct")
      .eq("fkeCodCategory", eCodCategory)
      .limit(1);

    if (errorConsulta) {
      return { error: `Error al verificar productos asociados: ${errorConsulta.message}` };
    }

    if (productosAsociados && productosAsociados.length > 0) {
      return { error: "No se puede eliminar la categoría porque tiene productos asociados. Desactívela en su lugar." };
    }

    const { error } = await adminClient
      .from("categorias")
      .delete()
      .eq("eCodCategory", eCodCategory);

    if (error) return { error: `Error al eliminar categoría: ${error.message}` };

    revalidatePath("/admin/catalogo");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Producto } from "@/types";
import { revalidatePath } from "next/cache";


export async function crearProducto(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const tNameProduct = formData.get("tNameProduct") as string;
    const ImgProduct = formData.get("ImgProduct") as string;
    const ePriceProduct = parseFloat(formData.get("ePriceProduct") as string);
    const eCostProduct = parseFloat(formData.get("eCostProduct") as string);
    const fkeCodCategory = formData.get("fkeCodCategory") as string;
    const { data: producto, error: productoError } = await adminClient
      .from("productos")
      .insert({
        tNameProduct,
        ImgProduct,
        ePriceProduct,
        eCostProduct,
        fkeCodCategory,
        bStateProduct: true,
        fhCreateProduct: new Date().toISOString(),
      })
      .select()
      .single();

    if (productoError) {
      return { error: `Error al crear producto: ${productoError.message}` };
    }

    revalidatePath("/admin/catalogo");
    return { producto: producto as Producto };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function editarProducto(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const eCodProduct = formData.get("eCodProduct") as string;
    const tNameProduct = formData.get("tNameProduct") as string;
    const ImgProduct = formData.get("ImgProduct") as string;
    const ePriceProduct = parseFloat(formData.get("ePriceProduct") as string);
    const eCostProduct = parseFloat(formData.get("eCostProduct") as string);
    const fkeCodCategory = formData.get("fkeCodCategory") as string;

    const { data: producto, error } = await adminClient
      .from("productos")
      .update({
        tNameProduct,
        ImgProduct,
        ePriceProduct,
        eCostProduct,
        fkeCodCategory,
        fhUpdateProduct : new Date().toISOString(),
      })
      .eq("eCodProduct", eCodProduct)
      .select()
      .single();

    if (error) return { error: `Error al actualizar producto: ${error.message}` };

    revalidatePath("/admin/catalogo");
    return { producto: producto as Producto };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function toggleEstadoProducto(eCodProduct: string, nuevoEstado: boolean) {
  try {
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("productos")
      .update({
        bStateProduct: nuevoEstado,
        fhUpdateProduct: new Date().toISOString(),
      })
      .eq("eCodProduct", eCodProduct);

    if (error) return { error: `Error al actualizar estado: ${error.message}` };

    revalidatePath("/admin/catalogo");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function eliminarProducto(eCodProduct: string) {
  try {
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from("productos")
      .delete()
      .eq("eCodProduct", eCodProduct);

    if (error) return { error: `Error al eliminar producto: ${error.message}` };

    revalidatePath("/admin/catalogo");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
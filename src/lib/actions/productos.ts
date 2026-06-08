"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Producto } from "@/types";
import { revalidatePath } from "next/cache";


export async function crearProducto(formData: FormData) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    // Obtener el negocio del admin actual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return { error: "No se encontró el negocio" };

    const tNameProduct   = formData.get("tNameProduct") as string;
    const ImgProduct     = formData.get("ImgProduct") as string;
    const ePriceProduct  = parseFloat(formData.get("ePriceProduct") as string);
    const eCostProduct   = parseFloat(formData.get("eCostProduct") as string);
    const fkeCodCategory = formData.get("fkeCodCategory") as string;

    const { data: producto, error: productoError } = await adminClient
      .from("productos")
      .insert({
        fkeCodCompany:   perfil.fkeCodCompany,
        tNameProduct,
        ImgProduct:      ImgProduct || null,
        ePriceProduct,
        eCostProduct,
        fkeCodCategory,
        tipo_producto: (formData.get("tipo_producto") as string) || "unidad",
        ePrecioM2:     formData.get("ePrecioM2") ? parseFloat(formData.get("ePrecioM2") as string) : null,
        // Dimensiones para productos unidad en negocios de impresión
        eAnchoCm:      formData.get("eAnchoCm") ? parseFloat(formData.get("eAnchoCm") as string) : null,
        eAltoCm:       formData.get("eAltoCm")  ? parseFloat(formData.get("eAltoCm")  as string) : null,
        fkeCodMaterial: formData.get("fkeCodMaterial") || null,
        bStateProduct:   true,
        fhCreateProduct: new Date().toISOString(),
      })
      .select()
      .single();

    if (productoError) {
      return { error: `Error al crear producto: ${productoError.message}` };
    }

    revalidatePath("/admin/productos");
    revalidatePath("/admin/catalogo");
    return { producto: producto as Producto };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function editarProducto(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    // Nota: había un typo en el key original ("eCodProduct   " con espacios)
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
        ImgProduct: ImgProduct || null,
        ePriceProduct,
        eCostProduct,
        fkeCodCategory,
        tipo_producto: (formData.get("tipo_producto") as string) || "unidad",
        ePrecioM2:     formData.get("ePrecioM2") ? parseFloat(formData.get("ePrecioM2") as string) : null,
        // Dimensiones para productos unidad en negocios de impresión
        eAnchoCm:      formData.get("eAnchoCm") ? parseFloat(formData.get("eAnchoCm") as string) : null,
        eAltoCm:       formData.get("eAltoCm")  ? parseFloat(formData.get("eAltoCm")  as string) : null,
        fkeCodMaterial: formData.get("fkeCodMaterial") || null,
        fhUpdateProduct: new Date().toISOString(),
      })
      .eq("eCodProduct", eCodProduct)
      .select()
      .single();

    if (error) return { error: `Error al actualizar producto: ${error.message}` };

    revalidatePath("/admin/productos");
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

    revalidatePath("/admin/productos");
    revalidatePath("/admin/catalogo");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function eliminarProducto(eCodProduct: string) {
  try {
    const adminClient = createAdminClient();

    // 1. Antes de eliminar, averiguamos a qué categoría pertenece el producto
    const { data: productoActual, error: errorLectura } = await adminClient
      .from("productos")
      .select("fkeCodCategory")
      .eq("eCodProduct", eCodProduct)
      .single();

    if (errorLectura) {
      return { error: `Error al leer producto: ${errorLectura.message}` };
    }

    const categoriaDueña = productoActual?.fkeCodCategory as string | null;

    // 2. Eliminar el producto
    const { error: errorEliminar } = await adminClient
      .from("productos")
      .delete()
      .eq("eCodProduct", eCodProduct);

    if (errorEliminar) {
      return { error: `Error al eliminar producto: ${errorEliminar.message}` };
    }

    // 3. Si el producto tenía categoría, verificar si era el último
    //    y desactivar la categoría automáticamente si es así
    if (categoriaDueña) {
      const { count } = await adminClient
        .from("productos")
        .select("eCodProduct", { count: "exact", head: true })
        .eq("fkeCodCategory", categoriaDueña);

      if (count === 0) {
        await adminClient
          .from("categorias")
          .update({
            bStateCategory: false,
            fhUpdateCategory: new Date().toISOString(),
          })
          .eq("eCodCategory", categoriaDueña);
      }
    }

    revalidatePath("/admin/productos");
    revalidatePath("/admin/catalogo");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
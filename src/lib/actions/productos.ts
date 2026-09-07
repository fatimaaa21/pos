"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Producto } from "@/types";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────
// HELPER: verificar si un módulo está activo para un negocio
// (mismo patrón/tabla que verificarModuloMesas en mesas.ts)
// ─────────────────────────────────────────────────────────────

async function verificarModuloActivo(
  adminClient: ReturnType<typeof createAdminClient>,
  fkeCodCompany: string,
  modulo: string
): Promise<boolean> {
  const { data } = await adminClient
    .from("modulos_tenant")
    .select("bStateModulo")
    .eq("fkeCodCompany", fkeCodCompany)
    .eq("tModulo", modulo)
    .maybeSingle();

  return data?.bStateModulo === true;
}

export async function crearProducto(formData: FormData) {
  try {
    const adminClient = createAdminClient();
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return { error: "No se encontró el negocio" };

    const moduloCocinaActivo = await verificarModuloActivo(
      adminClient,
      perfil.fkeCodCompany,
      "cocina"
    );

    // Si el módulo de cocina no está activo, un producto nuevo no puede
    // nacer con bCocina=true — no hay valor previo que proteger aquí.
    const bCocina = moduloCocinaActivo && formData.get("bCocina") === "true";

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
        tipo_producto:  (formData.get("tipo_producto") as string) || "unidad",
        ePrecioM2:       formData.get("ePrecioM2") ? parseFloat(formData.get("ePrecioM2") as string) : null,
        eAnchoCm:        formData.get("eAnchoCm") ? parseFloat(formData.get("eAnchoCm") as string) : null,
        eAltoCm:         formData.get("eAltoCm")  ? parseFloat(formData.get("eAltoCm")  as string) : null,
        fkeCodMaterial:  formData.get("fkeCodMaterial") || null,
        bCocina,
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
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return { error: "No se encontró el negocio" };

    const eCodProduct = formData.get("eCodProduct") as string;

    // Verificar que el producto pertenece al negocio del usuario autenticado
    // antes de tocarlo — eCodProduct viene del cliente y no es confiable por sí solo.
    const { data: productoActual, error: errorLectura } = await adminClient
      .from("productos")
      .select("fkeCodCompany, bCocina")
      .eq("eCodProduct", eCodProduct)
      .single();

    if (errorLectura || !productoActual) {
      return { error: "Producto no encontrado" };
    }

    if (productoActual.fkeCodCompany !== perfil.fkeCodCompany) {
      return { error: "No autorizado" };
    }

    const moduloCocinaActivo = await verificarModuloActivo(
      adminClient,
      perfil.fkeCodCompany,
      "cocina"
    );

    // Si el módulo está inactivo, no se toca bCocina — se conserva el valor
    // existente en vez de forzarlo a false, para no alterar un campo que el
    // usuario ni siquiera ve al editar otra cosa (precio, nombre, etc.).
    const bCocina = moduloCocinaActivo
      ? formData.get("bCocina") === "true"
      : productoActual.bCocina;

    const tNameProduct   = formData.get("tNameProduct") as string;
    const ImgProduct     = formData.get("ImgProduct") as string;
    const ePriceProduct  = parseFloat(formData.get("ePriceProduct") as string);
    const eCostProduct   = parseFloat(formData.get("eCostProduct") as string);
    const fkeCodCategory = formData.get("fkeCodCategory") as string;

    const { data: producto, error } = await adminClient
      .from("productos")
      .update({
        tNameProduct,
        ImgProduct:      ImgProduct || null,
        ePriceProduct,
        eCostProduct,
        fkeCodCategory,
        tipo_producto:  (formData.get("tipo_producto") as string) || "unidad",
        ePrecioM2:       formData.get("ePrecioM2") ? parseFloat(formData.get("ePrecioM2") as string) : null,
        eAnchoCm:        formData.get("eAnchoCm") ? parseFloat(formData.get("eAnchoCm") as string) : null,
        eAltoCm:         formData.get("eAltoCm")  ? parseFloat(formData.get("eAltoCm")  as string) : null,
        fkeCodMaterial:  formData.get("fkeCodMaterial") || null,
        bCocina,
        fhUpdateProduct: new Date().toISOString(),
      })
      .eq("eCodProduct", eCodProduct)
      .eq("fkeCodCompany", perfil.fkeCodCompany)
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
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return { error: "No se encontró el negocio" };

    const { data: productoActual, error: errorLectura } = await adminClient
      .from("productos")
      .select("fkeCodCompany")
      .eq("eCodProduct", eCodProduct)
      .single();

    if (errorLectura || !productoActual) {
      return { error: "Producto no encontrado" };
    }

    if (productoActual.fkeCodCompany !== perfil.fkeCodCompany) {
      return { error: "No autorizado" };
    }

    const { error } = await adminClient
      .from("productos")
      .update({
        bStateProduct: nuevoEstado,
        fhUpdateProduct: new Date().toISOString(),
      })
      .eq("eCodProduct", eCodProduct)
      .eq("fkeCodCompany", perfil.fkeCodCompany);

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
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return { error: "No se encontró el negocio" };

    const { data: productoActual, error: errorLectura } = await adminClient
      .from("productos")
      .select("fkeCodCategory, fkeCodCompany")
      .eq("eCodProduct", eCodProduct)
      .single();

    if (errorLectura || !productoActual) {
      return { error: "Producto no encontrado" };
    }

    if (productoActual.fkeCodCompany !== perfil.fkeCodCompany) {
      return { error: "No autorizado" };
    }

    const categoriaDueña = productoActual?.fkeCodCategory as string | null;

    const { error: errorEliminar } = await adminClient
      .from("productos")
      .delete()
      .eq("eCodProduct", eCodProduct)
      .eq("fkeCodCompany", perfil.fkeCodCompany);

    if (errorEliminar) {
      return { error: `Error al eliminar producto: ${errorEliminar.message}` };
    }

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
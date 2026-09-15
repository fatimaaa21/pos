"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Inventario } from "@/types";

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

/**
 * Descuenta el insumo necesario para PRODUCIR `cantidad` unidades de un
 * producto/presentación con inventario propio (ej. hornear 20 panes) —
 * el insumo se gasta al producir el lote, no en cada venta individual
 * (crearVenta/crearAutoconsumo se saltan su propio descuento cuando el
 * producto no es ilimitado, justamente porque ya se descontó aquí).
 *
 * Solo contempla receta fija (fkeCodInsumoMaestro): la receta resuelta por
 * grupo de extras no aplica a un lote de producción — depende de qué elija
 * cada cliente al pedir, no de qué se hornea.
 *
 * Si no hay receta configurada para este producto/presentación, no hace
 * nada (no todos los productos con inventario propio usan insumos).
 */
async function descontarInsumosProduccion(
  adminClient: ReturnType<typeof createAdminClient>,
  params: {
    fkeCodProduct:      string;
    fkeCodPresentacion: string | null;
    cantidad:           number;
    fkeCodSucursal:     string;
    fkeCodInventory:    string;
  }
): Promise<{ error: string } | { ok: true }> {
  const { fkeCodProduct, fkeCodPresentacion, cantidad, fkeCodSucursal, fkeCodInventory } = params;
  if (cantidad <= 0) return { ok: true };

  const { data: receta } = await adminClient
    .from("receta_insumos")
    .select("fkeCodInsumoMaestro, eCantidadNecesaria")
    .eq(fkeCodPresentacion ? "fkeCodPresentacion" : "fkeCodProduct", fkeCodPresentacion ?? fkeCodProduct)
    .not("fkeCodInsumoMaestro", "is", null);

  if (!receta || receta.length === 0) return { ok: true };

  const necesarioPorInsumo = new Map<string, number>();
  for (const r of receta) {
    if (!r.fkeCodInsumoMaestro) continue;
    necesarioPorInsumo.set(
      r.fkeCodInsumoMaestro,
      (necesarioPorInsumo.get(r.fkeCodInsumoMaestro) ?? 0) + r.eCantidadNecesaria * cantidad
    );
  }

  type Resuelto = { fkeCodInsumoStock: string; eCantidadADescontar: number; version: number; tNombre: string; tUnidad: string };
  const resueltos: Resuelto[] = [];

  for (const [fkeCodInsumoMaestro, cantidadNecesaria] of necesarioPorInsumo) {
    const { data: stock } = await adminClient
      .from("insumos_stock")
      .select("eCodInsumoStock, eCantidadStock, version, insumos_maestro(tNombre, tUnidadReceta)")
      .eq("fkeCodInsumoMaestro", fkeCodInsumoMaestro)
      .eq("fkeCodSucursal", fkeCodSucursal)
      .eq("bStateInsumoStock", true)
      .maybeSingle();

    const nombreInsumo = (stock as any)?.insumos_maestro?.tNombre ?? "insumo";

    if (!stock) {
      return { error: `Falta configurar el insumo "${nombreInsumo}" en esta sucursal` };
    }
    if (stock.eCantidadStock < cantidadNecesaria) {
      return { error: `Stock insuficiente de "${nombreInsumo}" para producir ${cantidad} unidades` };
    }

    resueltos.push({
      fkeCodInsumoStock:   stock.eCodInsumoStock,
      eCantidadADescontar: cantidadNecesaria,
      version:             stock.version,
      tNombre:             nombreInsumo,
      tUnidad:             (stock as any).insumos_maestro?.tUnidadReceta ?? "",
    });
  }

  for (const r of resueltos) {
    const { data: actual } = await adminClient
      .from("insumos_stock")
      .select("eCantidadStock, version")
      .eq("eCodInsumoStock", r.fkeCodInsumoStock)
      .single();

    if (!actual) continue;

    const { data: actualizado } = await adminClient
      .from("insumos_stock")
      .update({
        eCantidadStock:      Math.max(0, actual.eCantidadStock - r.eCantidadADescontar),
        version:             actual.version + 1,
        fhUpdateInsumoStock: new Date().toISOString(),
      })
      .eq("eCodInsumoStock", r.fkeCodInsumoStock)
      .eq("version", actual.version)
      .select("eCodInsumoStock");

    if (!actualizado || actualizado.length === 0) {
      return {
        error:
          `No se pudo descontar el insumo "${r.tNombre}": otro movimiento lo modificó al mismo tiempo. ` +
          "Intenta de nuevo.",
      };
    }

    await adminClient.from("producto_insumos_consumidos").insert({
      fkeCodInventory:       fkeCodInventory,
      fkeCodInsumoStock:     r.fkeCodInsumoStock,
      tNombreInsumoSnapshot: r.tNombre,
      eCantidadDescontada:   r.eCantidadADescontar,
      tUnidadSnapshot:       r.tUnidad,
    });
  }

  return { ok: true };
}

export async function agregarStock(formData: FormData) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const fkeCodProduct      = formData.get("fkeCodProduct") as string;
    const fkeCodPresentacion = (formData.get("fkeCodPresentacion") as string) || null;
    const fkeCodSucursal     = formData.get("fkeCodSucursal") as string;  // ← nuevo
    const bIlimitado         = formData.get("bUnlimitedInventory") === "true";
    const eCantIngresada     = bIlimitado ? 0 : parseFloat(formData.get("eCantIngresada") as string);
    const eStockMinimo       = bIlimitado ? 0 : (parseFloat(formData.get("eStockMinimo") as string) || 0);

    if (!fkeCodProduct) return { error: "Producto requerido" };
    if (!fkeCodSucursal) return { error: "Sucursal requerida" };  // ← nuevo
    if (!bIlimitado && (isNaN(eCantIngresada) || eCantIngresada <= 0)) {
      return { error: "Cantidad inválida" };
    }

    if (!fkeCodPresentacion) {
      const { data: presActivas } = await adminClient
        .from("presentaciones")
        .select("eCodPresentacion")
        .eq("fkeCodProduct", fkeCodProduct)
        .eq("bStatePresentacion", true)
        .limit(1);

      if (presActivas && presActivas.length > 0) {
        return {
          error:
            "Este producto maneja presentaciones. " +
            "Selecciona una presentación para registrar el stock.",
        };
      }
    }

    const { data: producto, error: productoError } = await adminClient
      .from("productos")
      .select("fkeCodCompany")
      .eq("eCodProduct", fkeCodProduct)
      .single();

    if (productoError || !producto?.fkeCodCompany) {
      return { error: "No se pudo obtener el negocio del producto" };
    }

    if (producto.fkeCodCompany !== perfil.fkeCodCompany) {
      return { error: "No autorizado" };
    }

    const { data: sucursal, error: sucursalError } = await adminClient
      .from("sucursales")
      .select("fkeCodCompany")
      .eq("eCodSucursal", fkeCodSucursal)
      .single();

    if (sucursalError || !sucursal || sucursal.fkeCodCompany !== perfil.fkeCodCompany) {
      return { error: "No autorizado" };
    }

    const fkeCodCompany = producto.fkeCodCompany;
    const ahora = new Date().toISOString();

    const { data: insertado, error } = await adminClient
      .from("inventario")
      .insert({
        fkeCodProduct,
        fkeCodPresentacion,
        fkeCodCompany,
        fkeCodSucursal,   // ← nuevo
        eCantIngresada,
        eStockMinimo,
        bUnlimitedInventory: bIlimitado,
        bStateInventory:     true,
        fhCreateInventory:   ahora,
        fhUpdateInventory:   ahora,
      })
      .select("eCodInventory")
      .single();

    if (error) return { error: `Error al agregar stock: ${error.message}` };

    if (!bIlimitado) {
      const resultadoInsumos = await descontarInsumosProduccion(adminClient, {
        fkeCodProduct,
        fkeCodPresentacion,
        cantidad:        eCantIngresada,
        fkeCodSucursal,
        fkeCodInventory: insertado.eCodInventory,
      });

      if ("error" in resultadoInsumos) {
        await adminClient.from("inventario").delete().eq("eCodInventory", insertado.eCodInventory);
        return { error: resultadoInsumos.error };
      }
    }

    const { data, error: vistaError } = await adminClient
      .from("vista_inventario")
      .select(`
        *,
        productos!inventario_fkeCodProduct_fkey (
          tNameProduct,
          ImgProduct,
          ePriceProduct,
          categorias ( eCodCategory, tNameCategory )
        )
      `)
      .eq("eCodInventory", insertado.eCodInventory)
      .single();

    if (vistaError || !data) {
      return { error: `Error al leer el stock creado: ${vistaError?.message}` };
    }

    revalidatePath("/admin/inventario");
    return { inventario: data as Inventario };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function editarStock(formData: FormData) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const eCodInventory = formData.get("eCodInventory") as string;
    const eCantAgregar  = parseFloat(formData.get("eCantAgregar") as string);
    const eStockMinimo  = parseFloat(formData.get("eStockMinimo") as string);

    const { data: actual, error: errorLectura } = await adminClient
      .from("inventario")
      .select("eCantIngresada, fkeCodCompany, fkeCodProduct, fkeCodPresentacion, fkeCodSucursal, bUnlimitedInventory")
      .eq("eCodInventory", eCodInventory)
      .single();

    if (errorLectura || !actual) return { error: "No se encontró el registro" };
    if (actual.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

    // Las unidades que se agregan aquí se acaban de producir — mismo criterio
    // que agregarStock: se descuenta el insumo de esta cantidad antes de
    // sumarla, para no dejar el lote crecido sin haber gastado nada.
    if (!actual.bUnlimitedInventory && !isNaN(eCantAgregar) && eCantAgregar > 0 && actual.fkeCodProduct) {
      const resultadoInsumos = await descontarInsumosProduccion(adminClient, {
        fkeCodProduct:      actual.fkeCodProduct,
        fkeCodPresentacion: actual.fkeCodPresentacion,
        cantidad:           eCantAgregar,
        fkeCodSucursal:     actual.fkeCodSucursal,
        fkeCodInventory:    eCodInventory,
      });

      if ("error" in resultadoInsumos) return { error: resultadoInsumos.error };
    }

    const nuevaCantIngresada = actual.eCantIngresada + eCantAgregar;

    const { data: inventario, error } = await adminClient
      .from("inventario")
      .update({
        eCantIngresada:    nuevaCantIngresada,
        eStockMinimo:      isNaN(eStockMinimo) ? undefined : eStockMinimo,
        fhUpdateInventory: new Date().toISOString(),
      })
      .eq("eCodInventory", eCodInventory)
      .select()
      .single();

    if (error) return { error: `Error al actualizar: ${error.message}` };

    const { data: vistaActual } = await adminClient
      .from("vista_inventario")
      .select("eCantRestante")
      .eq("eCodInventory", eCodInventory)
      .single();

    if (vistaActual) {
      await adminClient
        .from("inventario")
        .update({ bStateInventory: vistaActual.eCantRestante > 0 })
        .eq("eCodInventory", eCodInventory);
    }

    revalidatePath("/admin/inventario");
    revalidatePath("/empleado/menu");
    return { inventario };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function toggleEstadoInventario(eCodInventory: string, nuevoEstado: boolean) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: actual, error: errorLectura } = await adminClient
      .from("inventario")
      .select("fkeCodCompany")
      .eq("eCodInventory", eCodInventory)
      .single();

    if (errorLectura || !actual) return { error: "No se encontró el registro" };
    if (actual.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { error } = await adminClient
      .from("inventario")
      .update({ bStateInventory: nuevoEstado, fhUpdateInventory: new Date().toISOString() })
      .eq("eCodInventory", eCodInventory);

    if (error) return { error: `Error al actualizar estado: ${error.message}` };

    revalidatePath("/admin/inventario");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function eliminarInventario(eCodInventory: string) {
  try {
    const perfil = await getPerfilActual();
    if (!perfil) return { error: "No autorizado" };

    const adminClient = createAdminClient();

    const { data: actual, error: errorLectura } = await adminClient
      .from("inventario")
      .select("fkeCodCompany")
      .eq("eCodInventory", eCodInventory)
      .single();

    if (errorLectura || !actual) return { error: "No se encontró el registro" };
    if (actual.fkeCodCompany !== perfil.fkeCodCompany) return { error: "No autorizado" };

    const { error } = await adminClient
      .from("inventario")
      .delete()
      .eq("eCodInventory", eCodInventory);

    if (error) return { error: `Error al eliminar: ${error.message}` };

    revalidatePath("/admin/inventario");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
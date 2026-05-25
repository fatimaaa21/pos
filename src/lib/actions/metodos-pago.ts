"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { revalidatePath }    from "next/cache";

// ── Tipo ─────────────────────────────────────────────────────────────────────

export interface MetodoPagoGlobal {
  eCodPay:     string;
  tNamePay:    string;
  tIconPay:    string;
  descripcion: string | null;
  bStatePay:   boolean;
  orden:       number;
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Todos los métodos del catálogo global (para Sistemas) */
export async function getMetodosPagoGlobal(): Promise<MetodoPagoGlobal[]> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("metodos_pago")
    .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay, orden")
    .order("orden");

  if (error) { console.error(error); return []; }
  return data as MetodoPagoGlobal[];
}

/** Métodos activos del catálogo + cuáles tiene activados el negocio del admin */
export async function getMetodosParaAdmin(): Promise<{
  catalogo:   MetodoPagoGlobal[];
  activados:  string[];   // array de eCodPay
  codCompany: string;
}> {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { catalogo: [], activados: [], codCompany: "" };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user.id)
    .single();

  const codCompany = perfil?.fkeCodCompany ?? "";

  // Solo los activos en el catálogo global
  const { data: catalogo } = await adminClient
    .from("metodos_pago")
    .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay, orden")
    .eq("bStatePay", true)
    .order("orden");

  // Los que el negocio tiene activados (array de eCodPay)
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("metodosPago")
    .eq("eCodCompany", codCompany)
    .single();

  const activados: string[] = negocio?.metodosPago ?? [];

  return {
    catalogo:  (catalogo as MetodoPagoGlobal[]) ?? [],
    activados,
    codCompany,
  };
}

// ── Mutations — Sistemas ──────────────────────────────────────────────────────

export async function crearMetodoPago(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const tNamePay    = formData.get("tNamePay")    as string;
    const tIconPay    = formData.get("tIconPay")    as string;
    const descripcion = formData.get("descripcion") as string;
    const orden       = parseInt(formData.get("orden") as string) || 0;

    const { data, error } = await adminClient
      .from("metodos_pago")
      .insert({
        tNamePay,
        tIconPay,
        descripcion: descripcion || null,
        orden,
        bStatePay: true,
      })
      .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay, orden")
      .single();

    if (error) return { error: `Error al crear: ${error.message}` };

    revalidatePath("/sistemas/metodosPago");
    return { metodo: data as MetodoPagoGlobal };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message}` };
  }
}

export async function editarMetodoPago(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const eCodPay     = formData.get("eCodPay")     as string;
    const tNamePay    = formData.get("tNamePay")    as string;
    const tIconPay    = formData.get("tIconPay")    as string;
    const descripcion = formData.get("descripcion") as string;
    const orden       = parseInt(formData.get("orden") as string) || 0;

    const { data, error } = await adminClient
      .from("metodos_pago")
      .update({
        tNamePay,
        tIconPay,
        descripcion: descripcion || null,
        orden,
      })
      .eq("eCodPay", eCodPay)
      .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay, orden")
      .single();

    if (error) return { error: `Error al editar: ${error.message}` };

    revalidatePath("/sistemas/metodosPago");
    return { metodo: data as MetodoPagoGlobal };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message}` };
  }
}

export async function toggleActivoMetodoPago(eCodPay: string, bStatePay: boolean) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("metodos_pago")
      .update({ bStatePay })
      .eq("eCodPay", eCodPay);

    if (error) return { error: error.message };

    revalidatePath("/sistemas/metodosPago");
    return { ok: true };
  } catch (e: any) {
    return { error: e?.message };
  }
}

export async function eliminarMetodoPago(eCodPay: string) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("metodos_pago")
      .delete()
      .eq("eCodPay", eCodPay);

    if (error) return { error: error.message };

    revalidatePath("/sistemas/metodosPago");
    return { ok: true };
  } catch (e: any) {
    return { error: e?.message };
  }
}

// ── Mutations — Admin ─────────────────────────────────────────────────────────

/** Guarda los eCodPay de los métodos activados por el admin para su negocio */
export async function guardarMetodosNegocio(codCompany: string, metodosPago: string[]) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("negocios")
      .update({ metodosPago })
      .eq("eCodCompany", codCompany);

    if (error) return { error: error.message };

    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (e: any) {
    return { error: e?.message };
  }
}
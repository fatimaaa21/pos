"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient }      from "@/lib/supabase/server";
import { revalidatePath }    from "next/cache";

// ── Tipo ─────────────────────────────────────────────────────────────────────

export interface ConfigNegocio {
  eCodCompany:  string;
  tNameCompany: string;
  imgCompany:   string | null;
  moneda:       string;
  zona_horaria: string;
  // metodosPago se gestiona por separado en metodos-pago.ts
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getConfigNegocio(): Promise<ConfigNegocio | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return null;

    const { data: negocio } = await supabase
      .from("negocios")
      .select("eCodCompany, tNameCompany, imgCompany, moneda, zona_horaria")
      .eq("eCodCompany", perfil.fkeCodCompany)
      .single();

    if (!negocio) return null;

    return {
      eCodCompany:  negocio.eCodCompany,
      tNameCompany: negocio.tNameCompany,
      imgCompany:   negocio.imgCompany   ?? null,
      moneda:       negocio.moneda       ?? "MXN",
      zona_horaria: negocio.zona_horaria ?? "America/Mexico_City",
    };
  } catch {
    return null;
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/** Guarda solo los datos generales del negocio (sin metodosPago) */
export async function guardarConfigNegocio(formData: FormData) {
  try {
    const adminClient = createAdminClient();
    const supabase    = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", user.id)
      .single();

    if (!perfil?.fkeCodCompany) return { error: "Negocio no encontrado" };

    const tNameCompany = formData.get("tNameCompany") as string;
    const imgCompany   = formData.get("imgCompany")   as string;
    const moneda       = formData.get("moneda")        as string;
    const zona_horaria = formData.get("zona_horaria")  as string;

    const { error } = await adminClient
      .from("negocios")
      .update({
        tNameCompany,
        imgCompany:   imgCompany || null,
        moneda,
        zona_horaria,
      })
      .eq("eCodCompany", perfil.fkeCodCompany);

    if (error) return { error: `Error al guardar: ${error.message}` };

    revalidatePath("/admin/configuracion");
    revalidatePath("/admin/dashboard");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { NegocioConAdmin } from "@/app/sistemas/negocios/NegociosClient";
import type { Perfil } from "@/types";

function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function generarCodigoUnico(
  adminClient: ReturnType<typeof createAdminClient>
): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    const { data } = await adminClient
      .from("perfiles")
      .select("eCodeUser")
      .eq("eCodeUser", codigo)
      .single();
    if (!data) return codigo;
  }
  throw new Error("No se pudo generar un código único");
}

export async function crearNegocio(formData: FormData) {
  try {
    const adminClient   = createAdminClient();
    const nombreNegocio = formData.get("nombreNegocio") as string;
    const nombreAdmin   = formData.get("nombreAdmin")   as string;
    const emailAdmin    = formData.get("emailAdmin")    as string;

    const slug = generarSlug(nombreNegocio);

    const tipo_negocio = (formData.get("tipo_negocio") as string) || "general";

    const { data: negocio, error: negocioError } = await adminClient
      .from("negocios")
      .insert({
        tNameCompany:    nombreNegocio,
        tSlugCompany:    slug,
        tipo_negocio, 
        bStateCompany:   "activo",
        fhCreateCompany: new Date().toISOString(),
      })
      .select()
      .single();

    if (negocioError) {
      if (negocioError.message.includes("unique")) {
        return { error: "Ya existe un negocio con ese nombre" };
      }
      return { error: `Error al crear negocio: ${negocioError.message}` };
    }

    const eCodeUser = await generarCodigoUnico(adminClient);
    const sufijo    = process.env.PIN_SECRET_SUFFIX ?? "PAN_SECRET_2024";
    const password  = `${eCodeUser}${sufijo}`;

    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: emailAdmin,
        password,
        email_confirm: true,
        user_metadata: { nombre: nombreAdmin, rol: "admin" },
      });

    if (authError) {
      await adminClient.from("negocios").delete().eq("eCodCompany", negocio.eCodCompany);
      if (authError.message.includes("already registered")) {
        return { error: "Ya existe un usuario con ese correo" };
      }
      return { error: `Error de autenticación: ${authError.message}` };
    }

    const ahora = new Date().toISOString();
    const { data: perfil, error: perfilError } = await adminClient
      .from("perfiles")
      .insert({
        eCodUser:      authData.user.id,
        tNameUser:     nombreAdmin,
        tEmailUser:    emailAdmin,
        tRolUser:      "admin",
        eCodeUser,
        fkeCodCompany: negocio.eCodCompany,
        bStateUser:    true,
        fhCreateUser:  ahora,
        fhUpdateUser:  ahora,
      })
      .select()
      .single();

    if (perfilError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      await adminClient.from("negocios").delete().eq("eCodCompany", negocio.eCodCompany);
      return { error: `Error al crear perfil: ${perfilError.message}` };
    }

    revalidatePath("/sistemas/dashboard");
    revalidatePath("/sistemas/negocios");

    return {
      negocio: {
        eCodCompany:     negocio.eCodCompany,
        tNameCompany:    negocio.tNameCompany,
        tSlugCompany:    negocio.tSlugCompany,
        imgCompany:      negocio.imgCompany ?? null,
        moneda:          negocio.moneda ?? "MXN",
        zona_horaria:    negocio.zona_horaria ?? "America/Mexico_City",
        tipo_negocio:    negocio.tipo_negocio ?? "general",
        bStateCompany:   negocio.bStateCompany,
        fhCreateCompany: negocio.fhCreateCompany,
        admin:           null,
        totalUsuarios:   1,
      } as NegocioConAdmin,
      perfil: {
        eCodUser:     perfil.eCodUser,
        tNameUser:    perfil.tNameUser,
        tEmailUser:   perfil.tEmailUser,
        tRolUser:     perfil.tRolUser,
        eCodeUser:    perfil.eCodeUser,
        bStateUser:   perfil.bStateUser,
        fhCreateUser: perfil.fhCreateUser,
      } as Perfil,
      codigo: eCodeUser,
    };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function editarNegocio(formData: FormData) {
  try {
    const adminClient   = createAdminClient();
    const id            = formData.get("id")            as string;
    const nombreNegocio = formData.get("nombreNegocio") as string;
    const nombreAdmin   = formData.get("nombreAdmin")   as string;
    const emailAdmin    = formData.get("emailAdmin")    as string;

    const { data: negocio, error: negocioError } = await adminClient
      .from("negocios")
      .update({ tNameCompany: nombreNegocio })
      .eq("eCodCompany", id)
      .select()
      .single();

    if (negocioError) return { error: `Error al actualizar negocio: ${negocioError.message}` };

    const { error: perfilError } = await adminClient
      .from("perfiles")
      .update({
        tNameUser:    nombreAdmin,
        tEmailUser:   emailAdmin,
        fhUpdateUser: new Date().toISOString(),
      })
      .eq("fkeCodCompany", id)
      .eq("tRolUser", "admin");

    if (perfilError) return { error: `Error al actualizar admin: ${perfilError.message}` };

    revalidatePath("/sistemas/negocios");
    revalidatePath("/sistemas/dashboard");

    return {
      negocio: {
        eCodCompany:     negocio.eCodCompany,
        tNameCompany:    negocio.tNameCompany,
        tSlugCompany:    negocio.tSlugCompany,
        imgCompany:      negocio.imgCompany ?? null,
        moneda:          negocio.moneda,
        zona_horaria:    negocio.zona_horaria,
        bStateCompany:   negocio.bStateCompany,
        fhCreateCompany: negocio.fhCreateCompany,
      } as NegocioConAdmin,
    };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function toggleEstadoNegocio(
  id: string,
  nuevoEstado: "activo" | "pausado"
) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("negocios")
      .update({ bStateCompany: nuevoEstado })
      .eq("eCodCompany", id);

    if (error) return { error: error.message };

    revalidatePath("/sistemas/dashboard");
    revalidatePath("/sistemas/negocios");
    return { ok: true };
  } catch (e: any) {
    return { error: e?.message };
  }
}

export async function eliminarNegocio(eCodCompany: string) {
  try {
    const adminClient = createAdminClient();

    // 1. Obtener todos los usuarios del negocio
    const { data: perfiles } = await adminClient
      .from("perfiles")
      .select("eCodUser")
      .eq("fkeCodCompany", eCodCompany);

    // 2. Eliminar perfiles de la DB
    const { error: perfilesError } = await adminClient
      .from("perfiles")
      .delete()
      .eq("fkeCodCompany", eCodCompany);

    if (perfilesError) return { error: `Error al eliminar perfiles: ${perfilesError.message}` };

    // 3. Eliminar usuarios de Auth
    for (const perfil of perfiles ?? []) {
      await adminClient.auth.admin.deleteUser(perfil.eCodUser);
    }

    // 4. Eliminar el negocio
    const { error: negocioError } = await adminClient
      .from("negocios")
      .delete()
      .eq("eCodCompany", eCodCompany);

    if (negocioError) return { error: `Error al eliminar negocio: ${negocioError.message}` };

    revalidatePath("/sistemas/negocios");
    revalidatePath("/sistemas/dashboard");
    return { ok: true };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message}` };
  }
}

// ── Módulos por negocio ───────────────────────────────────────────────────────

const MODULOS_DISPONIBLES = ["mesas"] as const;
export type ModuloDisponible = typeof MODULOS_DISPONIBLES[number];

export async function obtenerModulosNegocio(
  fkeCodCompany: string
): Promise<{ tModulo: string; bStateModulo: boolean }[]> {
  const adminClient = createAdminClient();

  const { data } = await adminClient
    .from("modulos_tenant")
    .select("tModulo, bStateModulo")
    .eq("fkeCodCompany", fkeCodCompany);

  // Devuelve todos los módulos disponibles, activos o no
  return MODULOS_DISPONIBLES.map((modulo) => ({
    tModulo:      modulo,
    bStateModulo: (data ?? []).find((m) => m.tModulo === modulo)?.bStateModulo ?? false,
  }));
}

export async function toggleModuloNegocio(
  fkeCodCompany: string,
  tModulo: string,
  bStateModulo: boolean
): Promise<{ ok: true } | { error: string }> {
  const adminClient = createAdminClient();

  // Upsert: si no existe el registro lo crea, si existe lo actualiza
  const { error } = await adminClient
    .from("modulos_tenant")
    .upsert(
      {
        fkeCodCompany,
        tModulo,
        bStateModulo,
        fhActivado:    bStateModulo ? new Date().toISOString() : null,
        fhCreateModulo: new Date().toISOString(),
      },
      { onConflict: "fkeCodCompany,tModulo" }
    );

  if (error) return { error: `Error al actualizar módulo: ${error.message}` };

  revalidatePath("/sistemas/negocios");
  return { ok: true };
}
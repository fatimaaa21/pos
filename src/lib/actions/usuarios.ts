"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Perfil } from "@/types";
import { revalidatePath } from "next/cache";
import { createClient } from "../supabase/server";
import { generarCodigoUnico } from "@/lib/utils/codigo";
import { mensajeError } from "@/lib/utils/error";
import { enviarEmailBienvenida } from "@/lib/utils/emailBienvenida";

// ─────────────────────────────────────────────────────────────
// HELPER: admin autenticado del negocio actual
// No confiamos solo en el middleware de /admin — cada acción
// vuelve a verificar rol y resuelve fkeCodCompany desde la sesión,
// nunca desde datos que manda el cliente.
// ─────────────────────────────────────────────────────────────

async function getPerfilAdminActual(): Promise<{ fkeCodCompany: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil?.fkeCodCompany || perfil.tRolUser !== "admin") return null;

  return { fkeCodCompany: perfil.fkeCodCompany };
}

export async function crearUsuario(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const tNameUser = formData.get("tNameUser") as string;
    const tEmailUser = formData.get("tEmailUser") as string;
    const tRolUser = formData.get("tRolUser") as string;
    const fkeCodSucursal = (formData.get("fkeCodSucursal") as string) || null;

    const perfilAdmin = await getPerfilAdminActual();
    if (!perfilAdmin) return { error: "No autorizado" };

    const fkeCodCompany = perfilAdmin.fkeCodCompany;

    const eCodeUser = await generarCodigoUnico(adminClient, fkeCodCompany);

    const sufijo = process.env.PIN_SECRET_SUFFIX;
    if (!sufijo) {
      return { error: "Error de configuración del servidor" };
    }
    const password = `${eCodeUser}${sufijo}`;

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: tEmailUser,
      password,
      email_confirm: true,
      user_metadata: { nombre: tNameUser, rol: tRolUser },
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return { error: "Ya existe un usuario con ese correo" };
      }
      return { error: `Error de autenticación: ${authError.message}` };
    }

    const ahora = new Date().toISOString();

    const { data: perfil, error: perfilError } = await adminClient
      .from("perfiles")
      .insert({
        eCodUser: authData.user.id,
        tNameUser,
        tEmailUser,
        tRolUser,
        eCodeUser,
        bStateUser: true,
        fkeCodCompany,
        fkeCodSucursal: tRolUser === "empleado" ? fkeCodSucursal : null,
        fhCreateUser: ahora,
        fhUpdateUser: ahora,
      })
      .select()
      .single();

    if (perfilError) {
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return { error: `Error al crear perfil: ${perfilError.message}` };
    }

    // Enviar email — si falla no revertimos, el usuario ya fue creado
    try {
      await enviarEmailBienvenida({ nombre: tNameUser, email: tEmailUser, codigo: eCodeUser });
    } catch (emailError) {
      console.error("Error enviando email:", emailError);
    }

    revalidatePath("/admin/usuarios");
    return { perfil: perfil as Perfil };
  } catch (e: unknown) {
    return { error: `Error inesperado: ${mensajeError(e)}` };
  }
}

export async function editarUsuario(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const perfilAdmin = await getPerfilAdminActual();
    if (!perfilAdmin) return { error: "No autorizado" };

    const eCodUser = formData.get("eCodUser") as string;
    const tNameUser = formData.get("tNameUser") as string;
    const tEmailUser = formData.get("tEmailUser") as string;
    const tRolUser = formData.get("tRolUser") as string;
    const fkeCodSucursal = (formData.get("fkeCodSucursal") as string) || null;

    const { data: usuarioActual, error: errorLectura } = await adminClient
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", eCodUser)
      .single();

    if (errorLectura || !usuarioActual) {
      return { error: "Usuario no encontrado" };
    }

    if (usuarioActual.fkeCodCompany !== perfilAdmin.fkeCodCompany) {
      return { error: "No autorizado" };
    }

    const { data: perfil, error } = await adminClient
      .from("perfiles")
      .update({ tNameUser, tEmailUser, tRolUser, fkeCodSucursal: tRolUser === "empleado" ? fkeCodSucursal : null, fhUpdateUser: new Date().toISOString() })
      .eq("eCodUser", eCodUser)
      .eq("fkeCodCompany", perfilAdmin.fkeCodCompany)
      .select()
      .single();

    if (error) return { error: `Error al actualizar: ${error.message}` };

    revalidatePath("/admin/usuarios");
    return { perfil: perfil as Perfil };
  } catch (e: unknown) {
    return { error: `Error inesperado: ${mensajeError(e)}` };
  }
}

export async function toggleEstadoUsuario(eCodUser: string, nuevoEstado: boolean) {
  try {
    const adminClient = createAdminClient();

    const perfilAdmin = await getPerfilAdminActual();
    if (!perfilAdmin) return { error: "No autorizado" };

    const { data: usuarioActual, error: errorLectura } = await adminClient
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", eCodUser)
      .single();

    if (errorLectura || !usuarioActual) {
      return { error: "Usuario no encontrado" };
    }

    if (usuarioActual.fkeCodCompany !== perfilAdmin.fkeCodCompany) {
      return { error: "No autorizado" };
    }

    const { error } = await adminClient
      .from("perfiles")
      .update({ bStateUser: nuevoEstado, fhUpdateUser: new Date().toISOString() })
      .eq("eCodUser", eCodUser)
      .eq("fkeCodCompany", perfilAdmin.fkeCodCompany);

    if (error) return { error: `Error al actualizar estado: ${error.message}` };

    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e: unknown) {
    return { error: `Error inesperado: ${mensajeError(e)}` };
  }
}

export async function eliminarUsuario(eCodUser: string) {
  try {
    const adminClient = createAdminClient();

    const perfilAdmin = await getPerfilAdminActual();
    if (!perfilAdmin) return { error: "No autorizado" };

    const { data: usuarioActual, error: errorLectura } = await adminClient
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", eCodUser)
      .single();

    if (errorLectura || !usuarioActual) {
      return { error: "Usuario no encontrado" };
    }

    if (usuarioActual.fkeCodCompany !== perfilAdmin.fkeCodCompany) {
      return { error: "No autorizado" };
    }

    const { error: perfilError } = await adminClient
      .from("perfiles")
      .delete()
      .eq("eCodUser", eCodUser)
      .eq("fkeCodCompany", perfilAdmin.fkeCodCompany);

    if (perfilError) return { error: `Error al eliminar perfil: ${perfilError.message}` };

    await adminClient.auth.admin.deleteUser(eCodUser);

    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e: unknown) {
    return { error: `Error inesperado: ${mensajeError(e)}` };
  }
}

export async function actualizarAvatar(eCodUser: string, ImgUser: string) {
  try {
    const adminClient = createAdminClient();

    const perfilAdmin = await getPerfilAdminActual();
    if (!perfilAdmin) return { error: "No autorizado" };

    const { data: usuarioActual, error: errorLectura } = await adminClient
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", eCodUser)
      .single();

    if (errorLectura || !usuarioActual) {
      return { error: "Usuario no encontrado" };
    }

    if (usuarioActual.fkeCodCompany !== perfilAdmin.fkeCodCompany) {
      return { error: "No autorizado" };
    }

    const { error } = await adminClient
      .from("perfiles")
      .update({ ImgUser, fhUpdateUser: new Date().toISOString() })
      .eq("eCodUser", eCodUser)
      .eq("fkeCodCompany", perfilAdmin.fkeCodCompany);

    if (error) return { error: error.message };

    revalidatePath("/admin/usuarios");
    revalidatePath("/empleado/inventario");
    return { ok: true };
  } catch (e: unknown) {
    return { error: mensajeError(e) };
  }
}
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Perfil } from "@/types";
import { revalidatePath } from "next/cache";
import { createClient } from "../supabase/server";
import { generarCodigoUnico } from "@/lib/utils/codigo";
import { mensajeError } from "@/lib/utils/error";
import { enviarEmailBienvenida } from "@/lib/utils/emailBienvenida";

export async function crearUsuario(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const tNameUser = formData.get("tNameUser") as string;
    const tEmailUser = formData.get("tEmailUser") as string;
    const tRolUser = formData.get("tRolUser") as string;
    const fkeCodSucursal = (formData.get("fkeCodSucursal") as string) || null;

    // Resolver primero el negocio del admin que está creando el usuario,
    // ANTES de generar código o tocar Auth — así no queda un usuario
    // huérfano en Auth si esto falla.
    const supabase = await createClient();
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    const { data: perfilAdmin } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", adminUser!.id)
      .single();

    const fkeCodCompany = perfilAdmin?.fkeCodCompany;
    if (!fkeCodCompany) {
      return { error: "No se pudo determinar el negocio del administrador" };
    }

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

    const eCodUser = formData.get("eCodUser") as string;
    const tNameUser = formData.get("tNameUser") as string;
    const tEmailUser = formData.get("tEmailUser") as string;
    const tRolUser = formData.get("tRolUser") as string;
    const fkeCodSucursal = (formData.get("fkeCodSucursal") as string) || null;

    const { data: perfil, error } = await adminClient
      .from("perfiles")
      .update({ tNameUser, tEmailUser, tRolUser, fkeCodSucursal: tRolUser === "empleado" ? fkeCodSucursal : null, fhUpdateUser: new Date().toISOString() })
      .eq("eCodUser", eCodUser)
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

    const { error } = await adminClient
      .from("perfiles")
      .update({ bStateUser: nuevoEstado, fhUpdateUser: new Date().toISOString() })
      .eq("eCodUser", eCodUser);

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

    const { error: perfilError } = await adminClient
      .from("perfiles")
      .delete()
      .eq("eCodUser", eCodUser);

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

    const { error } = await adminClient
      .from("perfiles")
      .update({ ImgUser, fhUpdateUser: new Date().toISOString() })
      .eq("eCodUser", eCodUser);

    if (error) return { error: error.message };

    revalidatePath("/admin/usuarios");
    revalidatePath("/empleado/inventario");
    return { ok: true };
  } catch (e: unknown) {
    return { error: mensajeError(e) };
  }
}
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";
import type { Perfil } from "@/types";
import { revalidatePath } from "next/cache";
import { createClient } from "../supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

async function generarCodigoUnico(adminClient: ReturnType<typeof createAdminClient>): Promise<string> {
  for (let intentos = 0; intentos < 20; intentos++) {
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

async function enviarEmailBienvenida(nombre: string, email: string, codigo: string) {
  await resend.emails.send({
    from: "Kivi <no-reply@kivi.mx>",
    to: email,
    subject: "Tu código de acceso 🥐",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #f8f7f4;">
        <div style="background: white; border-radius: 20px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="font-size: 48px; margin-bottom: 12px;">🥐</div>
            <h1 style="font-size: 22px; color: #1a1a1a; margin: 0 0 8px;">¡Bienvenido, ${nombre}!</h1>
            <p style="color: #7a6a5e; font-size: 14px; margin: 0;">Ya tienes acceso al sistema de gestión</p>
          </div>
          <div style="background: #f0f5e8; border-radius: 16px; padding: 28px; text-align: center; margin-bottom: 28px;">
            <p style="color: #628321; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 12px;">Tu código de acceso</p>
            <div style="font-size: 48px; font-weight: 700; color: #1a1a1a; letter-spacing: 16px; font-family: monospace;">${codigo}</div>
            <p style="color: #9a8a7e; font-size: 12px; margin: 12px 0 0;">Usa este código de 4 dígitos para iniciar sesión</p>
          </div>
          <div style="background: #fef3e8; border-radius: 12px; padding: 16px; margin-bottom: 28px;">
            <p style="color: #a86530; font-size: 13px; margin: 0;">🔒 <strong>Mantén este código seguro.</strong> No lo compartas con nadie fuera de tu equipo.</p>
          </div>
          <p style="color: #9a8a7e; font-size: 12px; text-align: center; margin: 0;">Sistema de gestión · Panadería</p>
        </div>
      </div>
    `,
  });
}

export async function crearUsuario(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const tNameUser = formData.get("tNameUser") as string;
    const tEmailUser = formData.get("tEmailUser") as string;
    const tRolUser = formData.get("tRolUser") as string;

    const eCodeUser = await generarCodigoUnico(adminClient);

    const sufijo = process.env.PIN_SECRET_SUFFIX ?? "PAN_SECRET_2024";
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

    const supabase = await createClient(); // ya debes tener esto importado
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    const { data: perfilAdmin } = await supabase
      .from("perfiles")
      .select("fkeCodCompany")
      .eq("eCodUser", adminUser!.id)
      .single();

    const fkeCodCompany = perfilAdmin?.fkeCodCompany;
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
      await enviarEmailBienvenida(tNameUser, tEmailUser, eCodeUser);
    } catch (emailError) {
      console.error("Error enviando email:", emailError);
    }

    revalidatePath("/admin/usuarios");
    return { perfil: perfil as Perfil };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message ?? e}` };
  }
}

export async function editarUsuario(formData: FormData) {
  try {
    const adminClient = createAdminClient();

    const eCodUser = formData.get("eCodUser") as string;
    const tNameUser = formData.get("tNameUser") as string;
    const tEmailUser = formData.get("tEmailUser") as string;
    const tRolUser = formData.get("tRolUser") as string;

    const { data: perfil, error } = await adminClient
      .from("perfiles")
      .update({ tNameUser, tEmailUser, tRolUser, fhUpdateUser: new Date().toISOString() })
      .eq("eCodUser", eCodUser)
      .select()
      .single();

    if (error) return { error: `Error al actualizar: ${error.message}` };

    revalidatePath("/admin/usuarios");
    return { perfil: perfil as Perfil };
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message}` };
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
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message}` };
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
  } catch (e: any) {
    return { error: `Error inesperado: ${e?.message}` };
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
  } catch (e: any) {
    return { error: e?.message };
  }
}
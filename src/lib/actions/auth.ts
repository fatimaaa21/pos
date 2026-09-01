"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarBloqueo, registrarIntento } from "@/lib/utils/loginAttempts";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function obtenerIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "desconocida";
}

type ResultadoAuth =
  | { error: string }
  | { ok: true; rol: string };

/**
 * Núcleo compartido de autenticación por PIN, escopado a un negocio
 * (fkeCodCompany) o al pool de sistemas (fkeCodCompany = null).
 * No redirige — eso lo hace cada wrapper público según el rol.
 */
async function autenticar(
  fkeCodCompany: string | null,
  codigo: string,
  rolesPermitidos: string[]
): Promise<ResultadoAuth> {
  const ip = await obtenerIp();

  const bloqueo = await verificarBloqueo(fkeCodCompany, codigo, ip);
  if (bloqueo.bloqueado) {
    return { error: bloqueo.motivo };
  }
  if (bloqueo.delayMs > 0) {
    await sleep(bloqueo.delayMs);
  }

  const adminClient = createAdminClient();
  let query = adminClient
    .from("perfiles")
    .select("tEmailUser, tRolUser")
    .eq("eCodeUser", codigo)
    .eq("bStateUser", true)
    .in("tRolUser", rolesPermitidos);
  query = fkeCodCompany === null
    ? query.is("fkeCodCompany", null)
    : query.eq("fkeCodCompany", fkeCodCompany);

  const { data: perfil, error: perfilError } = await query.single();

  if (perfilError || !perfil) {
    await registrarIntento(fkeCodCompany, codigo, ip, false);
    return { error: "Código incorrecto" };
  }

  const sufijo = process.env.PIN_SECRET_SUFFIX;
  if (!sufijo) {
    console.error("PIN_SECRET_SUFFIX no está configurado en el entorno");
    return { error: "Error de configuración del servidor" };
  }
  const passwordInterna = `${codigo}${sufijo}`;

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: perfil.tEmailUser,
    password: passwordInterna,
  });

  if (authError) {
    await registrarIntento(fkeCodCompany, codigo, ip, false);
    return { error: "Código incorrecto" };
  }

  await registrarIntento(fkeCodCompany, codigo, ip, true);
  revalidatePath("/", "layout");
  return { ok: true, rol: perfil.tRolUser };
}

/** Login exclusivo del rol sistemas — pool aislado, nunca coincide con admin/empleado. */
export async function loginSistemas(codigo: string) {
  const resultado = await autenticar(null, codigo, ["sistemas"]);
  if ("error" in resultado) return resultado;
  redirect("/sistemas/dashboard");
}

/** Login de admin/empleado, escopado al negocio identificado por su slug. */
export async function loginNegocio(slug: string, codigo: string) {
  const adminClient = createAdminClient();
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("eCodCompany, bStateCompany")
    .eq("tSlugCompany", slug)
    .single();

  if (!negocio || negocio.bStateCompany !== "activo") {
    return { error: "Negocio no encontrado" };
  }

  const resultado = await autenticar(negocio.eCodCompany, codigo, ["admin", "empleado"]);
  if ("error" in resultado) return resultado;

  // Recordar el slug para logout / re-acceso — cookie no sensible, solo el slug.
  const cookieStore = await cookies();
  cookieStore.set("kivi_negocio_slug", slug, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  if (resultado.rol === "admin") redirect("/admin/dashboard");
  redirect("/empleado/menu");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");

  const cookieStore = await cookies();
  const slug = cookieStore.get("kivi_negocio_slug")?.value;

  if (slug) {
    redirect(`/auth/login/${slug}`);
  }
  redirect("/auth/login");
}
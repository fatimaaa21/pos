/**
 * Cambia el PIN de un solo perfil (por email), sincronizando
 * eCodeUser en la tabla `perfiles` y la contraseña en Supabase Auth
 * al mismo tiempo, para no dejarlos desincronizados.
 *
 * Requiere las mismas variables que regenerar-passwords.mjs
 * (SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * PIN_SECRET_SUFFIX) en .env.local o .env.
 *
 * Uso:
 *   node cambiar-pin.mjs enifca21@gmail.com 8347
 *
 * El código nuevo lo eliges tú — usa algo no obvio, no secuencial,
 * no relacionado con fechas conocidas.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

function cargarEnv() {
  const candidatos = [".env.local", ".env"];
  for (const archivo of candidatos) {
    if (existsSync(archivo)) {
      const contenido = readFileSync(archivo, "utf-8");
      for (const linea of contenido.split("\n")) {
        const limpia = linea.trim();
        if (!limpia || limpia.startsWith("#")) continue;
        const idx = limpia.indexOf("=");
        if (idx === -1) continue;
        const key = limpia.slice(0, idx).trim();
        let value = limpia.slice(idx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
      return;
    }
  }
}

cargarEnv();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUFIJO = process.env.PIN_SECRET_SUFFIX;

const [, , email, codigoNuevo] = process.argv;

if (!email || !codigoNuevo) {
  console.error("Uso: node cambiar-pin.mjs <email> <codigoNuevo4digitos>");
  process.exit(1);
}

if (!/^\d{4}$/.test(codigoNuevo)) {
  console.error("El código debe ser exactamente 4 dígitos numéricos");
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUFIJO) {
  console.error("Faltan variables de entorno requeridas");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: perfil, error: findError } = await supabase
    .from("perfiles")
    .select("eCodUser, eCodeUser, tNameUser, tRolUser")
    .eq("tEmailUser", email)
    .single();

  if (findError || !perfil) {
    console.error(`No se encontró perfil con email ${email}:`, findError?.message);
    process.exit(1);
  }

  console.log(`Perfil encontrado: ${perfil.tNameUser} (${perfil.tRolUser}), código actual: ${perfil.eCodeUser}`);

  // 1. Verificar que el código nuevo no choque con otro perfil existente
  const { data: choque } = await supabase
    .from("perfiles")
    .select("eCodUser")
    .eq("eCodeUser", codigoNuevo)
    .neq("eCodUser", perfil.eCodUser)
    .maybeSingle();

  if (choque) {
    console.error(`El código ${codigoNuevo} ya está en uso por otro perfil. Elige otro.`);
    process.exit(1);
  }

  // 2. Actualizar la tabla perfiles
  const { error: updateError } = await supabase
    .from("perfiles")
    .update({ eCodeUser: codigoNuevo, fhUpdateUser: new Date().toISOString() })
    .eq("eCodUser", perfil.eCodUser);

  if (updateError) {
    console.error("Error actualizando perfiles:", updateError.message);
    process.exit(1);
  }

  // 3. Sincronizar contraseña en Supabase Auth
  const nuevaPassword = `${codigoNuevo}${SUFIJO}`;
  const { error: authError } = await supabase.auth.admin.updateUserById(perfil.eCodUser, {
    password: nuevaPassword,
  });

  if (authError) {
    console.error("Error actualizando contraseña en Auth:", authError.message);
    console.error("ATENCIÓN: la tabla perfiles ya se actualizó pero Auth falló — quedaron desincronizados. Revertir manualmente el eCodeUser o reintentar.");
    process.exit(1);
  }

  console.log(`Listo. ${email} ahora tiene el código ${codigoNuevo}, sincronizado en perfiles y Auth.`);
}

main();

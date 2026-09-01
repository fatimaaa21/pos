/**
 * Regenera la contraseña interna de cada perfil en Supabase Auth
 * usando el PIN_SECRET_SUFFIX nuevo.
 *
 * CORRE ESTO LOCALMENTE, NUNCA EN UN ENTORNO COMPARTIDO.
 * Requiere las siguientes variables de entorno (mismas que ya tienes en .env local,
 * asegúrate de que PIN_SECRET_SUFFIX sea EXACTAMENTE el valor nuevo que pusiste en Vercel):
 *
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=xxxx
 *   PIN_SECRET_SUFFIX=xxxx   (el valor NUEVO)
 *
 * Instalar dependencia si no la tienes:
 *   npm install @supabase/supabase-js
 *
 * Uso:
 *   node regenerar-passwords.mjs --dry-run     # solo muestra qué haría, no cambia nada
 *   node regenerar-passwords.mjs --run         # ejecuta de verdad
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

// Carga variables desde .env.local o .env (formato simple KEY=VALUE por línea),
// sin depender de exportarlas manualmente en la shell.
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
        // Quita comillas envolventes si las hay
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
      console.log(`(Variables cargadas desde ${archivo})`);
      return;
    }
  }
  console.log("(No se encontró .env.local ni .env — usando solo variables ya exportadas)");
}

cargarEnv();

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUFIJO_NUEVO = process.env.PIN_SECRET_SUFFIX;

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isRun = args.includes("--run");

if (!isDryRun && !isRun) {
  console.error("Especifica --dry-run o --run");
  process.exit(1);
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUFIJO_NUEVO) {
  console.error(
    "Faltan variables de entorno: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PIN_SECRET_SUFFIX"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Pequeña pausa entre llamadas para no golpear el rate limit del admin API de Supabase Auth
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(isDryRun ? "=== MODO DRY-RUN (no se cambia nada) ===" : "=== MODO RUN (cambios reales) ===");

  const { data: perfiles, error } = await supabase
    .from("perfiles")
    .select("eCodUser, eCodeUser, tEmailUser, tNameUser, bStateUser");

  if (error) {
    console.error("Error leyendo perfiles:", error.message);
    process.exit(1);
  }

  console.log(`Encontrados ${perfiles.length} perfiles.\n`);

  const resultados = { ok: [], error: [], omitidos: [] };

  for (const perfil of perfiles) {
    const id = perfil.eCodUser;
    const codigoCrudo = perfil.eCodeUser;
    const codigo = (codigoCrudo ?? "").trim();

    if (!codigo || codigo.length === 0) {
      resultados.omitidos.push({ id, email: perfil.tEmailUser, razon: "eCodeUser vacío" });
      continue;
    }

    const nuevaPassword = `${codigo}${SUFIJO_NUEVO}`;

    if (isDryRun) {
      console.log(
        `[DRY-RUN] ${perfil.tNameUser ?? "(sin nombre)"} <${perfil.tEmailUser}> — código="${codigo}" (longitud ${codigo.length}) — se actualizaría`
      );
      resultados.ok.push({ id, email: perfil.tEmailUser });
      continue;
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(id, {
      password: nuevaPassword,
    });

    if (updateError) {
      console.error(`[ERROR] ${perfil.tEmailUser}: ${updateError.message}`);
      resultados.error.push({ id, email: perfil.tEmailUser, error: updateError.message });
    } else {
      console.log(`[OK] ${perfil.tEmailUser}`);
      resultados.ok.push({ id, email: perfil.tEmailUser });
    }

    // Pausa breve para no saturar el admin API
    await sleep(150);
  }

  console.log("\n=== RESUMEN ===");
  console.log(`OK: ${resultados.ok.length}`);
  console.log(`Errores: ${resultados.error.length}`);
  console.log(`Omitidos: ${resultados.omitidos.length}`);

  if (resultados.error.length > 0) {
    console.log("\nPerfiles con error (necesitan atención manual):");
    resultados.error.forEach((r) => console.log(`  - ${r.email}: ${r.error}`));
  }
  if (resultados.omitidos.length > 0) {
    console.log("\nPerfiles omitidos (sin código válido):");
    resultados.omitidos.forEach((r) => console.log(`  - ${r.email}: ${r.razon}`));
  }
}

main();

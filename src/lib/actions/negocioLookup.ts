"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { verificarBloqueoBusqueda, registrarBusqueda } from "@/lib/utils/negocioAttempts";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function obtenerIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "desconocida";
}

// Tiempo mínimo de respuesta, para que "no existe" y "existe pero..." tarden
// lo mismo y no sirvan de oráculo de qué negocios existen. Mitigación básica,
// no una garantía de tiempo constante a nivel criptográfico.
const RESPUESTA_MINIMA_MS = 400;

export async function buscarYRedirigirNegocio(entrada: string) {
  const ip = await obtenerIp();

  const bloqueo = await verificarBloqueoBusqueda(ip);
  if (bloqueo.bloqueado) {
    return { error: bloqueo.motivo };
  }
  if (bloqueo.delayMs > 0) {
    await sleep(bloqueo.delayMs);
  }

  const inicio = Date.now();
  const texto = entrada.trim();

  if (!texto) {
    return { error: "Escribe el nombre o el identificador de tu negocio" };
  }

  await registrarBusqueda(ip);

  const adminClient = createAdminClient();

  const { data: porSlug } = await adminClient
    .from("negocios")
    .select("tSlugCompany, bStateCompany")
    .eq("tSlugCompany", texto.toLowerCase())
    .maybeSingle();

  let negocio = porSlug;
  if (!negocio) {
    const { data: porNombre } = await adminClient
      .from("negocios")
      .select("tSlugCompany, bStateCompany")
      .ilike("tNameCompany", texto)
      .maybeSingle();
    negocio = porNombre;
  }

  const transcurrido = Date.now() - inicio;
  if (transcurrido < RESPUESTA_MINIMA_MS) {
    await sleep(RESPUESTA_MINIMA_MS - transcurrido);
  }

  if (!negocio || negocio.bStateCompany !== "activo") {
    return { error: "No encontramos ese negocio. Verifica el nombre e intenta de nuevo." };
  }

  redirect(`/auth/login/${negocio.tSlugCompany}`);
}
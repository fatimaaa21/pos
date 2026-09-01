"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Tiempo mínimo de respuesta, para que "no existe" y "existe pero..." (casos
// que ya se descartaron) tarden lo mismo y no sirvan de oráculo de qué
// negocios existen. No es una garantía criptográfica de tiempo constante,
// es una mitigación básica — normaliza la variación más obvia (una query
// de más vs. una de menos), no protege contra medición estadística fina.
const RESPUESTA_MINIMA_MS = 400;

export async function buscarYRedirigirNegocio(entrada: string) {
  const inicio = Date.now();
  const texto = entrada.trim();

  if (!texto) {
    return { error: "Escribe el nombre o el identificador de tu negocio" };
  }

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
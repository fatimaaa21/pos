import { createAdminClient } from "@/lib/supabase/admin";

const VENTANA_MS = 15 * 60 * 1000; // 15 minutos

// Umbral más bajo que el de login (10 vs. 5) porque una persona real
// buscando su propio negocio rara vez necesita más de un par de intentos —
// a diferencia del login por PIN, donde errores de tecleo son comunes.
const UMBRAL_DELAY = 5;
const MAX_DURO = 30;
const DELAY_POR_INTENTO_MS = 400;

type ResultadoVerificacion =
  | { bloqueado: true; motivo: string }
  | { bloqueado: false; delayMs: number };

export async function verificarBloqueoBusqueda(ip: string): Promise<ResultadoVerificacion> {
  const adminClient = createAdminClient();
  const desde = new Date(Date.now() - VENTANA_MS).toISOString();

  const { count } = await adminClient
    .from("busqueda_negocio_intentos")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("fhAttempt", desde);

  if ((count ?? 0) >= MAX_DURO) {
    return { bloqueado: true, motivo: "Demasiadas búsquedas. Espera unos minutos e intenta de nuevo." };
  }

  const exceso = Math.max(0, (count ?? 0) - UMBRAL_DELAY);
  return { bloqueado: false, delayMs: exceso * DELAY_POR_INTENTO_MS };
}

export async function registrarBusqueda(ip: string) {
  const adminClient = createAdminClient();
  const { error } = await adminClient.from("busqueda_negocio_intentos").insert({ ip });
  if (error) {
    console.error("Error registrando búsqueda de negocio:", error.message);
  }
}
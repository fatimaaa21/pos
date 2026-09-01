import { createAdminClient } from "@/lib/supabase/admin";

const VENTANA_MS = 15 * 60 * 1000; // 15 minutos

// Por código específico dentro de un negocio (o del pool de sistemas):
// bloqueo duro, es el ataque más simple de frenar sin afectar a nadie más.
const MAX_FALLOS_CODIGO = 5;

// Por IP dentro de un negocio (o sistemas): en vez de bloqueo duro a un umbral
// bajo (que tumbaría el negocio completo con solo un par de empleados
// tecleando mal en hora pico), se usa backoff progresivo a partir de un
// umbral más alto, y bloqueo duro solo a un umbral mucho más alto.
const UMBRAL_DELAY_IP = 10;
const MAX_FALLOS_IP = 40;
const DELAY_POR_INTENTO_MS = 300;

type ResultadoVerificacion =
  | { bloqueado: true; motivo: string }
  | { bloqueado: false; delayMs: number };

export async function verificarBloqueo(
  fkeCodCompany: string | null,
  eCodeUser: string,
  ip: string
): Promise<ResultadoVerificacion> {
  const adminClient = createAdminClient();
  const desde = new Date(Date.now() - VENTANA_MS).toISOString();

  let queryCodigo = adminClient
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("eCodeUser", eCodeUser)
    .eq("exitoso", false)
    .gte("fhAttempt", desde);
  queryCodigo = fkeCodCompany === null
    ? queryCodigo.is("fkeCodCompany", null)
    : queryCodigo.eq("fkeCodCompany", fkeCodCompany);

  const { count: fallosCodigo } = await queryCodigo;

  if ((fallosCodigo ?? 0) >= MAX_FALLOS_CODIGO) {
    return { bloqueado: true, motivo: "Demasiados intentos con este código. Espera unos minutos e intenta de nuevo." };
  }

  let queryIp = adminClient
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("exitoso", false)
    .gte("fhAttempt", desde);
  queryIp = fkeCodCompany === null
    ? queryIp.is("fkeCodCompany", null)
    : queryIp.eq("fkeCodCompany", fkeCodCompany);

  const { count: fallosIp } = await queryIp;

  if ((fallosIp ?? 0) >= MAX_FALLOS_IP) {
    return { bloqueado: true, motivo: "Demasiados intentos desde este dispositivo. Espera unos minutos e intenta de nuevo." };
  }

  const exceso = Math.max(0, (fallosIp ?? 0) - UMBRAL_DELAY_IP);
  return { bloqueado: false, delayMs: exceso * DELAY_POR_INTENTO_MS };
}

export async function registrarIntento(
  fkeCodCompany: string | null,
  eCodeUser: string,
  ip: string,
  exitoso: boolean
) {
  const adminClient = createAdminClient();
  const { error } = await adminClient.from("login_attempts").insert({
    fkeCodCompany,
    eCodeUser,
    ip,
    exitoso,
  });
  if (error) {
    // No bloquea el login si falla el registro — pero que quede visible
    // en los logs del servidor, porque un fallo aquí desactiva el límite
    // de intentos por completo sin ningún síntoma en la UI.
    console.error("Error registrando intento de login:", error.message);
  }
}
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Genera un código de 4 dígitos único, escopado a un negocio.
 *
 * - fkeCodCompany = uuid del negocio  → único dentro de ese negocio (admin/empleado)
 * - fkeCodCompany = null              → único dentro del pool de sistemas
 *
 * Requiere que existan los índices únicos parciales de la Fase 1
 * (perfiles_codigo_por_negocio_key y perfiles_codigo_sistemas_key);
 * si esos índices no existen, esta función puede devolver un código
 * que choque al insertar.
 */
export async function generarCodigoUnico(
  adminClient: ReturnType<typeof createAdminClient>,
  fkeCodCompany: string | null
): Promise<string> {
  for (let intentos = 0; intentos < 20; intentos++) {
    const codigo = String(Math.floor(1000 + Math.random() * 9000));

    let query = adminClient.from("perfiles").select("eCodeUser").eq("eCodeUser", codigo);
    query = fkeCodCompany === null
      ? query.is("fkeCodCompany", null)
      : query.eq("fkeCodCompany", fkeCodCompany);

    const { data } = await query.maybeSingle();
    if (!data) return codigo;
  }
  throw new Error("No se pudo generar un código único dentro de este alcance");
}
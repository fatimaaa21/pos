"use server";

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MermaHistorial {
  eCodMerma:       string;
  tTipo:           "producto" | "insumo";
  tNombreSnapshot: string;
  eCantidad:       number;
  tUnidadSnapshot: string | null;
  tMotivo:         string | null;
  fhCreateMerma:   string;
  tNombreEmpleado: string | null;
  eCodVenta:       string;
}

/**
 * Historial de mermas del negocio — productos/insumos que no se restauraron
 * al cancelar una venta porque ya se habían preparado/entregado. Se muestra
 * en /admin/insumos junto al historial de compras/ajustes.
 */
export async function obtenerHistorialMermas(): Promise<MermaHistorial[]> {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: perfilActual } = await adminClient
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user.id)
    .single();

  if (!perfilActual?.fkeCodCompany) return [];

  const { data: mermas } = await adminClient
    .from("mermas")
    .select("eCodMerma, tTipo, tNombreSnapshot, eCantidad, tUnidadSnapshot, tMotivo, fhCreateMerma, fkeCodUser, fkeCodVenta")
    .eq("fkeCodCompany", perfilActual.fkeCodCompany)
    .order("fhCreateMerma", { ascending: false })
    .limit(200);

  const userIds = [...new Set((mermas ?? []).map((m) => m.fkeCodUser))];
  let perfiles: { eCodUser: string; tNameUser: string }[] = [];

  if (userIds.length > 0) {
    const { data } = await adminClient
      .from("perfiles")
      .select("eCodUser, tNameUser")
      .in("eCodUser", userIds);
    perfiles = data ?? [];
  }

  const perfilesMap = new Map(perfiles.map((p) => [p.eCodUser, p.tNameUser]));

  return (mermas ?? []).map((m) => ({
    eCodMerma:       m.eCodMerma,
    tTipo:           m.tTipo,
    tNombreSnapshot: m.tNombreSnapshot,
    eCantidad:       m.eCantidad,
    tUnidadSnapshot: m.tUnidadSnapshot,
    tMotivo:         m.tMotivo,
    fhCreateMerma:   m.fhCreateMerma,
    tNombreEmpleado: perfilesMap.get(m.fkeCodUser) ?? null,
    eCodVenta:       m.fkeCodVenta,
  }));
}

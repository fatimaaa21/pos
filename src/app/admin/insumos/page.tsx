import { createClient }       from "@/lib/supabase/server";
import { InsumosClient }      from "./InsumosClient";
import { getSucursalContext } from "@/lib/utils/sucursal";
import { obtenerSucursales }  from "@/lib/actions/sucursales";
import { getInsumos }         from "@/lib/actions/insumos";
import type { Sucursal } from "@/types";

export default async function InsumosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfilActual } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfilActual?.fkeCodCompany;

  const [ctx, sucursalesData, insumos] = await Promise.all([
    getSucursalContext(),
    obtenerSucursales(),
    getInsumos(),
  ]);

  const sucursales = sucursalesData.map((s: Sucursal) => ({
    eCodSucursal: s.eCodSucursal,
    tNombre:      s.tNombre,
  }));

  return (
    <InsumosClient
      insumos={insumos}
      fkeCodCompany={fkeCodCompany}
      fkeCodSucursal={ctx.fkeCodSucursal} // null = admin viendo "todas las sucursales"
      sucursales={sucursales}
    />
  );
}
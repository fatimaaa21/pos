import { createClient } from "@/lib/supabase/server";
import { obtenerDatosMenuPOS } from "@/lib/data/menu-pos";
import { obtenerAutoconsumoDelTurno } from "@/lib/actions/autoconsumo";
import { AutoconsumoClient } from "./AutoconsumoClient";

export default async function AutoconsumoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany, fkeCodSucursal")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfil?.fkeCodCompany;

  if (!fkeCodCompany) {
    return (
      <AutoconsumoClient categorias={[]} productos={[]} historialInicial={[]} />
    );
  }

  const [datos, historial] = await Promise.all([
    obtenerDatosMenuPOS(fkeCodCompany, perfil?.fkeCodSucursal ?? null),
    obtenerAutoconsumoDelTurno(),
  ]);

  return (
    <AutoconsumoClient
      categorias={datos.categorias}
      productos={datos.productos}
      historialInicial={historial}
    />
  );
}

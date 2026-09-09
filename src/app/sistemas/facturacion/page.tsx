import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect }          from "next/navigation";
import { FacturacionClient, type NegocioConFacturacion } from "./FacturacionClient";

export default async function SistemasFacturacionPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("tRolUser")
    .eq("eCodUser", user.id)
    .single();

  // El middleware ya restringe /sistemas a este rol, pero no confiamos solo
  // en eso — mismo criterio aplicado al resto de las acciones esta sesión.
  if (perfil?.tRolUser !== "sistemas") redirect("/auth/login");

  const { data: negocios, error } = await supabase
    .from("negocios")
    .select("eCodCompany, tNameCompany, imgCompany, tipo_negocio, bStateCompany")
    .order("tNameCompany", { ascending: true });

  if (error) console.error("Error cargando negocios:", error.message);

  // facturacion_negocios tiene RLS habilitado sin policies — solo se puede
  // leer con el admin client, y ya verificamos arriba que quien pide esto
  // es realmente "sistemas".
  const adminClient = createAdminClient();

  const { data: facturacion, error: errorFacturacion } = await adminClient
    .from("facturacion_negocios")
    .select("fkeCodCompany, eMontoMensual, eMontoMensualPendiente, eDiaCobro, eDiaCobroPendiente, tEstadoDomiciliacion");

  if (errorFacturacion) console.error("Error cargando facturación:", errorFacturacion.message);

  const facturacionPorNegocio = new Map(
    (facturacion ?? []).map((f) => [f.fkeCodCompany, f])
  );

  const negociosConFacturacion: NegocioConFacturacion[] = (negocios ?? []).map((n) => {
    const fact = facturacionPorNegocio.get(n.eCodCompany);
    return {
      eCodCompany:            n.eCodCompany,
      tNameCompany:           n.tNameCompany,
      imgCompany:             n.imgCompany ?? null,
      tipo_negocio:           (n.tipo_negocio ?? "general") as NegocioConFacturacion["tipo_negocio"],
      bStateCompany:          n.bStateCompany,
      eMontoMensual:          fact?.eMontoMensual ?? null,
      eMontoMensualPendiente: fact?.eMontoMensualPendiente ?? null,
      eDiaCobro:              fact?.eDiaCobro ?? null,
      eDiaCobroPendiente:     fact?.eDiaCobroPendiente ?? null,
      tEstadoDomiciliacion:   (fact?.tEstadoDomiciliacion ?? null) as NegocioConFacturacion["tEstadoDomiciliacion"],
    };
  });

  return <FacturacionClient negocios={negociosConFacturacion} />;
}
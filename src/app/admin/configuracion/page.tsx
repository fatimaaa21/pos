import { redirect }            from "next/navigation";
import { getConfigNegocio }    from "@/lib/actions/configuracion";
import { getMetodosParaAdmin } from "@/lib/actions/metodos-pago";
import { ConfiguracionClient } from "./configuracionClient";

export default async function ConfiguracionPage() {
  const [config, { catalogo, activados, codCompany }] = await Promise.all([
    getConfigNegocio(),
    getMetodosParaAdmin(),
  ]);

  if (!config) redirect("/admin/dashboard");

  // Filtrar activados que ya no existan en el catálogo vigente
  const codsValidos     = new Set(catalogo.map((m) => m.eCodPay));
  const activadosLimpios = activados.filter((id) => codsValidos.has(id));

  return (
    <ConfiguracionClient
      config={config}
      catalogo={catalogo}
      activados={activadosLimpios}
      codCompany={codCompany}
    />
  );
}
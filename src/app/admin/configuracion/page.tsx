import { redirect } from "next/navigation";
import { getConfigNegocio } from "@/lib/actions/configuracion";
import { ConfiguracionClient } from "./configuracionClient";

export default async function ConfiguracionPage() {
  const config = await getConfigNegocio();

  if (!config) redirect("/admin/dashboard");

  return <ConfiguracionClient config={config} />;
}
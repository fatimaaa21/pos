import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductClient } from "./ProductosClient";
import type { Producto } from "@/types";

export default async function ProductsPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfilActual } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfilActual?.fkeCodCompany;

  // Leer tipo_negocio del negocio actual
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("tipo_negocio")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  const tipoNegocio = negocio?.tipo_negocio ?? "general";

  const { data: productos, error } = await supabase
    .from("productos")
    .select(`*, categorias (eCodCategory, tNameCategory)`)
    .eq("fkeCodCompany", fkeCodCompany)
    .order("eCodProduct", { ascending: true });

  if (error) console.error("Error cargando productos:", error);

  return (
    <ProductClient
      productos={(productos as Producto[]) ?? []}
      tipoNegocio={tipoNegocio}
    />
  );
}
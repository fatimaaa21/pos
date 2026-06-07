import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductClient }             from "./ProductosClient";
import { ProductosImpresionClient }  from "./ProductosImpresionClient";
import type { Producto, Categoria } from "@/types";

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

  // Categorías filtradas por negocio — server side garantiza aislamiento
  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory")
    .eq("fkeCodCompany", fkeCodCompany)
    .eq("bStateCategory", true)
    .order("tNameCategory");

  const lista       = (productos  as Producto[])  ?? [];
  const listaCats   = (categorias as Categoria[]) ?? [];

  if (tipoNegocio === "impresion") {
    return (
      <ProductosImpresionClient
        productos={lista}
        categorias={listaCats}
        tipoNegocio={tipoNegocio}
      />
    );
  }

  return (
  <ProductClient
    productos={lista}
    categorias={listaCats}
    tipoNegocio={tipoNegocio}
  />
);
}
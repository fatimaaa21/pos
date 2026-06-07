import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InventarioEmpleadoClient }           from "./InventarioClient";
import { InventarioImpresionEmpleadoClient }  from "./InventarioImpresionEmpleadoClient";
import type { ProductoConStock, Categoria, Material } from "@/types";

export default async function InventarioEmpleadoPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfil?.fkeCodCompany;

  // ── Tipo de negocio ───────────────────────────────────────────────────────
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("tipo_negocio")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  const tipoNegocio = negocio?.tipo_negocio ?? "general";

  // ── Rama impresion ────────────────────────────────────────────────────────
  if (tipoNegocio === "impresion") {
    const { data: materiales } = await adminClient
      .from("materiales")
      .select("*")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bStateMaterial", true)
      .order("fhCreateMaterial", { ascending: false });

    return (
      <InventarioImpresionEmpleadoClient
        materiales={(materiales as Material[]) ?? []}
      />
    );
  }

  // ── Rama general (lógica original intacta) ────────────────────────────────
  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory")
    .eq("fkeCodCompany", fkeCodCompany)
    .eq("bStateCategory", true)
    .order("tNameCategory");

  const { data: productosDelNegocio } = await supabase
    .from("productos")
    .select("eCodProduct")
    .eq("fkeCodCompany", fkeCodCompany);

  const idsProductos = (productosDelNegocio ?? []).map((p) => p.eCodProduct);

  if (idsProductos.length === 0) {
    return (
      <InventarioEmpleadoClient
        categorias={(categorias as Categoria[]) ?? []}
        productos={[]}
      />
    );
  }

  const { data: lotes } = await supabase
    .from("vista_inventario")
    .select("fkeCodProduct, eCantRestante, eCantIngresada, eStockMinimo")
    .in("fkeCodProduct", idsProductos)
    .eq("bStateInventory", true);

  const ingresadoPorProducto = new Map<string, number>();

  if (!lotes || lotes.length === 0) {
    return (
      <InventarioEmpleadoClient
        categorias={(categorias as Categoria[]) ?? []}
        productos={[]}
      />
    );
  }

  const idsConStock = [...new Set(lotes.map((l) => l.fkeCodProduct))];

  const { data: productos } = await supabase
    .from("productos")
    .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
    .in("eCodProduct", idsConStock)
    .eq("bStateProduct", true);

  const stockPorProducto  = new Map<string, number>();
  const minimoPorProducto = new Map<string, number>();

  for (const lote of lotes) {
    const actual = stockPorProducto.get(lote.fkeCodProduct) ?? 0;
    stockPorProducto.set(lote.fkeCodProduct, actual + lote.eCantRestante);

    const ingresado = ingresadoPorProducto.get(lote.fkeCodProduct) ?? 0;
    ingresadoPorProducto.set(lote.fkeCodProduct, ingresado + lote.eCantIngresada);

    const minActual = minimoPorProducto.get(lote.fkeCodProduct) ?? 0;
    minimoPorProducto.set(lote.fkeCodProduct, Math.max(minActual, lote.eStockMinimo));
  }

  const productosConStock = (productos ?? []).map((p) => ({
    eCodProduct:     p.eCodProduct,
    tNameProduct:    p.tNameProduct,
    fkeCodCategory:  p.fkeCodCategory,
    ePriceProduct:   p.ePriceProduct,
    ImgProduct:      p.ImgProduct,
    stockDisponible: stockPorProducto.get(p.eCodProduct) ?? 0,
    stockMinimo:     minimoPorProducto.get(p.eCodProduct) ?? 0,
    stockIngresado:  ingresadoPorProducto.get(p.eCodProduct) ?? 0,
  }));

  return (
    <InventarioEmpleadoClient
      categorias={(categorias as Categoria[]) ?? []}
      productos={productosConStock}
    />
  );
}
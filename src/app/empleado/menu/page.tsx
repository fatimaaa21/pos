import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MenuClient }        from "./MenuClient";
import type { Categoria, ProductoConStock } from "@/types";
import type { MetodoPagoGlobal }            from "@/lib/actions/metodos-pago";

export default async function MenuPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  // ── Usuario y negocio ─────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfil?.fkeCodCompany;

  // ── Métodos de pago activos del negocio ───────────────────────────────────
  // 1. IDs seleccionados por el admin
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("metodosPago")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  const idsSeleccionados: string[] = negocio?.metodosPago ?? [];

  // 2. Datos completos de esos métodos (en el orden definido por Sistemas)
  let metodosPago: MetodoPagoGlobal[] = [];
  if (idsSeleccionados.length > 0) {
    const { data: metodos } = await adminClient
      .from("metodos_pago")
      .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay, orden")
      .in("eCodPay", idsSeleccionados)
      .eq("bStatePay", true)
      .order("orden");

    metodosPago = (metodos as MetodoPagoGlobal[]) ?? [];
  }

  // ── Categorías ────────────────────────────────────────────────────────────
  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory")
    .eq("bStateCategory", true)
    .order("tNameCategory");

  // ── Stock ─────────────────────────────────────────────────────────────────
  const { data: lotes, error } = await supabase
    .from("vista_inventario")
    .select("fkeCodProduct, eCantRestante")
    .eq("bStateInventory", true)
    .gt("eCantRestante", 0);

  if (error) console.error("Error:", JSON.stringify(error));

  if (!lotes || lotes.length === 0) {
    return (
      <MenuClient
        categorias={(categorias as Categoria[]) ?? []}
        productos={[]}
        metodosPago={metodosPago}
      />
    );
  }

  const idsConStock = [...new Set(lotes.map((l) => l.fkeCodProduct))];

  const { data: productos } = await supabase
    .from("productos")
    .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
    .in("eCodProduct", idsConStock)
    .eq("bStateProduct", true);

  const stockPorProducto = new Map<string, number>();
  for (const lote of lotes) {
    const actual = stockPorProducto.get(lote.fkeCodProduct) ?? 0;
    stockPorProducto.set(lote.fkeCodProduct, actual + lote.eCantRestante);
  }

  const productosConStock: ProductoConStock[] = (productos ?? []).map((p) => ({
    eCodProduct:     p.eCodProduct,
    tNameProduct:    p.tNameProduct,
    fkeCodCategory:  p.fkeCodCategory,
    ePriceProduct:   p.ePriceProduct,
    ImgProduct:      p.ImgProduct,
    stockDisponible: stockPorProducto.get(p.eCodProduct) ?? 0,
  }));

  return (
    <MenuClient
      categorias={(categorias as Categoria[]) ?? []}
      productos={productosConStock}
      metodosPago={metodosPago}
    />
  );
}
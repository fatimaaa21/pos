import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InventarioClient }  from "./InventarioClient";
import type { InventarioConProducto } from "./InventarioClient";

export default async function InventarioPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: perfilActual } = await supabase
    .from("perfiles")
    .select("fkeCodCompany")
    .eq("eCodUser", user!.id)
    .single();

  const fkeCodCompany = perfilActual?.fkeCodCompany;

  const { data: productosDelNegocio } = await supabase
    .from("productos")
    .select("eCodProduct")
    .eq("fkeCodCompany", fkeCodCompany);

  const idsProductos = (productosDelNegocio ?? []).map((p) => p.eCodProduct);

  if (idsProductos.length === 0) {
    return <InventarioClient inventario={[]} />;
  }

  // 1. Inventario desde la vista (sin join a presentaciones — las vistas no tienen FK en PostgREST)
  const { data: inventarioRaw, error } = await supabase
    .from("vista_inventario")
    .select(`
      *,
      productos!inventario_fkeCodProduct_fkey (
        tNameProduct,
        ImgProduct,
        ePriceProduct,
        categorias (
          eCodCategory,
          tNameCategory
        )
      )
    `)
    .in("fkeCodProduct", idsProductos)
    .order("fhCreateInventory", { ascending: false });

  if (error) console.error("Error cargando inventario:", error);

  const lotes = inventarioRaw ?? [];

  // 2. Recoger IDs de presentaciones que existen en estos lotes
  const idsPresentacion = [
    ...new Set(
      lotes
        .map((l: any) => l.fkeCodPresentacion as string | null)
        .filter(Boolean) as string[]
    ),
  ];

  // 3. Buscar nombres y precios de esas presentaciones (admin client para bypassear RLS)
  const presMap = new Map<string, { tNombre: string; ePricePresentacion: number }>();

  if (idsPresentacion.length > 0) {
    const { data: pres } = await adminClient
      .from("presentaciones")
      .select("eCodPresentacion, tNombre, ePricePresentacion")
      .in("eCodPresentacion", idsPresentacion);

    for (const p of pres ?? []) {
      presMap.set(p.eCodPresentacion, {
        tNombre:            p.tNombre,
        ePricePresentacion: p.ePricePresentacion,
      });
    }
  }

  // 4. Combinar: inyectar `presentaciones` en cada lote
  const inventario: InventarioConProducto[] = lotes.map((l: any) => ({
    ...l,
    presentaciones: l.fkeCodPresentacion
      ? (presMap.get(l.fkeCodPresentacion) ?? null)
      : null,
  }));

  return <InventarioClient inventario={inventario} />;
}
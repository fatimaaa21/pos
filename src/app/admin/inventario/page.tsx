import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { InventarioClient }  from "./InventarioClient";
import { InventarioImpresionClient } from "./InventarioImpresionClient";
import type { InventarioConProducto } from "./InventarioClient";
import type { Material } from "@/types";
import { getSucursalContext }  from "@/lib/utils/sucursal";
import { obtenerSucursales }   from "@/lib/actions/sucursales";
import type { Sucursal }       from "@/types";

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

  const [ctx, sucursalesData] = await Promise.all([
    getSucursalContext(),
    obtenerSucursales(),
  ]);

  const fkeCodSucursal = ctx.fkeCodSucursal;
  const sucursales     = sucursalesData.map((s: Sucursal) => ({
    eCodSucursal: s.eCodSucursal,
    tNombre:      s.tNombre,
  }));

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
      .order("fhCreateMaterial", { ascending: false });

    return (
      <InventarioImpresionClient
        materiales={(materiales as Material[]) ?? []}
      />
    );
  }

  // ── Rama general (lógica original intacta) ────────────────────────────────
  const { data: productosDelNegocio } = await supabase
    .from("productos")
    .select("eCodProduct")
    .eq("fkeCodCompany", fkeCodCompany);

  const idsProductos = (productosDelNegocio ?? []).map((p) => p.eCodProduct);

  if (idsProductos.length === 0) {
    return <InventarioClient inventario={[]} tipoNegocio={tipoNegocio} fkeCodCompany={fkeCodCompany} fkeCodSucursal={fkeCodSucursal} 
    sucursales={sucursales} />;
  }

  let inventarioQuery = adminClient
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

  if (fkeCodSucursal) {
    inventarioQuery = inventarioQuery.eq("fkeCodSucursal", fkeCodSucursal);
  }

  const { data: inventarioRaw, error } = await inventarioQuery;

  if (error) console.error("Error cargando inventario:", error);

  const lotes = inventarioRaw ?? [];

  const idsPresentacion = [
    ...new Set(
      lotes
        .map((l: any) => l.fkeCodPresentacion as string | null)
        .filter(Boolean) as string[]
    ),
  ];

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

  const inventario: InventarioConProducto[] = lotes.map((l: any) => ({
    ...l,
    presentaciones: l.fkeCodPresentacion
      ? (presMap.get(l.fkeCodPresentacion) ?? null)
      : null,
  }));

  return <InventarioClient inventario={inventario} tipoNegocio={tipoNegocio} fkeCodCompany={fkeCodCompany} fkeCodSucursal={fkeCodSucursal} sucursales={sucursales} />;
}
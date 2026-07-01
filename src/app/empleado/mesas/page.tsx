import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect }          from "next/navigation";
import { MesasClient }       from "./MesasClient";
import { verificarModuloMesas, obtenerMesasConEstado } from "@/lib/actions/mesas";
import type {
  Categoria, ProductoConStock,
  PresentacionConStock, MesaConEstado, ConceptoBillar,
} from "@/types";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";

export default async function MesasPage() {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("fkeCodCompany, tRolUser")
    .eq("eCodUser", user.id)
    .single();

  if (!perfil?.fkeCodCompany) redirect("/auth/login");
  const fkeCodCompany = perfil.fkeCodCompany;

  // ── Verificar módulo ──────────────────────────────────────────────────────
  const moduloActivo = await verificarModuloMesas(fkeCodCompany);

  if (!moduloActivo) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--gray)" }}>
        <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
          Módulo de mesas no disponible
        </p>
        <p style={{ fontSize: 13 }}>
          Contacta a Kivi para activar este módulo en tu negocio.
        </p>
      </div>
    );
  }

  // ── Mesas con estado ──────────────────────────────────────────────────────
  const mesas = await obtenerMesasConEstado();

  // ── Turno activo ──────────────────────────────────────────────────────────
  const { data: corteAbierto } = await adminClient
    .from("cortes_caja")
    .select("eCodCorte")
    .eq("fkeCodUser", user.id)
    .eq("bStateCorte", "abierto")
    .maybeSingle();

  const tieneTurno = corteAbierto !== null;

  // ── Métodos de pago ───────────────────────────────────────────────────────
  const { data: negocio } = await adminClient
    .from("negocios")
    .select("metodosPago, aplicarIva, tipo_negocio")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  const aplicarIva   = negocio?.aplicarIva    ?? true;
  const tipo_negocio = (negocio?.tipo_negocio ?? "general") as "general" | "impresion" | "billar";

  let conceptos: ConceptoBillar[] = [];
  if (tipo_negocio === "billar") {
    const { data: conceptosData } = await adminClient
      .from("conceptos_billar")
      .select("*")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bActivo", true)
      .order("fhCreate");
    conceptos = conceptosData ?? [];
  }
  let metodosPago: MetodoPagoGlobal[] = [];

  const idsSeleccionados: string[] = negocio?.metodosPago ?? [];
  if (idsSeleccionados.length > 0) {
    const { data: metodos } = await adminClient
      .from("metodos_pago")
      .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay")
      .in("eCodPay", idsSeleccionados)
      .eq("bStatePay", true);
    metodosPago = (metodos as MetodoPagoGlobal[]) ?? [];
  }

  // ── Categorías ────────────────────────────────────────────────────────────
  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory")
    .eq("fkeCodCompany", fkeCodCompany)
    .eq("bStateCategory", true)
    .order("tNameCategory");

  // ── Productos con stock (rama general) ───────────────────────────────────
  const { data: lotes } = await adminClient
    .from("vista_inventario")
    .select("fkeCodProduct, fkeCodPresentacion, eCantRestante, bUnlimitedInventory")
    .eq("fkeCodCompany", fkeCodCompany)
    .eq("bStateInventory", true)
    .or("bUnlimitedInventory.eq.true,eCantRestante.gt.0");

  const stockProducto    = new Map<string, number>();
  const infinitoProducto = new Map<string, boolean>();
  const stockPorPres     = new Map<string, number>();
  const infinitoPorPres  = new Map<string, boolean>();

  const lotesSinPres = (lotes ?? []).filter((l: any) => !l.fkeCodPresentacion);
  const lotesConPres = (lotes ?? []).filter((l: any) =>  l.fkeCodPresentacion);

  for (const l of lotesSinPres) {
    if (l.bUnlimitedInventory) infinitoProducto.set(l.fkeCodProduct, true);
    else stockProducto.set(l.fkeCodProduct, (stockProducto.get(l.fkeCodProduct) ?? 0) + (l.eCantRestante ?? 0));
  }
  for (const l of lotesConPres) {
    const pid = l.fkeCodPresentacion as string;
    if (l.bUnlimitedInventory) infinitoPorPres.set(pid, true);
    else stockPorPres.set(pid, (stockPorPres.get(pid) ?? 0) + (l.eCantRestante ?? 0));
  }

  const idsConStock = [...new Set([
    ...lotesSinPres.map((l: any) => l.fkeCodProduct as string),
    ...lotesConPres.map((l: any) => l.fkeCodProduct as string),
  ])];

  const { data: productos } = await adminClient
    .from("productos")
    .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
    .in("eCodProduct", idsConStock)
    .eq("bStateProduct", true);

  const presentacionIds = [...new Set(lotesConPres.map((l: any) => l.fkeCodPresentacion as string))];
  let presentacionesDetalle: any[] = [];

  if (presentacionIds.length > 0) {
    const { data: pres } = await adminClient
      .from("presentaciones")
      .select("eCodPresentacion, fkeCodProduct, tNombre, ePricePresentacion, eCostPresentacion, eCantidadUnidades")
      .in("eCodPresentacion", presentacionIds)
      .eq("bStatePresentacion", true);
    presentacionesDetalle = pres ?? [];
  }

  const presByProducto = new Map<string, PresentacionConStock[]>();
  for (const p of presentacionesDetalle) {
    const bInf  = infinitoPorPres.get(p.eCodPresentacion) ?? false;
    const stock = bInf ? Number.MAX_SAFE_INTEGER : (stockPorPres.get(p.eCodPresentacion) ?? 0);
    const lista = presByProducto.get(p.fkeCodProduct) ?? [];
    lista.push({
      eCodPresentacion:   p.eCodPresentacion,
      tNombre:            p.tNombre,
      ePricePresentacion: p.ePricePresentacion,
      eCostPresentacion:  p.eCostPresentacion,
      eCantidadUnidades:  p.eCantidadUnidades ?? 1,
      stockDisponible:    stock,
      bInfinito:          bInf,
    });
    presByProducto.set(p.fkeCodProduct, lista);
  }

  const productosConStock: ProductoConStock[] = (productos ?? []).map((p) => {
    const pres   = presByProducto.get(p.eCodProduct);
    const bInf   = infinitoProducto.get(p.eCodProduct) ?? false;
    if (pres?.length) {
      const anyInf = pres.some((pr) => pr.bInfinito);
      return {
        eCodProduct:     p.eCodProduct,
        tNameProduct:    p.tNameProduct,
        fkeCodCategory:  p.fkeCodCategory,
        ePriceProduct:   p.ePriceProduct,
        ImgProduct:      p.ImgProduct,
        stockDisponible: anyInf ? Number.MAX_SAFE_INTEGER : pres.reduce((a, pr) => a + pr.stockDisponible, 0),
        bInfinito:       anyInf,
        presentaciones:  pres,
      };
    }
    return {
      eCodProduct:     p.eCodProduct,
      tNameProduct:    p.tNameProduct,
      fkeCodCategory:  p.fkeCodCategory,
      ePriceProduct:   p.ePriceProduct,
      ImgProduct:      p.ImgProduct,
      stockDisponible: bInf ? Number.MAX_SAFE_INTEGER : (stockProducto.get(p.eCodProduct) ?? 0),
      bInfinito:       bInf,
    };
  });

  return (
    <MesasClient
      mesasIniciales={(mesas as MesaConEstado[]) ?? []}
      categorias={(categorias as Categoria[]) ?? []}
      productos={productosConStock}
      metodosPago={metodosPago}
      tieneTurno={tieneTurno}
      aplicarIva={aplicarIva}
      tipo_negocio={tipo_negocio}
      conceptos={conceptos}
    />
  );
}
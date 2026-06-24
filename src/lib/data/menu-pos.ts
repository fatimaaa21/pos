// src/lib/data/menu-pos.ts

import { createClient }      from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Categoria, ProductoConStock,
  PresentacionConStock, CorteCaja, VentasDelTurno,
} from "@/types";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";

// ─────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────

export interface DatosMenuPOS {
  categorias:  Categoria[];
  productos:   ProductoConStock[];
  metodosPago: MetodoPagoGlobal[];
  aplicarIva:  boolean;
}

export interface DatosMesasPOS {
  categorias:        Categoria[];
  productos:         ProductoConStock[];
  metodosPago:       MetodoPagoGlobal[];
  aplicarIva:        boolean;
  tipo_negocio:      "general" | "impresion" | "billar";
  costo_hora_billar: number | null;
}

// ─────────────────────────────────────────────────────────────
// obtenerDatosMenuPOS
// ─────────────────────────────────────────────────────────────

export async function obtenerDatosMenuPOS(fkeCodCompany: string): Promise<DatosMenuPOS> {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  const { data: negocio } = await adminClient
    .from("negocios")
    .select("metodosPago, aplicarIva, tipo_negocio")
    .eq("eCodCompany", fkeCodCompany)
    .single();

  const idsSeleccionados: string[] = negocio?.metodosPago ?? [];
  const aplicarIva: boolean        = negocio?.aplicarIva   ?? true;
  const tipoNegocio                = negocio?.tipo_negocio  ?? "general";

  let metodosPago: MetodoPagoGlobal[] = [];

  if (idsSeleccionados.length > 0) {
    const { data: metodos } = await adminClient
      .from("metodos_pago")
      .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay")
      .in("eCodPay", idsSeleccionados)
      .eq("bStatePay", true);
    metodosPago = (metodos as MetodoPagoGlobal[]) ?? [];
  }

  const { data: categorias } = await supabase
    .from("categorias")
    .select("eCodCategory, tNameCategory, ImgCategory")
    .eq("fkeCodCompany", fkeCodCompany)
    .eq("bStateCategory", true)
    .order("tNameCategory");

  // ── Rama impresión ────────────────────────────────────────────────────────
  if (tipoNegocio === "impresion") {
    const { data: productosImpresion } = await adminClient
      .from("productos")
      .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct, tipo_producto, ePrecioM2, eAnchoCm, eAltoCm, fkeCodMaterial")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bStateProduct", true);

    const impresionTodos = productosImpresion ?? [];

    const idsConInventario = impresionTodos
      .filter((p: any) => p.tipo_producto !== "medida" && !p.fkeCodMaterial)
      .map((p: any) => p.eCodProduct as string);

    const idsConMaterial = impresionTodos
      .filter((p: any) => p.tipo_producto !== "medida" && p.fkeCodMaterial)
      .map((p: any) => p.eCodProduct as string);

    const stockProducto    = new Map<string, number>();
    const infinitoProducto = new Map<string, boolean>();
    const presByProducto   = new Map<string, PresentacionConStock[]>();

    if (idsConInventario.length > 0) {
      const { data: lotes } = await adminClient
        .from("vista_inventario")
        .select("fkeCodProduct, fkeCodPresentacion, eCantRestante, bUnlimitedInventory")
        .in("fkeCodProduct", idsConInventario)
        .eq("fkeCodCompany", fkeCodCompany)
        .eq("bStateInventory", true)
        .or("bUnlimitedInventory.eq.true,eCantRestante.gt.0");

      const lotesSinPres = (lotes ?? []).filter((l: any) => !l.fkeCodPresentacion);
      const lotesConPres = (lotes ?? []).filter((l: any) =>  l.fkeCodPresentacion);

      for (const l of lotesSinPres) {
        if (l.bUnlimitedInventory) infinitoProducto.set(l.fkeCodProduct, true);
        else stockProducto.set(l.fkeCodProduct, (stockProducto.get(l.fkeCodProduct) ?? 0) + (l.eCantRestante ?? 0));
      }

      const stockPorPres    = new Map<string, number>();
      const infinitoPorPres = new Map<string, boolean>();
      for (const l of lotesConPres) {
        const pid = l.fkeCodPresentacion as string;
        if (l.bUnlimitedInventory) infinitoPorPres.set(pid, true);
        else stockPorPres.set(pid, (stockPorPres.get(pid) ?? 0) + (l.eCantRestante ?? 0));
      }

      const presIds = [...new Set(lotesConPres.map((l: any) => l.fkeCodPresentacion as string))];
      if (presIds.length > 0) {
        const { data: pres } = await adminClient
          .from("presentaciones")
          .select("eCodPresentacion, fkeCodProduct, tNombre, ePricePresentacion, eCostPresentacion, eCantidadUnidades")
          .in("eCodPresentacion", presIds)
          .eq("bStatePresentacion", true);

        for (const p of (pres ?? [])) {
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
          } as PresentacionConStock);
          presByProducto.set(p.fkeCodProduct, lista);
        }
      }
    }

    if (idsConMaterial.length > 0) {
      const { data: presMat } = await adminClient
        .from("presentaciones")
        .select("eCodPresentacion, fkeCodProduct, tNombre, ePricePresentacion, eCostPresentacion, eCantidadUnidades")
        .in("fkeCodProduct", idsConMaterial)
        .eq("bStatePresentacion", true);

      for (const p of (presMat ?? [])) {
        const lista = presByProducto.get(p.fkeCodProduct) ?? [];
        lista.push({
          eCodPresentacion:   p.eCodPresentacion,
          tNombre:            p.tNombre,
          ePricePresentacion: p.ePricePresentacion,
          eCostPresentacion:  p.eCostPresentacion,
          eCantidadUnidades:  p.eCantidadUnidades ?? 1,
          stockDisponible:    Number.MAX_SAFE_INTEGER,
          bInfinito:          true,
        } as PresentacionConStock);
        presByProducto.set(p.fkeCodProduct, lista);
      }
    }

    const productosConStock: ProductoConStock[] = impresionTodos.map((p: any) => {
      if (p.tipo_producto === "medida") {
        return {
          eCodProduct:     p.eCodProduct,
          tNameProduct:    p.tNameProduct,
          fkeCodCategory:  p.fkeCodCategory,
          ePriceProduct:   p.ePriceProduct,
          ImgProduct:      p.ImgProduct,
          stockDisponible: Number.MAX_SAFE_INTEGER,
          bInfinito:       true,
          tipo_producto:   "medida" as const,
          ePrecioM2:       p.ePrecioM2 ?? null,
        };
      }

      const pres   = presByProducto.get(p.eCodProduct);
      const tieneM = !!p.fkeCodMaterial;

      if (pres && pres.length > 0) {
        const anyInfinito = pres.some((pr) => pr.bInfinito);
        const totalStock  = anyInfinito
          ? Number.MAX_SAFE_INTEGER
          : pres.reduce((acc, pr) => acc + pr.stockDisponible, 0);
        return {
          eCodProduct:     p.eCodProduct,
          tNameProduct:    p.tNameProduct,
          fkeCodCategory:  p.fkeCodCategory,
          ePriceProduct:   p.ePriceProduct,
          ImgProduct:      p.ImgProduct,
          stockDisponible: totalStock,
          bInfinito:       anyInfinito,
          presentaciones:  pres,
          tipo_producto:   "unidad" as const,
          eAnchoCm:        p.eAnchoCm      ?? null,
          eAltoCm:         p.eAltoCm       ?? null,
          fkeCodMaterial:  p.fkeCodMaterial ?? null,
        };
      }

      const bInf = tieneM || (infinitoProducto.get(p.eCodProduct) ?? false);
      return {
        eCodProduct:     p.eCodProduct,
        tNameProduct:    p.tNameProduct,
        fkeCodCategory:  p.fkeCodCategory,
        ePriceProduct:   p.ePriceProduct,
        ImgProduct:      p.ImgProduct,
        stockDisponible: bInf ? Number.MAX_SAFE_INTEGER : (stockProducto.get(p.eCodProduct) ?? 0),
        bInfinito:       bInf,
        tipo_producto:   "unidad" as const,
        eAnchoCm:        p.eAnchoCm      ?? null,
        eAltoCm:         p.eAltoCm       ?? null,
        fkeCodMaterial:  p.fkeCodMaterial ?? null,
      };
    });

    return {
      categorias:  (categorias as Categoria[]) ?? [],
      productos:   productosConStock,
      metodosPago,
      aplicarIva,
    };
  }

  // ── Rama general ──────────────────────────────────────────────────────────
  const { data: lotes, error } = await adminClient
    .from("vista_inventario")
    .select("fkeCodProduct, fkeCodPresentacion, eCantRestante, bUnlimitedInventory")
    .eq("fkeCodCompany", fkeCodCompany)
    .eq("bStateInventory", true)
    .or("bUnlimitedInventory.eq.true,eCantRestante.gt.0");

  if (error) console.error("Error menú lotes:", JSON.stringify(error));

  if (!lotes || lotes.length === 0) {
    return { categorias: (categorias as Categoria[]) ?? [], productos: [], metodosPago, aplicarIva };
  }

  const lotesSinPres = lotes.filter((l: any) => !l.fkeCodPresentacion);
  const lotesConPres = lotes.filter((l: any) =>  l.fkeCodPresentacion);

  const stockProducto    = new Map<string, number>();
  const infinitoProducto = new Map<string, boolean>();
  const stockPorPres     = new Map<string, number>();
  const infinitoPorPres  = new Map<string, boolean>();

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

  const presentacionIds = [...new Set(lotesConPres.map((l: any) => l.fkeCodPresentacion as string))];

  // ── Productos y presentaciones en paralelo ────────────────────────────────
  const [productosRes, presRes] = await Promise.all([
    adminClient
      .from("productos")
      .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
      .in("eCodProduct", idsConStock)
      .eq("bStateProduct", true),
    presentacionIds.length > 0
      ? adminClient
          .from("presentaciones")
          .select("eCodPresentacion, fkeCodProduct, tNombre, ePricePresentacion, eCostPresentacion, eCantidadUnidades")
          .in("eCodPresentacion", presentacionIds)
          .eq("bStatePresentacion", true)
      : Promise.resolve({ data: [] }),
  ]);

  const productos            = productosRes.data;
  const presentacionesDetalle = presRes.data ?? [];

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
    const pres = presByProducto.get(p.eCodProduct);
    if (pres && pres.length > 0) {
      const anyInfinito = pres.some((pr) => pr.bInfinito);
      const totalStock  = pres.reduce((acc, pr) => acc + (pr.bInfinito ? Number.MAX_SAFE_INTEGER : pr.stockDisponible), 0);
      return {
        eCodProduct:     p.eCodProduct,
        tNameProduct:    p.tNameProduct,
        fkeCodCategory:  p.fkeCodCategory,
        ePriceProduct:   p.ePriceProduct,
        ImgProduct:      p.ImgProduct,
        stockDisponible: anyInfinito ? Number.MAX_SAFE_INTEGER : totalStock,
        bInfinito:       anyInfinito,
        presentaciones:  pres,
      };
    }
    const bInf = infinitoProducto.get(p.eCodProduct) ?? false;
    return {
      eCodProduct:     p.eCodProduct,
      tNameProduct:    p.tNameProduct,
      fkeCodCategory:  p.fkeCodCategory,
      ePriceProduct:   p.ePriceProduct,
      ImgProduct:      p.ImgProduct,
      bInfinito:       bInf,
      stockDisponible: bInf ? Number.MAX_SAFE_INTEGER : (stockProducto.get(p.eCodProduct) ?? 0),
    };
  });

  return {
    categorias: (categorias as Categoria[]) ?? [],
    productos:  productosConStock,
    metodosPago,
    aplicarIva,
  };
}

// ─────────────────────────────────────────────────────────────
// obtenerEstadoTurno
// ─────────────────────────────────────────────────────────────

export async function obtenerEstadoTurno(userId: string): Promise<{
  tieneTurno:     boolean;
  corte:          CorteCaja | null;
  ventasDelTurno: VentasDelTurno;
}> {
  const adminClient = createAdminClient();

  const { data: corteAbierto } = await adminClient
    .from("cortes_caja")
    .select("*")
    .eq("fkeCodUser", userId)
    .eq("bStateCorte", "abierto")
    .maybeSingle();

  const tieneTurno = corteAbierto !== null;

  let ventasDelTurno: VentasDelTurno = {
    eTotalEfectivo: 0, eTotalTarjeta: 0,
    eTotalTransferencia: 0, eTotalVentas: 0, eNumVentas: 0,
  };

  if (corteAbierto) {
    const { data: ventasTurno } = await adminClient
      .from("ventas")
      .select("eTotal, fkeMetodoPago")
      .eq("fkeCodUser", userId)
      .gte("fhCreateVenta", corteAbierto.fhInicioTurno);

    if (ventasTurno && ventasTurno.length > 0) {
      const metodosIds = [...new Set(ventasTurno.map((v) => v.fkeMetodoPago))];
      const { data: metodosInfo } = await adminClient
        .from("metodos_pago")
        .select("eCodPay, tNamePay")
        .in("eCodPay", metodosIds);

      const metodosMap = new Map(
        (metodosInfo ?? []).map((m) => [m.eCodPay, m.tNamePay.toLowerCase()])
      );

      const esEfectivo = (id: string) => (metodosMap.get(id) ?? "").includes("efectivo");
      const esTarjeta  = (id: string) => (metodosMap.get(id) ?? "").includes("tarjeta");

      ventasDelTurno = {
        eTotalEfectivo:      ventasTurno.filter((v) =>  esEfectivo(v.fkeMetodoPago)).reduce((a, v) => a + v.eTotal, 0),
        eTotalTarjeta:       ventasTurno.filter((v) =>  esTarjeta(v.fkeMetodoPago)).reduce((a, v)  => a + v.eTotal, 0),
        eTotalTransferencia: ventasTurno.filter((v) => !esEfectivo(v.fkeMetodoPago) && !esTarjeta(v.fkeMetodoPago)).reduce((a, v) => a + v.eTotal, 0),
        eTotalVentas:        ventasTurno.reduce((a, v) => a + v.eTotal, 0),
        eNumVentas:          ventasTurno.length,
      };
    }
  }

  return {
    tieneTurno,
    corte: (corteAbierto as CorteCaja | null) ?? null,
    ventasDelTurno,
  };
}

// ─────────────────────────────────────────────────────────────
// obtenerDatosMesasPOS
// ─────────────────────────────────────────────────────────────

export async function obtenerDatosMesasPOS(fkeCodCompany: string): Promise<DatosMesasPOS> {
  const supabase    = await createClient();
  const adminClient = createAdminClient();

  // ── Queries independientes en paralelo ────────────────────────────────────
  const [negocioRes, categoriasRes, lotesRes] = await Promise.all([
    adminClient
      .from("negocios")
      .select("metodosPago, aplicarIva, tipo_negocio, costo_hora_billar")
      .eq("eCodCompany", fkeCodCompany)
      .single(),
    supabase
      .from("categorias")
      .select("eCodCategory, tNameCategory, ImgCategory")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bStateCategory", true)
      .order("tNameCategory"),
    adminClient
      .from("vista_inventario")
      .select("fkeCodProduct, fkeCodPresentacion, eCantRestante, bUnlimitedInventory")
      .eq("fkeCodCompany", fkeCodCompany)
      .eq("bStateInventory", true)
      .or("bUnlimitedInventory.eq.true,eCantRestante.gt.0"),
  ]);

  const negocio        = negocioRes.data;
  const categorias     = categoriasRes.data;
  const lotes          = lotesRes.data;

  const aplicarIva: boolean             = negocio?.aplicarIva             ?? true;
  const tipo_negocio                    = (negocio?.tipo_negocio          ?? "general") as "general" | "impresion" | "billar";
  const costo_hora_billar: number | null = negocio?.costo_hora_billar     ?? null;

  // ── Métodos de pago (depende de negocio.metodosPago) ─────────────────────
  let metodosPago: MetodoPagoGlobal[] = [];
  const idsSeleccionados: string[]    = negocio?.metodosPago ?? [];
  if (idsSeleccionados.length > 0) {
    const { data: metodos } = await adminClient
      .from("metodos_pago")
      .select("eCodPay, tNamePay, tIconPay, descripcion, bStatePay")
      .in("eCodPay", idsSeleccionados)
      .eq("bStatePay", true);
    metodosPago = (metodos as MetodoPagoGlobal[]) ?? [];
  }

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

  const presentacionIds = [...new Set(lotesConPres.map((l: any) => l.fkeCodPresentacion as string))];

  // ── Productos y presentaciones en paralelo ────────────────────────────────
  const [productosRes, presRes] = await Promise.all([
    adminClient
      .from("productos")
      .select("eCodProduct, tNameProduct, fkeCodCategory, ePriceProduct, ImgProduct")
      .in("eCodProduct", idsConStock)
      .eq("bStateProduct", true),
    presentacionIds.length > 0
      ? adminClient
          .from("presentaciones")
          .select("eCodPresentacion, fkeCodProduct, tNombre, ePricePresentacion, eCostPresentacion, eCantidadUnidades")
          .in("eCodPresentacion", presentacionIds)
          .eq("bStatePresentacion", true)
      : Promise.resolve({ data: [] }),
  ]);

  const productos             = productosRes.data;
  const presentacionesDetalle = presRes.data ?? [];

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
    const pres = presByProducto.get(p.eCodProduct);
    const bInf = infinitoProducto.get(p.eCodProduct) ?? false;
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

  return {
    categorias:        (categorias as Categoria[]) ?? [],
    productos:         productosConStock,
    metodosPago,
    aplicarIva,
    tipo_negocio,
    costo_hora_billar,
  };
}
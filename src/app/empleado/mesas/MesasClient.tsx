"use client";

// src/app/empleado/mesas/MesasClient.tsx

import { useState, useTransition, useEffect, useCallback } from "react";
import toast                         from "react-hot-toast";
import { ArrowLeft, UtensilsCrossed, ShoppingBag, LogOut } from "lucide-react";
import { Buscador }          from "@/components/ui/Buscador";
import { CategoriaCarrusel } from "@/components/ui/CategoriaCarrusel/CategoriaCarrusel";
import { ProductoGrid }      from "@/components/ui/ProductoGrid/ProductoGrid";
import { PedidoPanel }       from "@/components/ui/PedidoPanel/PedidoPanel";
import { ModalVentaExitosa } from "@/components/ui/ModalVentaExitosa/Modalventaexitosa";
import { ModalEntregaCocina } from "./ModalEntregaCocina";
import {
  obtenerMesasConEstado,
  obtenerOrdenAbierta,
  abrirOrdenMesa,
  agregarItemOrden,
  actualizarCantidadItem,
  eliminarItemOrden,
  cobrarOrdenMesa,
  cobrarCuenta,
  agregarJugador,
  retirarJugador,
  obtenerConsumoCuenta,
  actualizarCantidadItemCuenta,
  eliminarItemCuenta,
  obtenerSegmentosPendientesSplit,
  obtenerSegmentosCuenta,
  terminarDeJugar,
  reabrirSegmento,
  liberarMesa,
  guardarCarritoParaCuenta,
  limpiarOrdenMesa,
} from "@/lib/actions/mesas";
import { buscarCuentasAbiertas, crearCuenta, renombrarCuenta, obtenerCuenta } from "@/lib/actions/cuentas";
import { crearVenta } from "@/lib/actions/ventas";
import type {
  MesaConEstado,
  Categoria,
  ProductoConStock,
  PresentacionConStock,
  OrdenMesaDetalleConProducto,
  ItemCarritoMenu,
  MetodoPago,
  ConceptoBillar,
} from "@/types";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import styles from "./mesas.module.css";

// ── Constantes del grid ───────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 6;

type Vista = "mesas" | "orden" | "directo";

interface Props {
  mesasIniciales:    MesaConEstado[];
  categorias:        Categoria[];
  productos:         ProductoConStock[];
  metodosPago:       MetodoPagoGlobal[];
  tieneTurno:        boolean;
  aplicarIva:        boolean;
  tipo_negocio:      "general" | "impresion" | "billar";
  conceptos:         ConceptoBillar[];
  onCerrarCaja?:     () => void;
}

// ── Floor plan de mesas ───────────────────────────────────────────────────────

function MesaFloorPlan({
  mesas,
  disabled,
  ahora,
  esBillar,
  formatTiempo,
  calcCosto,
  costoPorConcepto,
  nombrePorConcepto,
  onClick,
  onBadgeClick,
}: {
  mesas:             MesaConEstado[];
  disabled:          boolean;
  ahora:             Date | null;
  esBillar:          boolean;
  formatTiempo:      (fh: string) => string;
  calcCosto:         (fh: string, fkeCodConcepto: string | null | undefined) => number;
  costoPorConcepto:  Map<string, number>;
  nombrePorConcepto: Map<string, string>;
  onClick:           (mesa: MesaConEstado) => void;
  onBadgeClick:      (mesa: MesaConEstado) => void;
}) {
  return (
    <div
      className={styles.floorPlan}
      style={{
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows:    `repeat(${ROWS}, 1fr)`,
      }}
    >
      {/* Celdas de fondo */}
      {Array.from({ length: COLS * ROWS }).map((_, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        return (
          <div
            key={i}
            className={styles.floorCell}
            style={{ gridColumn: col + 1, gridRow: row + 1 }}
          />
        );
      })}

      {/* Mesas — envueltas en div para poder anidar el badge como botón hermano */}
      {mesas.map((mesa) => {
        const ocupada    = !!mesa.ordenAbierta;
        const fhAbierta  = mesa.ordenAbierta?.fhAbierta;
        const hayListos  = (mesa.itemsListos ?? 0) > 0;

        return (
          <div
            key={mesa.eCodMesa}
            className={styles.floorMesaWrapper}
            style={{
              gridColumn: `${(mesa.e_grid_col ?? 0) + 1} / span ${mesa.e_grid_w ?? 1}`,
              gridRow:    `${(mesa.e_grid_row ?? 0) + 1} / span ${mesa.e_grid_h ?? 1}`,
            }}
          >
            <button
              className={[
                styles.floorMesa,
                mesa.t_shape === "circle" ? styles.floorMesaCircle  : "",
                ocupada                   ? styles.floorMesaOcupada : styles.floorMesaLibre,
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onClick(mesa)}
              disabled={disabled}
            >
              <span className={styles.floorMesaNombre}>{mesa.tNombre}</span>

              {esBillar && (
                mesa.fkeCodConcepto ? (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 0.3 }}>
                    {nombrePorConcepto.get(mesa.fkeCodConcepto) ?? "Concepto desconocido"}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-error)" }}>
                    ⚠ Sin concepto
                  </span>
                )
              )}

              <span className={styles.floorMesaEstado}>
                {ocupada ? "Ocupada" : "Libre"}
              </span>

              {esBillar && ocupada && ahora && (() => {
                const inicio = mesa.segmentoActivo?.fhInicio ?? fhAbierta;
                const fin    = mesa.segmentoActivo?.fhFin ?? null;
                if (!inicio) return null;

                const finEfectivo = fin ? new Date(fin) : ahora;
                const diffMs      = Math.max(0, finEfectivo.getTime() - new Date(inicio).getTime());
                const totalSeg    = Math.floor(diffMs / 1000);
                const min = Math.floor(totalSeg / 60).toString().padStart(2, "0");
                const seg = (totalSeg % 60).toString().padStart(2, "0");

                const costoHora = costoPorConcepto.get(mesa.fkeCodConcepto ?? "");
                const costo     = costoHora ? Math.round((diffMs / 3600000) * costoHora * 100) / 100 : null;

                return (
                  <>
                    <span className={styles.floorMesaTimer}>
                      {fin && "⏸ "}{min}:{seg}
                    </span>
                    {costo != null && (
                      <span className={styles.floorMesaCosto}>
                        ${costo.toFixed(2)}
                      </span>
                    )}
                  </>
                );
              })()}
            </button>

            {hayListos && (
              <button
                className={styles.badgeCocina}
                onClick={(e) => {
                  e.stopPropagation();
                  onBadgeClick(mesa);
                }}
                title="Items listos para entregar"
              >
                {mesa.itemsListos}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemsACarrito(items: OrdenMesaDetalleConProducto[]): ItemCarritoMenu[] {
  return items.map((item) => ({
    key:      item.eCodDetalle,
    producto: {
      eCodProduct:     item.fkeCodProduct,
      tNameProduct:    item.producto?.tNameProduct ?? "Producto",
      ePriceProduct:   item.ePrecio,
      ImgProduct:      item.producto?.ImgProduct,
      stockDisponible: Number.MAX_SAFE_INTEGER,
      bInfinito:       true,
    },
    cantidad:    item.eCantidad,
    presentacion: item.fkeCodPresentacion
      ? {
          eCodPresentacion:   item.fkeCodPresentacion,
          tNombre:            item.presentacion?.tNombre ?? "",
          ePricePresentacion: item.ePrecio,
          eCostPresentacion:  0,
          eCantidadUnidades:  1,
          stockDisponible:    Number.MAX_SAFE_INTEGER,
          bInfinito:          true,
        }
      : undefined,
  }));
}

function carritoKey(item: Pick<ItemCarritoMenu, "producto" | "presentacion">): string {
  return `${item.producto.eCodProduct}_${item.presentacion?.eCodPresentacion ?? ""}`;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function MesasClient({
  mesasIniciales,
  categorias,
  productos,
  metodosPago,
  tieneTurno,
  aplicarIva,
  tipo_negocio,
  conceptos,
  onCerrarCaja,
}: Props) {
  const [vista,           setVista]           = useState<Vista>("mesas");
  const [mesas,           setMesas]           = useState(mesasIniciales);
  const [mesaActiva,      setMesaActiva]      = useState<MesaConEstado | null>(null);
  const [eCodOrden,       setECodOrden]       = useState<string | null>(null);
  const [fhOrdenActiva,   setFhOrdenActiva]   = useState<string | null>(null);
  const [items,           setItems]           = useState<OrdenMesaDetalleConProducto[]>([]);
  const [itemsCuenta,     setItemsCuenta]      = useState<OrdenMesaDetalleConProducto[]>([]);
  const [segmentosCuenta, setSegmentosCuenta]  = useState<
    { fkeCodSegmento: string; fhInicio: string; fhFin: string | null; eCostoHora: number; ePorcentaje: number | null }[]
  >([]);
  const [categoriaActiva, setCategoriaActiva] = useState("todas");
  const [busqueda,        setBusqueda]        = useState("");
  const [ventaExitosa,    setVentaExitosa]    = useState<string | null>(null);
  const [errorVenta,      setErrorVenta]      = useState<string | null>(null);
  const [isPending,       startTransition]    = useTransition();

  const [carritoDirecto,  setCarritoDirecto]  = useState<ItemCarritoMenu[]>([]);
  const [errorDirecto,    setErrorDirecto]    = useState<string | null>(null);
  const [ventaDirectaOk,  setVentaDirectaOk]  = useState<string | null>(null);

  // ── Cuentas (solo billar) ──────────────────────────────────────────────────
  const [eCodCuenta,      setECodCuenta]      = useState<string | null>(null);

  const [cuentaParaAbrirMesa, setCuentaParaAbrirMesa] = useState<{ eCodCuenta: string; tIdentificador: string } | null>(null);
  const [cuentasActivas,  setCuentasActivas]  = useState<{ eCodCuenta: string; tIdentificador: string }[]>([]);

  const [modalCuenta, setModalCuenta] = useState<{
    onSeleccionar: (eCodCuenta: string) => void;
    cuentaActual?: { eCodCuenta: string; tIdentificador: string };
    permitirCrear?: boolean;
  } | null>(null);

  // Modal de split de tiempo — solo define % (repartoIgual, manual). Ya no
  // maneja método de pago ni ModalEfectivo (eso volvió a PedidoPanel, que ya
  // lo hacía bien para el caso simple) — al confirmar, se guarda localmente
  // en splitsResueltos y se desbloquea el panel normal.
  const [modalSplit, setModalSplit] = useState<{
    segmentos: {
      fkeCodSegmento: string;
      fhInicio: string;
      fhFin: string | null;
      bCerrado: boolean;
      eCostoHora: number;
      otrasCuentas: { eCodCuenta: string; tIdentificador: string }[];
    }[];
    totalProductos: number;
    eCodCuentaActual: string;
    tIdentificadorActual: string;
    eCodCuentaOverride?: string;
  } | null>(null);

  // Splits ya resueltos localmente (porcentajes confirmados por el cajero),
  // pendientes de mandarse al servidor hasta el cobro real vía PedidoPanel.
  // Null = nada resuelto todavía. Se limpia después de cobrar o al cancelar.
  const [splitsResueltos, setSplitsResueltos] = useState<
    { fkeCodSegmento: string; repartos: { eCodCuenta: string; ePorcentaje: number }[] }[] | null
  >(null);

  const [cuentaEnRevision, setCuentaEnRevision] = useState<{ eCodCuenta: string; tIdentificador: string } | null>(null);
  const [itemsRevision, setItemsRevision] = useState<OrdenMesaDetalleConProducto[]>([]);
  const [segmentosRevision, setSegmentosRevision] = useState<
    { fkeCodSegmento: string; fhInicio: string; fhFin: string | null; eCostoHora: number; ePorcentaje: number | null }[]
  >([]);
  const [segmentosAmbiguosRevision, setSegmentosAmbiguosRevision] = useState<Set<string>>(new Set());
  const [cargandoRevision, setCargandoRevision] = useState(false);

  const [modalConfirmarRetiro, setModalConfirmarRetiro] = useState<{ eCodCuenta: string; tIdentificador: string } | null>(null);

  const [modalRenombrar, setModalRenombrar] = useState<{ eCodCuenta: string; tIdentificador: string } | null>(null);

  const [modalCocina, setModalCocina] = useState<{
    eCodOrden:   string;
    tNombreMesa: string;
  } | null>(null);

  // ── Timer para billar ─────────────────────────────────────────────────────
  const esBillar = tipo_negocio === "billar";
  const [ahora,          setAhora]     = useState<Date | null>(null);
  const [ahoraCongelado, setCongelado] = useState<Date | null>(null);
  const ahoraEfectivo = ahoraCongelado ?? ahora;

  useEffect(() => {
    if (!esBillar) return;
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, [esBillar]);

  const formatTiempo = useCallback((fhAbierta: string): string => {
    if (!ahoraEfectivo) return "00:00";
    const diff     = Math.max(0, ahoraEfectivo.getTime() - new Date(fhAbierta).getTime());
    const totalSeg = Math.floor(diff / 1000);
    const h   = Math.floor(totalSeg / 3600);
    const min = Math.floor((totalSeg % 3600) / 60);
    const seg = totalSeg % 60;
    if (h > 0) return `${h}:${String(min).padStart(2,"0")}:${String(seg).padStart(2,"0")}`;
    return `${String(min).padStart(2,"0")}:${String(seg).padStart(2,"0")}`;
  }, [ahoraEfectivo]);

  const costoPorConcepto  = new Map(conceptos.map((c) => [c.eCodConcepto, c.eCostoHora]));
  const nombrePorConcepto = new Map(conceptos.map((c) => [c.eCodConcepto, c.tNombre]));

  const calcCosto = useCallback((fhAbierta: string, fkeCodConcepto: string | null | undefined): number => {
    const costoHora = fkeCodConcepto ? costoPorConcepto.get(fkeCodConcepto) : undefined;
    if (!costoHora || !ahoraEfectivo) return 0;
    const diff  = Math.max(0, ahoraEfectivo.getTime() - new Date(fhAbierta).getTime());
    const horas = diff / (1000 * 60 * 60);
    return Math.round(horas * costoHora * 100) / 100;
  }, [ahoraEfectivo, costoPorConcepto]);

  /**
   * Costo de tiempo de ESTA cuenta. Ahora también reconoce splitsResueltos
   * (porcentajes confirmados en el modal de split, pero aún no escritos en
   * la DB) — sin esto, el panel seguiría mostrando "sin repartir" e
   * "bloqueado" aun después de que el cajero ya resolvió los porcentajes,
   * porque segmentosCuenta.ePorcentaje sigue null hasta el cobro real.
   */
  const calcCostoCuenta = useCallback((): { confirmado: number; segmentosPendientes: number } => {
    if (!ahoraEfectivo) return { confirmado: 0, segmentosPendientes: 0 };
    const sinAmbiguedad = cuentasActivas.length <= 1;

    let confirmado = 0;
    let segmentosPendientes = 0;
    for (const s of segmentosCuenta) {
      const fin   = s.fhFin ? new Date(s.fhFin) : ahoraEfectivo;
      const horas = Math.max(0, (fin.getTime() - new Date(s.fhInicio).getTime()) / (1000 * 60 * 60));

      let porcentaje = s.ePorcentaje ?? (sinAmbiguedad ? 100 : null);
      if (porcentaje === null) {
        const resuelto = splitsResueltos
          ?.find((sp) => sp.fkeCodSegmento === s.fkeCodSegmento)
          ?.repartos.find((r) => r.eCodCuenta === eCodCuenta);
        if (resuelto) porcentaje = resuelto.ePorcentaje;
      }

      if (porcentaje === null) {
        segmentosPendientes += 1;
        continue;
      }
      confirmado += horas * s.eCostoHora * (porcentaje / 100);
    }
    return { confirmado: Math.round(confirmado * 100) / 100, segmentosPendientes };
  }, [ahoraEfectivo, segmentosCuenta, cuentasActivas, splitsResueltos, eCodCuenta]);

  const formatTiempoCuenta = useCallback((): string => {
    if (!ahoraEfectivo || segmentosCuenta.length === 0) return "00:00";
    let totalMs = 0;
    for (const s of segmentosCuenta) {
      const fin = s.fhFin ? new Date(s.fhFin) : ahoraEfectivo;
      totalMs += Math.max(0, fin.getTime() - new Date(s.fhInicio).getTime());
    }
    const totalSeg = Math.floor(totalMs / 1000);
    const min = Math.floor(totalSeg / 60).toString().padStart(2, "0");
    const seg = (totalSeg % 60).toString().padStart(2, "0");
    return `${min}:${seg}`;
  }, [ahoraEfectivo, segmentosCuenta]);

  /**
   * Mismo criterio que calcCostoCuenta, pero para la revisión de "Cobrar
   * cuenta existente" — también reconoce splitsResueltos.
   */
  function calcCostoRevision(): { confirmado: number; pendientes: number } {
    let confirmado = 0;
    let pendientes = 0;
    for (const s of segmentosRevision) {
      const esAmbiguo = segmentosAmbiguosRevision.has(s.fkeCodSegmento);
      let porcentaje: number | null = s.ePorcentaje;

      if (porcentaje === null && esAmbiguo) {
        const resuelto = splitsResueltos
          ?.find((sp) => sp.fkeCodSegmento === s.fkeCodSegmento)
          ?.repartos.find((r) => r.eCodCuenta === cuentaEnRevision?.eCodCuenta);
        if (resuelto) porcentaje = resuelto.ePorcentaje;
      } else if (porcentaje === null) {
        porcentaje = 100; // no ambiguo, se auto-resuelve
      }

      if (porcentaje === null) { pendientes += 1; continue; }
      const fin = s.fhFin ? new Date(s.fhFin) : new Date();
      const horas = Math.max(0, (fin.getTime() - new Date(s.fhInicio).getTime()) / 3600000);
      confirmado += horas * s.eCostoHora * (porcentaje / 100);
    }
    return { confirmado: Math.round(confirmado * 100) / 100, pendientes };
  }

  // ── Filtros de catálogo ───────────────────────────────────────────────────
  const productosFiltrados = productos.filter((p) => {
    const cat = categoriaActiva === "todas" || p.fkeCodCategory === categoriaActiva;
    const nom = p.tNameProduct.toLowerCase().includes(busqueda.toLowerCase());
    return cat && nom;
  });

  const conteoPorCategoria: Record<string, number> = {
    todas: productos.length,
    ...Object.fromEntries(
      categorias.map((c) => [
        c.eCodCategory,
        productos.filter((p) => p.fkeCodCategory === c.eCodCategory).length,
      ])
    ),
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function recargarMesas() {
    const actualizadas = await obtenerMesasConEstado();
    setMesas(actualizadas);
  }

  async function recargarOrden(codMesa: string) {
    const orden = await obtenerOrdenAbierta(codMesa);
    setItems(orden?.detalle ?? []);
  }

  async function recargarConsumoCuenta(codCuenta: string | null) {
    if (!codCuenta) { setItemsCuenta([]); setSegmentosCuenta([]); return; }
    const [resultItems, resultSegmentos] = await Promise.all([
      obtenerConsumoCuenta(codCuenta),
      obtenerSegmentosCuenta(codCuenta),
    ]);
    if ("error" in resultItems) { toast.error(resultItems.error); setItemsCuenta([]); }
    else setItemsCuenta(resultItems.items);

    if ("error" in resultSegmentos) { toast.error(resultSegmentos.error); setSegmentosCuenta([]); }
    else setSegmentosCuenta(resultSegmentos.segmentos);
  }

  async function recargarRevision(codCuenta: string) {
    setCargandoRevision(true);
    const [resultItems, resultSegmentos, resultPendientes] = await Promise.all([
      obtenerConsumoCuenta(codCuenta),
      obtenerSegmentosCuenta(codCuenta),
      obtenerSegmentosPendientesSplit(codCuenta),
    ]);
    setCargandoRevision(false);

    if ("error" in resultItems) { toast.error(resultItems.error); setItemsRevision([]); }
    else setItemsRevision(resultItems.items);

    if ("error" in resultSegmentos) { toast.error(resultSegmentos.error); setSegmentosRevision([]); }
    else setSegmentosRevision(resultSegmentos.segmentos);

    if ("error" in resultPendientes) { toast.error(resultPendientes.error); setSegmentosAmbiguosRevision(new Set()); }
    else setSegmentosAmbiguosRevision(new Set(resultPendientes.segmentos.map((s) => s.fkeCodSegmento)));
  }

  function resetFiltros() {
    setBusqueda("");
    setCategoriaActiva("todas");
  }

  useEffect(() => {
    if (!esBillar) return;
    recargarConsumoCuenta(eCodCuenta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eCodCuenta, esBillar]);

  useEffect(() => {
    if (vista !== "mesas") return;
    recargarMesas();
    const id = setInterval(recargarMesas, 5000);
    return () => clearInterval(id);
  }, [vista]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClickMesa(mesa: MesaConEstado) {
    if (!tieneTurno) {
      toast.error("Debes abrir un turno antes de atender mesas");
      return;
    }

    setMesaActiva(mesa);
    setErrorVenta(null);

    if (mesa.ordenAbierta) {
      if (cuentaParaAbrirMesa) {
        toast.error("Esa mesa ya está ocupada — elige una mesa libre para asignar la cuenta");
        return;
      }

      setECodOrden(mesa.ordenAbierta.eCodOrden);
      setFhOrdenActiva(mesa.ordenAbierta.fhAbierta);
      const orden = await obtenerOrdenAbierta(mesa.eCodMesa);
      setItems(orden?.detalle ?? []);

      const cuentas = (orden as any)?.cuentasActivas ?? [];
      setCuentasActivas(cuentas);
      if (esBillar && cuentas.length === 1) {
        setECodCuenta(cuentas[0].eCodCuenta);
        await recargarConsumoCuenta(cuentas[0].eCodCuenta);
      } else if (esBillar && cuentas.length !== 1) {
        const nuevoValor = cuentas.length === 1 ? cuentas[0].eCodCuenta : null;
        setECodCuenta(nuevoValor);
        await recargarConsumoCuenta(nuevoValor);
      }

      setVista("orden");
      return;
    }

    const cuentaPendiente = cuentaParaAbrirMesa;
    startTransition(async () => {
      const result = await abrirOrdenMesa(mesa.eCodMesa, cuentaPendiente?.eCodCuenta);
      if ("error" in result) { toast.error(result.error); return; }
      setECodOrden(result.eCodOrden);
      setECodCuenta(result.eCodCuenta);
      setCuentasActivas(
        result.eCodCuenta
          ? [{ eCodCuenta: result.eCodCuenta, tIdentificador: cuentaPendiente?.tIdentificador ?? mesa.tNombre }]
          : []
      );
      setCuentaParaAbrirMesa(null);
      setFhOrdenActiva(new Date().toISOString());
      setItems([]);
      setVista("orden");
      await recargarMesas();
    });
  }

  function handleBadgeClick(mesa: MesaConEstado) {
    if (!mesa.ordenAbierta) return;
    setModalCocina({
      eCodOrden:   mesa.ordenAbierta.eCodOrden,
      tNombreMesa: mesa.tNombre,
    });
  }

  function handleAbrirModalAgregarJugador() {
    if (!eCodOrden) return;
    setModalCuenta({
      cuentaActual: cuentasActivas.length === 1 ? cuentasActivas[0] : undefined,
      onSeleccionar: (eCodCuentaNueva: string) => {
        startTransition(async () => {
          const result = await agregarJugador(eCodOrden, eCodCuentaNueva);
          if ("error" in result) { toast.error(result.error); return; }
          toast.success("Jugador agregado");
          setModalCuenta(null);
          if (mesaActiva) await handleClickMesa(mesaActiva);
          if (eCodCuenta) await recargarConsumoCuenta(eCodCuenta);
        });
      },
    });
  }

  function handleTerminarDeJugar() {
    if (!eCodOrden) return;
    startTransition(async () => {
      const result = await terminarDeJugar(eCodOrden);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Tiempo detenido");
      if (eCodCuenta) await recargarConsumoCuenta(eCodCuenta);
    });
  }

  function handleReabrirSegmento() {
    if (!eCodOrden || segmentosCuenta.length === 0) return;
    const masReciente = [...segmentosCuenta].sort(
      (a, b) => new Date(b.fhInicio).getTime() - new Date(a.fhInicio).getTime()
    )[0];

    startTransition(async () => {
      const result = await reabrirSegmento(eCodOrden, masReciente.fkeCodSegmento);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Segmento reabierto — el tiempo retoma desde ahora, no desde que se cerró");
      if (eCodCuenta) await recargarConsumoCuenta(eCodCuenta);
    });
  }

  function handleAbrirRenombrar() {
    if (!eCodCuenta) return;
    const actual = cuentasActivas.find((c) => c.eCodCuenta === eCodCuenta);
    if (!actual) return;
    setModalRenombrar({ eCodCuenta: actual.eCodCuenta, tIdentificador: actual.tIdentificador });
  }

  function handleLiberarMesa() {
    if (!eCodOrden) return;
    startTransition(async () => {
      const result = await liberarMesa(eCodOrden);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Mesa liberada — la cuenta sigue con su consumo pendiente, cóbrala desde \"Cobrar cuenta existente\"");
      handleVolver();
      await recargarMesas();
    });
  }

  function handleRetirarJugador(eCodCuentaQueSeVa: string, tIdentificador: string) {
    setModalConfirmarRetiro({ eCodCuenta: eCodCuentaQueSeVa, tIdentificador });
  }

  function ejecutarRetiro(eCodCuentaQueSeVa: string, tIdentificador: string) {
    if (!eCodOrden) return;
    setModalConfirmarRetiro(null);
    startTransition(async () => {
      const result = await retirarJugador(eCodOrden, eCodCuentaQueSeVa);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success(`${tIdentificador} se retiró`);
      if (mesaActiva) await handleClickMesa(mesaActiva);
      if (eCodCuenta === eCodCuentaQueSeVa) {
        const restantes = cuentasActivas.filter((c) => c.eCodCuenta !== eCodCuentaQueSeVa);
        setECodCuenta(restantes[0]?.eCodCuenta ?? null);
      }
    });
  }

  function agregarProductoDirecto(
    producto: ProductoConStock,
    presentacion?: PresentacionConStock
  ) {
    if (!tieneTurno) return;
    setErrorDirecto(null);
    const key   = carritoKey({ producto, presentacion });
    const stock = presentacion?.stockDisponible ?? producto.stockDisponible;
    const bInf  = presentacion?.bInfinito       ?? producto.bInfinito;

    setCarritoDirecto((prev) => {
      const existe = prev.find((i) => carritoKey(i) === key);
      if (existe) {
        if (!bInf && existe.cantidad >= stock) return prev;
        return prev.map((i) =>
          carritoKey(i) === key ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { producto, cantidad: 1, presentacion }];
    });
  }

  function cambiarCantidadDirecto(key: string, delta: number) {
    setErrorDirecto(null);
    setCarritoDirecto((prev) =>
      prev
        .map((i) => {
          if (carritoKey(i) !== key) return i;
          const stock = i.presentacion?.stockDisponible ?? i.producto.stockDisponible;
          const bInf  = i.presentacion?.bInfinito       ?? i.producto.bInfinito;
          const nueva = i.cantidad + delta;
          if (!bInf && nueva > stock) return i;
          return { ...i, cantidad: nueva };
        })
        .filter((i) => i.cantidad > 0)
    );
  }

  function limpiarCarritoDirecto() {
    setCarritoDirecto([]);
    setErrorDirecto(null);
  }

  async function handleFinalizarDirecto(metodoPago: MetodoPago): Promise<void> {
    setErrorDirecto(null);
    const result = await crearVenta(
      carritoDirecto.map((i) => ({
        eCodProduct:      i.producto.eCodProduct,
        eCodPresentacion: i.presentacion?.eCodPresentacion,
        cantidad:         i.cantidad,
        precioUnitario:   i.presentacion?.ePricePresentacion ?? i.producto.ePriceProduct,
      })),
      metodoPago,
      aplicarIva,
    );
    if ("error" in result) { setErrorDirecto(result.error ?? "Error desconocido"); return; }
    setVentaDirectaOk(result.eCodVenta);
  }

  function handleGuardarParaCuenta() {
    if (carritoDirecto.length === 0) return;
    setModalCuenta({
      onSeleccionar: (eCodCuenta: string) => {
        startTransition(async () => {
          const items = carritoDirecto.map((i) => ({
            eCodProduct:      i.producto.eCodProduct,
            eCodPresentacion: i.presentacion?.eCodPresentacion,
            cantidad:         i.cantidad,
            precioUnitario:   i.presentacion?.ePricePresentacion ?? i.producto.ePriceProduct,
          }));
          const result = await guardarCarritoParaCuenta(eCodCuenta, items);
          if ("error" in result) { toast.error(result.error); return; }
          toast.success("Guardado en la cuenta");
          setModalCuenta(null);
          limpiarCarritoDirecto();
        });
      },
    });
  }

  function handleAbrirCobrarCuentaSuelta() {
    setModalCuenta({
      permitirCrear: false,
      onSeleccionar: (eCodCuentaSel: string) => {
        startTransition(async () => {
          const result = await obtenerCuenta(eCodCuentaSel);
          if ("error" in result) { toast.error(result.error); return; }
          if (!result.bAbierta) { toast.error("Esa cuenta ya fue cobrada"); return; }

          const segmentosResult = await obtenerSegmentosCuenta(eCodCuentaSel);
          if ("error" in segmentosResult) { toast.error(segmentosResult.error); return; }
          const tieneSegmentoAbierto = segmentosResult.segmentos.some((s) => s.fhFin === null);
          if (tieneSegmentoAbierto) {
            toast.error(
              `"${result.tIdentificador}" todavía está jugando en una mesa. Cóbrala desde ahí, no desde pedido directo — cobrar aquí podría cortarle el tiempo a otro jugador que siga compartiendo esa mesa.`
            );
            return;
          }

          setModalCuenta(null);
          setCuentaEnRevision({ eCodCuenta: result.eCodCuenta, tIdentificador: result.tIdentificador });
          await recargarRevision(result.eCodCuenta);
        });
      },
    });
  }

  function handleAbrirAsignarCuentaAMesa() {
    setModalCuenta({
      permitirCrear: false,
      onSeleccionar: (eCodCuentaSel: string) => {
        startTransition(async () => {
          const result = await obtenerCuenta(eCodCuentaSel);
          if ("error" in result) { toast.error(result.error); return; }
          if (!result.bAbierta) { toast.error("Esa cuenta ya fue cobrada"); return; }

          const segmentosResult = await obtenerSegmentosCuenta(eCodCuentaSel);
          if ("error" in segmentosResult) { toast.error(segmentosResult.error); return; }
          const tieneSegmentoAbierto = segmentosResult.segmentos.some((s) => s.fhFin === null);
          if (tieneSegmentoAbierto) {
            toast.error(`"${result.tIdentificador}" todavía tiene tiempo corriendo en otra mesa — ciérralo antes de reasignarla.`);
            return;
          }

          setModalCuenta(null);
          setCuentaParaAbrirMesa({ eCodCuenta: result.eCodCuenta, tIdentificador: result.tIdentificador });
          toast.success(`Listo — toca una mesa libre para asignarle a "${result.tIdentificador}"`);
        });
      },
    });
  }

  function handleAgregarProducto(
    producto: ProductoConStock,
    presentacion?: PresentacionConStock
  ) {
    if (!eCodOrden) return;
    if (esBillar && !eCodCuenta) {
      toast.error(
        cuentasActivas.length > 1
          ? "Esta mesa tiene varias cuentas — selecciona una antes de agregar productos"
          : "Esta mesa no tiene cuenta asociada. Recárgala e intenta de nuevo."
      );
      return;
    }
    setErrorVenta(null);
    const ePrecio = presentacion?.ePricePresentacion ?? producto.ePriceProduct;
    startTransition(async () => {
      const result = await agregarItemOrden(
        eCodOrden,
        {
          eCodProduct:      producto.eCodProduct,
          eCodPresentacion: presentacion?.eCodPresentacion,
          eCantidad:        1,
          ePrecio,
        },
        eCodCuenta
      );
      if ("error" in result) { toast.error(result.error); return; }
      await recargarOrden(mesaActiva!.eCodMesa);
      if (esBillar && eCodCuenta) await recargarConsumoCuenta(eCodCuenta);
    });
  }

  function handleCambiarCantidad(key: string, delta: number) {
    if (esBillar) {
      const item = itemsCuenta.find((i) => i.eCodDetalle === key);
      if (!item || !eCodOrden || !eCodCuenta) return;
      const nueva = item.eCantidad + delta;
      startTransition(async () => {
        const result = nueva <= 0
          ? await eliminarItemCuenta(eCodOrden, eCodCuenta, item.fkeCodProduct, item.fkeCodPresentacion)
          : await actualizarCantidadItemCuenta(eCodOrden, eCodCuenta, item.fkeCodProduct, item.fkeCodPresentacion, nueva);
        if ("error" in result) { toast.error(result.error); return; }
        await recargarOrden(mesaActiva!.eCodMesa);
        await recargarConsumoCuenta(eCodCuenta);
      });
      return;
    }

    const item = items.find((i) => i.eCodDetalle === key);
    if (!item) return;
    const nueva = item.eCantidad + delta;
    startTransition(async () => {
      if (nueva <= 0) {
        const result = await eliminarItemOrden(key);
        if ("error" in result) { toast.error(result.error); return; }
      } else {
        const result = await actualizarCantidadItem(key, nueva);
        if ("error" in result) { toast.error(result.error); return; }
      }
      await recargarOrden(mesaActiva!.eCodMesa);
    });
  }

  function handleLimpiar() {
    if (!eCodOrden) return;
    if (esBillar) {
      toast.error("Limpiar pedido no está disponible todavía para mesas de billar. Elimina los productos uno por uno.");
      return;
    }
    startTransition(async () => {
      const result = await limpiarOrdenMesa(eCodOrden);
      if ("error" in result) { toast.error(result.error); return; }
      setItems([]);
      setItemsCuenta([]);
    });
  }

  async function handleFinalizar(metodoPago: MetodoPago): Promise<void> {
    if (!eCodOrden) return;
    if (esBillar && !eCodCuenta) {
      toast.error("Selecciona una cuenta antes de cobrar");
      return;
    }
    setErrorVenta(null);
    await ejecutarCobro(metodoPago, splitsResueltos ?? []);
  }

  // ── "Resolver reparto" — abre ModalSplit solo para definir %. El cobro en
  // sí (método de pago, vuelto) vuelve a pasar por el flujo normal de
  // PedidoPanel una vez que el % queda resuelto localmente.
  async function handleAbrirResolverSplit() {
    if (!eCodCuenta) return;
    const pendientes = await obtenerSegmentosPendientesSplit(eCodCuenta);
    if ("error" in pendientes) { toast.error(pendientes.error); return; }
    if (pendientes.segmentos.length === 0) {
      toast.error("No hay ningún reparto pendiente — puedes cobrar directo");
      return;
    }
    const tIdentificadorActual = cuentasActivas.find((c) => c.eCodCuenta === eCodCuenta)?.tIdentificador ?? "Esta cuenta";
    const totalProductos = itemsCuenta.reduce((acc, i) => acc + i.ePrecio * i.eCantidad, 0);
    setModalSplit({
      segmentos: pendientes.segmentos,
      totalProductos,
      eCodCuentaActual: eCodCuenta,
      tIdentificadorActual,
    });
  }

  async function ejecutarCobro(
    metodoPago: MetodoPago,
    splits: { fkeCodSegmento: string; repartos: { eCodCuenta: string; ePorcentaje: number }[] }[]
  ): Promise<void> {
    if (!eCodOrden) return;
    const result = esBillar
      ? await cobrarCuenta(eCodCuenta as string, splits, metodoPago)
      : await cobrarOrdenMesa(eCodOrden, metodoPago);

    if ("error" in result) {
      setErrorVenta(result.error);
      setCongelado(null);
      return;
    }
    setSplitsResueltos(null);
    setVentaExitosa(result.eCodVenta);
    await recargarMesas();
  }

  async function ejecutarCobroSuelta(
    eCodCuentaObjetivo: string,
    metodoPago: MetodoPago,
    splits: { fkeCodSegmento: string; repartos: { eCodCuenta: string; ePorcentaje: number }[] }[]
  ): Promise<void> {
    const result = await cobrarCuenta(eCodCuentaObjetivo, splits, metodoPago);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setSplitsResueltos(null);
    setCuentaEnRevision(null);
    setVentaDirectaOk(result.eCodVenta);
  }

  function handleCerrarRevision() {
    setCuentaEnRevision(null);
    setItemsRevision([]);
    setSegmentosRevision([]);
    setSegmentosAmbiguosRevision(new Set());
    setSplitsResueltos(null);
  }

  function handleCambiarCantidadRevision(key: string, delta: number) {
    if (!cuentaEnRevision) return;
    if (delta > 0) {
      toast.error("No se pueden agregar productos aquí — usa \"Guardar para cuenta\" desde un pedido nuevo");
      return;
    }
    const item = itemsRevision.find((i) => i.eCodDetalle === key);
    if (!item) return;
    if (!item.fkeCodOrden) {
      toast.error("Este producto no tiene una orden de origen registrada — no se puede editar. Contacta soporte.");
      return;
    }
    const nueva = item.eCantidad + delta;
    startTransition(async () => {
      const result = nueva <= 0
        ? await eliminarItemCuenta(item.fkeCodOrden, cuentaEnRevision.eCodCuenta, item.fkeCodProduct, item.fkeCodPresentacion)
        : await actualizarCantidadItemCuenta(item.fkeCodOrden, cuentaEnRevision.eCodCuenta, item.fkeCodProduct, item.fkeCodPresentacion, nueva);
      if ("error" in result) { toast.error(result.error); return; }
      await recargarRevision(cuentaEnRevision.eCodCuenta);
    });
  }

  async function handleFinalizarRevision(metodoPago: MetodoPago): Promise<void> {
    if (!cuentaEnRevision) return;
    await ejecutarCobroSuelta(cuentaEnRevision.eCodCuenta, metodoPago, splitsResueltos ?? []);
  }

  async function handleAbrirResolverSplitRevision() {
    if (!cuentaEnRevision) return;
    const pendientes = await obtenerSegmentosPendientesSplit(cuentaEnRevision.eCodCuenta);
    if ("error" in pendientes) { toast.error(pendientes.error); return; }
    if (pendientes.segmentos.length === 0) {
      toast.error("No hay ningún reparto pendiente — puedes cobrar directo");
      return;
    }
    const totalProductos = itemsRevision.reduce((acc, i) => acc + i.ePrecio * i.eCantidad, 0);
    setModalSplit({
      segmentos: pendientes.segmentos,
      totalProductos,
      eCodCuentaActual: cuentaEnRevision.eCodCuenta,
      tIdentificadorActual: cuentaEnRevision.tIdentificador,
      eCodCuentaOverride: cuentaEnRevision.eCodCuenta,
    });
  }

  function handleVolver() {
    setVista("mesas");
    setMesaActiva(null);
    setECodOrden(null);
    setFhOrdenActiva(null);
    setItems([]);
    resetFiltros();
    setErrorVenta(null);
    setCongelado(null);
    setSplitsResueltos(null);
  }

  function handleVolverDeDirecto() {
    setVista("mesas");
    limpiarCarritoDirecto();
    resetFiltros();
  }

  // ── Vista: floor plan de mesas ────────────────────────────────────────────
  if (vista === "mesas") {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.titulo}>Mesas</h1>
          <div className={styles.headerActions}>
            {tieneTurno && onCerrarCaja && (
              <button className={styles.btnCerrarCaja} onClick={onCerrarCaja}>
                <LogOut size={14} />
                Cerrar caja
              </button>
            )}
            {tieneTurno && esBillar && (
              <button
                className={styles.btnPedidoDirecto}
                onClick={handleAbrirAsignarCuentaAMesa}
              >
                Abrir mesa para cuenta existente
              </button>
            )}
            {tieneTurno && (
              <button
                className={styles.btnPedidoDirecto}
                onClick={() => { resetFiltros(); setVista("directo"); }}
              >
                <ShoppingBag size={14} />
                Pedido directo
              </button>
            )}
          </div>
        </div>

        {cuentaParaAbrirMesa && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 14px", background: "#e8f5e9", border: "1px solid #a5d6a7",
            borderRadius: 8, marginBottom: 12, fontSize: 13, color: "#2e7d32",
          }}>
            <span>Toca una mesa libre para asignarle a "{cuentaParaAbrirMesa.tIdentificador}"</span>
            <button
              onClick={() => setCuentaParaAbrirMesa(null)}
              style={{ background: "none", border: "none", color: "#2e7d32", fontWeight: 700, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        )}

        {mesas.length === 0 ? (
          <div className={styles.vacio}>
            <UtensilsCrossed size={32} strokeWidth={1.2} />
            <p>No hay mesas configuradas</p>
          </div>
        ) : (
          <MesaFloorPlan
            mesas={mesas}
            disabled={isPending || !tieneTurno}
            ahora={ahora}
            esBillar={esBillar}
            formatTiempo={formatTiempo}
            calcCosto={calcCosto}
            costoPorConcepto={costoPorConcepto}
            nombrePorConcepto={nombrePorConcepto}
            onClick={handleClickMesa}
            onBadgeClick={handleBadgeClick}
          />
        )}

        {modalCocina && (
          <ModalEntregaCocina
            eCodOrden={modalCocina.eCodOrden}
            tNombreMesa={modalCocina.tNombreMesa}
            onCerrar={() => setModalCocina(null)}
            onEntregado={recargarMesas}
          />
        )}

        {modalCuenta && (
          <ModalBuscarCuenta
            onSeleccionar={modalCuenta.onSeleccionar}
            onCerrar={() => setModalCuenta(null)}
            cuentaActual={modalCuenta.cuentaActual}
            permitirCrear={modalCuenta.permitirCrear ?? true}
            onRenombrado={(nuevoNombre) => {
              if (!modalCuenta.cuentaActual) return;
              setCuentasActivas((prev) =>
                prev.map((c) => c.eCodCuenta === modalCuenta.cuentaActual!.eCodCuenta ? { ...c, tIdentificador: nuevoNombre } : c)
              );
            }}
          />
        )}
      </div>
    );
  }

  // ── Vista: pedido directo ─────────────────────────────────────────────────
  if (vista === "directo") {
    const enRevision = cuentaEnRevision !== null;
    const { pendientes: pendientesRevision } = calcCostoRevision();

    return (
      <>
        <div className={styles.ordenLayout}>
          <div className={styles.ordenHeader}>
            <button
              className={styles.btnVolver}
              onClick={enRevision ? handleCerrarRevision : handleVolverDeDirecto}
            >
              <ArrowLeft size={16} />
              <span>{enRevision ? "Pedido directo" : "Mesas"}</span>
            </button>
            <h2 className={styles.mesaNombreHeader}>
              {enRevision ? `Cobrando: ${cuentaEnRevision!.tIdentificador}` : "Pedido directo"}
            </h2>
            {!enRevision && esBillar && (
              <button
                onClick={handleAbrirCobrarCuentaSuelta}
                style={{
                  marginLeft: "auto", fontSize: 12, fontWeight: 600,
                  padding: "6px 10px", borderRadius: 8,
                  border: "1px solid var(--border-default)", background: "white",
                  color: "var(--gray)", cursor: "pointer",
                }}
              >
                Cobrar cuenta existente
              </button>
            )}
            {!enRevision && esBillar && carritoDirecto.length > 0 && (
              <button
                onClick={handleGuardarParaCuenta}
                style={{
                  fontSize: 12, fontWeight: 600,
                  padding: "6px 10px", borderRadius: 8,
                  border: "1px solid var(--border-default)", background: "white",
                  color: "var(--color-primary-dark)", cursor: "pointer",
                }}
              >
                Guardar para cuenta
              </button>
            )}
          </div>

          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "var(--space-5)", flex: 1, minHeight: 0 }}>
            <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar producto..." />
            <CategoriaCarrusel
              categorias={categorias}
              categoriaActiva={categoriaActiva}
              onSeleccionar={setCategoriaActiva}
              conteoPorCategoria={conteoPorCategoria}
            />
            <ProductoGrid
              productos={productosFiltrados}
              onAgregar={
                enRevision
                  ? () => toast.error("No se pueden agregar productos mientras revisas una cuenta existente")
                  : agregarProductoDirecto
              }
            />

            {enRevision && (
              <div
                style={{
                  position: "absolute", inset: 0,
                  background: "rgba(255,255,255,0.55)",
                  cursor: "not-allowed",
                  zIndex: 10,
                }}
                onClick={() => toast.error("No se pueden agregar productos mientras revisas una cuenta existente")}
              />
            )}
          </div>
        </div>

        {enRevision && pendientesRevision > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            padding: "10px 14px", background: "#fff8e1", border: "1px solid #ffe082",
            borderRadius: 8, margin: "0 var(--space-3) var(--space-2)", fontSize: 12, color: "#8a6d00",
          }}>
            <span>⏱ Hay tiempo compartido sin repartir — resuélvelo antes de cobrar.</span>
            <button
              onClick={handleAbrirResolverSplitRevision}
              style={{
                fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 6,
                border: "1px solid #8a6d00", background: "white", color: "#8a6d00",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Resolver reparto
            </button>
          </div>
        )}

        {cargandoRevision ? (
          <div style={{ padding: "var(--space-4)", color: "var(--gray)", fontSize: 13 }}>Cargando consumo…</div>
        ) : (
          <PedidoPanel
            items={enRevision ? itemsACarrito(itemsRevision) : carritoDirecto}
            metodosPago={metodosPago}
            onCambiarCantidad={enRevision ? handleCambiarCantidadRevision : cambiarCantidadDirecto}
            onLimpiar={enRevision ? handleCerrarRevision : limpiarCarritoDirecto}
            onFinalizar={enRevision ? handleFinalizarRevision : handleFinalizarDirecto}
            error={errorDirecto}
            aplicarIva={aplicarIva}
            bloqueado={enRevision && pendientesRevision > 0}
            cargoExtra={
              enRevision
                ? (() => {
                    const { confirmado, pendientes } = calcCostoRevision();
                    if (confirmado === 0 && pendientes === 0) return null;
                    return {
                      label: pendientes > 0 ? "Tiempo de mesa (sin repartir)" : "Tiempo de mesa",
                      monto: confirmado,
                    };
                  })()
                : null
            }
          />
        )}

        {ventaDirectaOk && (
          <ModalVentaExitosa
            eCodVenta={ventaDirectaOk}
            onNuevoPedido={() => { setVentaDirectaOk(null); limpiarCarritoDirecto(); resetFiltros(); }}
          />
        )}

        {modalCuenta && (
          <ModalBuscarCuenta
            onSeleccionar={modalCuenta.onSeleccionar}
            onCerrar={() => setModalCuenta(null)}
            cuentaActual={modalCuenta.cuentaActual}
            permitirCrear={modalCuenta.permitirCrear ?? true}
            onRenombrado={(nuevoNombre) => {
              if (!modalCuenta.cuentaActual) return;
              setCuentasActivas((prev) =>
                prev.map((c) => c.eCodCuenta === modalCuenta.cuentaActual!.eCodCuenta ? { ...c, tIdentificador: nuevoNombre } : c)
              );
            }}
          />
        )}

        {modalSplit && (
          <ModalSplit
            segmentos={modalSplit.segmentos}
            eCodCuentaActual={modalSplit.eCodCuentaActual}
            tIdentificadorActual={modalSplit.tIdentificadorActual}
            totalProductos={modalSplit.totalProductos}
            onConfirmar={(splits) => {
              setSplitsResueltos(splits);
              setModalSplit(null);
            }}
            onCerrar={() => setModalSplit(null)}
          />
        )}
      </>
    );
  }

  // ── Vista: orden de mesa ──────────────────────────────────────────────────
  const { segmentosPendientes } = calcCostoCuenta();

  return (
    <>
      <div className={styles.ordenLayout}>
        <div className={styles.ordenHeader}>
          <button className={styles.btnVolver} onClick={handleVolver}>
            <ArrowLeft size={16} />
            <span>Mesas</span>
          </button>
          <h2 className={styles.mesaNombreHeader}>{mesaActiva?.tNombre}</h2>
          {esBillar && eCodOrden && (
            <button
              onClick={handleTerminarDeJugar}
              style={{
                marginLeft: "auto", fontSize: 12, fontWeight: 600,
                padding: "6px 10px", borderRadius: 8,
                border: "1px solid var(--border-default)", background: "white",
                color: "var(--gray)", cursor: "pointer",
              }}
            >
              Terminar de jugar
            </button>
          )}
          {esBillar && eCodOrden && (() => {
            if (segmentosCuenta.length === 0) return null;
            const masReciente = [...segmentosCuenta].sort(
              (a, b) => new Date(b.fhInicio).getTime() - new Date(a.fhInicio).getTime()
            )[0];
            const puedeReabrir = masReciente.fhFin !== null && masReciente.ePorcentaje === null;
            if (!puedeReabrir) return null;

            return (
              <button
                onClick={handleReabrirSegmento}
                title="Deshace un 'Terminar de jugar' o 'Un jugador se retira' apretado por error."
                style={{
                  fontSize: 12, fontWeight: 600,
                  padding: "6px 10px", borderRadius: 8,
                  border: "1px solid var(--border-default)", background: "white",
                  color: "var(--gray)", cursor: "pointer",
                }}
              >
                Reabrir segmento
              </button>
            );
          })()}
          {esBillar && eCodOrden && (
            <button
              onClick={handleAbrirModalAgregarJugador}
              style={{
                fontSize: 12, fontWeight: 600,
                padding: "6px 10px", borderRadius: 8,
                border: "1px solid var(--border-default)", background: "white",
                color: "var(--color-primary-dark)", cursor: "pointer",
              }}
            >
              + Agregar jugador
            </button>
          )}
          {esBillar && eCodCuenta && (
            <button
              onClick={handleAbrirRenombrar}
              style={{
                fontSize: 12, fontWeight: 600,
                padding: "6px 10px", borderRadius: 8,
                border: "1px solid var(--border-default)", background: "white",
                color: "var(--gray)", cursor: "pointer",
              }}
            >
              Renombrar cuenta
            </button>
          )}
          {esBillar && eCodOrden && (() => {
            if (segmentosCuenta.length === 0) return null;
            const masReciente = [...segmentosCuenta].sort(
              (a, b) => new Date(b.fhInicio).getTime() - new Date(a.fhInicio).getTime()
            )[0];
            if (masReciente.fhFin === null) return null;

            return (
              <button
                onClick={handleLiberarMesa}
                title="El jugador se fue sin pagar — libera la mesa para otro cliente, la deuda se conserva en la cuenta para cobrarla después."
                style={{
                  fontSize: 12, fontWeight: 600,
                  padding: "6px 10px", borderRadius: 8,
                  border: "1px solid var(--color-error)", background: "white",
                  color: "var(--color-error)", cursor: "pointer",
                }}
              >
                Liberar mesa
              </button>
            );
          })()}
        </div>

        {esBillar && cuentasActivas.length > 1 && (
          <div style={{ display: "flex", gap: 8, padding: "0 var(--space-3)", flexWrap: "wrap" }}>
            {cuentasActivas.map((c) => (
              <div key={c.eCodCuenta} style={{ display: "flex", alignItems: "center" }}>
                <button
                  onClick={() => setECodCuenta(c.eCodCuenta)}
                  style={{
                    padding: "6px 12px", borderRadius: "999px 0 0 999px", fontSize: 13, fontWeight: 600,
                    borderTop:    c.eCodCuenta === eCodCuenta ? "2px solid var(--color-primary)" : "1px solid var(--border-default)",
                    borderBottom: c.eCodCuenta === eCodCuenta ? "2px solid var(--color-primary)" : "1px solid var(--border-default)",
                    borderLeft:   c.eCodCuenta === eCodCuenta ? "2px solid var(--color-primary)" : "1px solid var(--border-default)",
                    borderRight:  "none",
                    background: c.eCodCuenta === eCodCuenta ? "var(--color-primary-50)" : "white",
                    color: c.eCodCuenta === eCodCuenta ? "var(--color-primary-dark)" : "var(--gray)",
                    cursor: "pointer",
                  }}
                >
                  {c.tIdentificador}
                </button>
                <button
                  onClick={() => handleRetirarJugador(c.eCodCuenta, c.tIdentificador)}
                  title={`${c.tIdentificador} se retira`}
                  style={{
                    padding: "6px 8px", borderRadius: "0 999px 999px 0", fontSize: 13, fontWeight: 700,
                    border: c.eCodCuenta === eCodCuenta ? "2px solid var(--color-primary)" : "1px solid var(--border-default)",
                    background: c.eCodCuenta === eCodCuenta ? "var(--color-primary-50)" : "white",
                    color: "var(--color-error)",
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {esBillar && cuentasActivas.length > 1 && !eCodCuenta && (
          <p style={{ fontSize: 12, color: "var(--color-error)", padding: "0 var(--space-3)" }}>
            Selecciona una cuenta arriba antes de agregar productos.
          </p>
        )}

        {esBillar && fhOrdenActiva && segmentosPendientes > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            padding: "10px 14px", background: "#fff8e1", border: "1px solid #ffe082",
            borderRadius: 8, margin: "0 var(--space-3) var(--space-2)", fontSize: 12, color: "#8a6d00",
          }}>
            <span>⏱ Tiempo corriendo ({formatTiempoCuenta()}) — hay reparto sin resolver.</span>
            <button
              onClick={handleAbrirResolverSplit}
              style={{
                fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 6,
                border: "1px solid #8a6d00", background: "white", color: "#8a6d00",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Resolver reparto
            </button>
          </div>
        )}

        <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar producto..." />
        <CategoriaCarrusel
          categorias={categorias}
          categoriaActiva={categoriaActiva}
          onSeleccionar={setCategoriaActiva}
          conteoPorCategoria={conteoPorCategoria}
        />
        <ProductoGrid productos={productosFiltrados} onAgregar={handleAgregarProducto} />
      </div>

      <PedidoPanel
        items={itemsACarrito(esBillar ? itemsCuenta : items)}
        metodosPago={metodosPago}
        onCambiarCantidad={handleCambiarCantidad}
        onLimpiar={handleLimpiar}
        onFinalizar={handleFinalizar}
        onIniciarCobro={esBillar ? () => setCongelado(new Date()) : undefined}
        error={errorVenta}
        aplicarIva={aplicarIva}
        bloqueado={esBillar && fhOrdenActiva !== null && segmentosPendientes > 0}
        cargoExtra={
          esBillar && fhOrdenActiva
            ? (() => {
                const { confirmado, segmentosPendientes: pend } = calcCostoCuenta();
                const label = pend > 0
                  ? `Tiempo de mesa (${formatTiempoCuenta()}) — ${pend} segmento(s) sin repartir`
                  : `Tiempo de mesa (${formatTiempoCuenta()})`;
                return { label, monto: confirmado };
              })()
            : null
        }
      />

      {ventaExitosa && (
        <ModalVentaExitosa
          eCodVenta={ventaExitosa}
          onNuevoPedido={() => { setVentaExitosa(null); handleVolver(); }}
        />
      )}

      {modalCuenta && (
        <ModalBuscarCuenta
          onSeleccionar={modalCuenta.onSeleccionar}
          onCerrar={() => setModalCuenta(null)}
          cuentaActual={modalCuenta.cuentaActual}
          permitirCrear={modalCuenta.permitirCrear ?? true}
          onRenombrado={(nuevoNombre) => {
            if (!modalCuenta.cuentaActual) return;
            setCuentasActivas((prev) =>
              prev.map((c) => c.eCodCuenta === modalCuenta.cuentaActual!.eCodCuenta ? { ...c, tIdentificador: nuevoNombre } : c)
            );
          }}
        />
      )}

      {modalSplit && (
        <ModalSplit
          segmentos={modalSplit.segmentos}
          eCodCuentaActual={modalSplit.eCodCuentaActual}
          tIdentificadorActual={modalSplit.tIdentificadorActual}
          totalProductos={modalSplit.totalProductos}
          onConfirmar={(splits) => {
            setSplitsResueltos(splits);
            setModalSplit(null);
          }}
          onCerrar={() => setModalSplit(null)}
        />
      )}

      {modalConfirmarRetiro && (
        <ModalConfirmarRetiro
          tIdentificador={modalConfirmarRetiro.tIdentificador}
          onConfirmar={() => ejecutarRetiro(modalConfirmarRetiro.eCodCuenta, modalConfirmarRetiro.tIdentificador)}
          onCerrar={() => setModalConfirmarRetiro(null)}
        />
      )}

      {modalRenombrar && (
        <ModalRenombrarCuenta
          eCodCuenta={modalRenombrar.eCodCuenta}
          tIdentificadorActual={modalRenombrar.tIdentificador}
          onGuardado={(nuevoNombre) => {
            setCuentasActivas((prev) =>
              prev.map((c) => c.eCodCuenta === modalRenombrar.eCodCuenta ? { ...c, tIdentificador: nuevoNombre } : c)
            );
            setModalRenombrar(null);
          }}
          onCerrar={() => setModalRenombrar(null)}
        />
      )}
    </>
  );
}

// ── Modal: buscar cuenta abierta por nombre, o crear una nueva ───────────────
function ModalBuscarCuenta({
  onSeleccionar,
  onCerrar,
  cuentaActual,
  permitirCrear = true,
  onRenombrado,
}: {
  onSeleccionar: (eCodCuenta: string) => void;
  onCerrar: () => void;
  cuentaActual?: { eCodCuenta: string; tIdentificador: string };
  permitirCrear?: boolean;
  onRenombrado?: (nuevoNombre: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<{ eCodCuenta: string; tIdentificador: string; fhApertura: string }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nombreActual, setNombreActual] = useState(cuentaActual?.tIdentificador ?? "");
  const [guardandoActual, setGuardandoActual] = useState(false);

  async function handleGuardarNombreActual() {
    if (!cuentaActual || !nombreActual.trim() || nombreActual.trim() === cuentaActual.tIdentificador) return;
    setGuardandoActual(true);
    const result = await renombrarCuenta(cuentaActual.eCodCuenta, nombreActual.trim());
    setGuardandoActual(false);
    if ("error" in result) { toast.error(result.error); return; }
    toast.success("Nombre actualizado");
    onRenombrado?.(nombreActual.trim());
  }

  useEffect(() => {
    if (!query.trim()) { setResultados([]); return; }
    const timeout = setTimeout(async () => {
      setBuscando(true);
      const result = await buscarCuentasAbiertas(query.trim());
      setBuscando(false);
      if ("error" in result) { toast.error(result.error); return; }
      setResultados(result.cuentas);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function handleCrear() {
    if (!query.trim()) return;
    setCreando(true);
    const result = await crearCuenta(query.trim());
    setCreando(false);
    if ("error" in result) { toast.error(result.error); return; }
    onSeleccionar(result.cuenta.eCodCuenta);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }}>
      <div style={{ background: "white", borderRadius: 12, padding: 20, width: 340, maxWidth: "90vw" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Buscar o crear cuenta</h3>

        {cuentaActual && (
          <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #eee" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--dark)", display: "block", marginBottom: 4 }}>
              Nombre del primer jugador
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={nombreActual}
                onChange={(e) => setNombreActual(e.target.value)}
                onBlur={handleGuardarNombreActual}
                placeholder="Ej. Juan"
                style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
              />
              {guardandoActual && <span style={{ fontSize: 11, color: "var(--gray)", alignSelf: "center" }}>Guardando…</span>}
            </div>
            <p style={{ fontSize: 11, color: "var(--gray)", margin: "4px 0 0" }}>
              Hoy dice "{cuentaActual.tIdentificador}" — ponle el nombre real para no confundirlo después.
            </p>
          </div>
        )}

        <input
          autoFocus
          placeholder="Nombre del cliente"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", marginBottom: 10 }}
        />

        {buscando && <p style={{ fontSize: 12, color: "var(--gray)" }}>Buscando…</p>}

        {resultados.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10, maxHeight: 200, overflowY: "auto" }}>
            {resultados.map((c) => (
              <button
                key={c.eCodCuenta}
                onClick={() => onSeleccionar(c.eCodCuenta)}
                style={{
                  textAlign: "left", padding: "8px 10px", borderRadius: 8,
                  border: "1px solid var(--border-default)", background: "white", cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.tIdentificador}</div>
                <div style={{ fontSize: 11, color: "var(--gray)" }}>
                  Abierta {new Date(c.fhApertura).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </button>
            ))}
          </div>
        )}

        {query.trim() && !buscando && permitirCrear && (
          <button
            onClick={handleCrear}
            disabled={creando}
            style={{
              width: "100%", padding: 10, borderRadius: 8, marginBottom: 10,
              border: "1px dashed var(--color-primary)", background: "white",
              color: "var(--color-primary-dark)", fontWeight: 600, cursor: "pointer",
            }}
          >
            {creando ? "Creando…" : `+ Crear cuenta nueva "${query.trim()}"`}
          </button>
        )}

        {query.trim() && !buscando && !permitirCrear && resultados.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--gray)", margin: "0 0 10px" }}>
            No se encontró ninguna cuenta abierta con ese nombre. Solo se pueden
            cobrar cuentas que ya tengan consumo — no se puede crear una vacía.
          </p>
        )}

        <button onClick={onCerrar} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-default)", background: "white", cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Modal: definir % de tiempo compartido antes de cobrar ────────────────────
// Solo define porcentajes — ya no elige método de pago ni muestra
// ModalEfectivo (eso volvió a PedidoPanel, que ya lo hacía bien para el caso
// simple). Al confirmar, entrega los splits al padre, que los guarda
// localmente y desbloquea el panel normal de cobro.
function ModalSplit({
  segmentos,
  eCodCuentaActual,
  tIdentificadorActual,
  totalProductos,
  onConfirmar,
  onCerrar,
}: {
  segmentos: {
    fkeCodSegmento: string;
    fhInicio: string;
    fhFin: string | null;
    bCerrado: boolean;
    eCostoHora: number;
    otrasCuentas: { eCodCuenta: string; tIdentificador: string }[];
  }[];
  eCodCuentaActual: string;
  tIdentificadorActual: string;
  totalProductos: number;
  onConfirmar: (splits: { fkeCodSegmento: string; repartos: { eCodCuenta: string; ePorcentaje: number }[] }[]) => void;
  onCerrar: () => void;
}) {
  function repartoIgual(n: number): number[] {
    const base = Math.floor(100 / n);
    const valores = Array(n).fill(base);
    valores[n - 1] = 100 - base * (n - 1);
    return valores;
  }

  const [valores, setValores] = useState<Record<string, Record<string, number>>>(() => {
    const inicial: Record<string, Record<string, number>> = {};
    for (const s of segmentos) {
      const participantes = [eCodCuentaActual, ...s.otrasCuentas.map((o) => o.eCodCuenta)];
      const repartos = repartoIgual(participantes.length);
      inicial[s.fkeCodSegmento] = Object.fromEntries(participantes.map((p, i) => [p, repartos[i]]));
    }
    return inicial;
  });

  function montoTotalSegmento(s: (typeof segmentos)[number]): number {
    const fin = s.fhFin ? new Date(s.fhFin) : new Date();
    const horas = Math.max(0, (fin.getTime() - new Date(s.fhInicio).getTime()) / 3600000);
    return horas * s.eCostoHora;
  }

  function sumaSegmento(fkeCodSegmento: string): number {
    return Object.values(valores[fkeCodSegmento] ?? {}).reduce((a, b) => a + b, 0);
  }

  function handleCambiarValor(fkeCodSegmento: string, eCodCuenta: string, nuevoValor: number) {
    setValores((v) => ({
      ...v,
      [fkeCodSegmento]: { ...v[fkeCodSegmento], [eCodCuenta]: nuevoValor },
    }));
  }

  function handleRepartirIgual(fkeCodSegmento: string, participantes: string[]) {
    const repartos = repartoIgual(participantes.length);
    setValores((v) => ({
      ...v,
      [fkeCodSegmento]: Object.fromEntries(participantes.map((p, i) => [p, repartos[i]])),
    }));
  }

  const todosSuman100 = segmentos.every((s) => Math.abs(sumaSegmento(s.fkeCodSegmento) - 100) < 0.5);

  const tiempoDeEstaCuenta = segmentos.reduce((acc, s) => {
    const pct = valores[s.fkeCodSegmento]?.[eCodCuentaActual] ?? 0;
    return acc + montoTotalSegmento(s) * (pct / 100);
  }, 0);
  const totalEstimado = totalProductos + tiempoDeEstaCuenta;

  function handleConfirmar() {
    if (!todosSuman100) return;
    const splits = segmentos.map((s) => ({
      fkeCodSegmento: s.fkeCodSegmento,
      repartos: Object.entries(valores[s.fkeCodSegmento] ?? {}).map(([eCodCuenta, ePorcentaje]) => ({
        eCodCuenta,
        ePorcentaje,
      })),
    }));
    onConfirmar(splits);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }}>
      <div style={{ background: "white", borderRadius: 12, padding: 20, width: 420, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px" }}>¿Cómo se reparte el tiempo?</h3>
        <p style={{ fontSize: 12, color: "var(--gray)", margin: "0 0 14px" }}>
          Define el % de cada cuenta. Por default se reparte igual entre todos.
          El método de pago y el vuelto se piden después, en el panel normal.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 16 }}>
          {segmentos.map((s) => {
            const participantes = [
              { eCodCuenta: eCodCuentaActual, tIdentificador: tIdentificadorActual },
              ...s.otrasCuentas,
            ];
            const suma = sumaSegmento(s.fkeCodSegmento);
            const sumaOk = Math.abs(suma - 100) < 0.5;
            const montoTotal = montoTotalSegmento(s);

            return (
              <div key={s.fkeCodSegmento} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--gray)" }}>
                    {participantes.length} cuentas compartiendo este tiempo
                  </span>
                  <button
                    onClick={() => handleRepartirIgual(s.fkeCodSegmento, participantes.map((p) => p.eCodCuenta))}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 6,
                      border: "1px solid var(--color-primary)", background: "white",
                      color: "var(--color-primary-dark)", cursor: "pointer",
                    }}
                  >
                    Repartir igual
                  </button>
                </div>

                <p style={{ fontSize: 11, color: "var(--gray)", margin: "0 0 10px" }}>
                  Total del segmento: ${montoTotal.toFixed(2)}
                  {!s.bCerrado && " (estimado — sigue corriendo, el monto final se fija al cobrar)"}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {participantes.map((p) => {
                    const pct = valores[s.fkeCodSegmento]?.[p.eCodCuenta] ?? 0;
                    const montoParticipante = montoTotal * (pct / 100);
                    return (
                      <div key={p.eCodCuenta} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: p.eCodCuenta === eCodCuentaActual ? 700 : 400 }}>
                          {p.tIdentificador}{p.eCodCuenta === eCodCuentaActual ? " (esta cuenta)" : ""}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={pct}
                          onChange={(e) => handleCambiarValor(s.fkeCodSegmento, p.eCodCuenta, Number(e.target.value))}
                          style={{ width: 55, padding: 6, borderRadius: 6, border: "1px solid #ddd", textAlign: "right" }}
                        />
                        <span style={{ fontSize: 13, color: "var(--gray)", width: 16 }}>%</span>
                        <span style={{ fontSize: 13, fontWeight: 600, width: 60, textAlign: "right" }}>
                          ${montoParticipante.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: 12, textAlign: "right", marginTop: 8, color: sumaOk ? "var(--gray)" : "var(--color-error)", fontWeight: sumaOk ? 400 : 700 }}>
                  Suma: {suma}% {!sumaOk && "— debe sumar 100%"}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: 12, color: "var(--gray)", margin: "0 0 12px", textAlign: "right" }}>
          Estimado de esta cuenta (productos + su tiempo): <strong>${totalEstimado.toFixed(2)}</strong>
        </p>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--border-default)", background: "white", cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!todosSuman100}
            style={{
              flex: 2, padding: 10, borderRadius: 8, border: "none",
              background: todosSuman100 ? "var(--color-primary)" : "#ccc",
              color: "white", fontWeight: 700,
              cursor: todosSuman100 ? "pointer" : "not-allowed",
            }}
          >
            Confirmar reparto
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: confirmar "Un jugador se retira" ───────────────────────────────────
function ModalConfirmarRetiro({
  tIdentificador,
  onConfirmar,
  onCerrar,
}: {
  tIdentificador: string;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }}>
      <div style={{ background: "white", borderRadius: 12, padding: 20, width: 340, maxWidth: "90vw" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 8px" }}>
          ¿"{tIdentificador}" se retira?
        </h3>
        <p style={{ fontSize: 13, color: "var(--gray)", margin: "0 0 18px", lineHeight: 1.5 }}>
          Se corta el tiempo compartido en este momento. Las cuentas que se
          quedan siguen jugando con un segmento nuevo, sin verse afectadas.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCerrar}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--border-default)", background: "white", cursor: "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "none", background: "var(--color-error)", color: "white", fontWeight: 700, cursor: "pointer" }}
          >
            Confirmar retiro
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: "Renombrar cuenta" ───────────────────────────────────────────────
function ModalRenombrarCuenta({
  eCodCuenta,
  tIdentificadorActual,
  onGuardado,
  onCerrar,
}: {
  eCodCuenta: string;
  tIdentificadorActual: string;
  onGuardado: (nuevoNombre: string) => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(tIdentificadorActual);
  const [guardando, setGuardando] = useState(false);

  async function handleGuardar() {
    const limpio = nombre.trim();
    if (!limpio || limpio === tIdentificadorActual) { onCerrar(); return; }
    setGuardando(true);
    const result = await renombrarCuenta(eCodCuenta, limpio);
    setGuardando(false);
    if ("error" in result) { toast.error(result.error); return; }
    toast.success("Nombre actualizado");
    onGuardado(limpio);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }}>
      <div style={{ background: "white", borderRadius: 12, padding: 20, width: 320, maxWidth: "90vw" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 12px" }}>Renombrar cuenta</h3>
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleGuardar(); }}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", marginBottom: 14 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--border-default)", background: "white", cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando || !nombre.trim()}
            style={{
              flex: 1, padding: 10, borderRadius: 8, border: "none",
              background: guardando || !nombre.trim() ? "#ccc" : "var(--color-primary)",
              color: "white", fontWeight: 700,
              cursor: guardando || !nombre.trim() ? "not-allowed" : "pointer",
            }}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
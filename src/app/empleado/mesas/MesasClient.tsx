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
import { ModalEfectivo }     from "@/components/ui/ModalEfectivo/ModalEfectivo";
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
                // Si hay segmentoActivo, es la fuente correcta (respeta
                // "Terminar de jugar" — se congela en fhFin). Si por algo
                // no vino (no debería pasar en billar con mesa ocupada),
                // cae de vuelta a fhAbierta como antes.
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

            {/* Badge de cocina — aparece cuando hay items listos */}
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

// Duplicado del criterio de PedidoPanel (no está exportado desde ahí) — para
// que ModalSplit sepa si debe mostrar ModalEfectivo antes de confirmar,
// igual que ya hace PedidoPanel automáticamente en el caso simple.
function esMetodoEfectivo(metodo: { tNamePay: string } | undefined): boolean {
  if (!metodo) return false;
  if ("tTipoPay" in metodo && (metodo as any).tTipoPay === "efectivo") return true;
  return metodo.tNamePay.toLowerCase().includes("efectivo");
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

  // Cuenta existente esperando que el cajero elija una mesa LIBRE para
  // asignarla — flujo de "Abrir mesa para cuenta existente" (ej. un cliente
  // que ya jugó, liberó su mesa, y ahora quiere jugar en otra sin perder su
  // consumo pendiente ni generar una cuenta genérica nueva).
  const [cuentaParaAbrirMesa, setCuentaParaAbrirMesa] = useState<{ eCodCuenta: string; tIdentificador: string } | null>(null);
  const [cuentasActivas,  setCuentasActivas]  = useState<{ eCodCuenta: string; tIdentificador: string }[]>([]);

  // Modal de búsqueda/creación de cuenta — usado tanto por pedido directo
  // ("Guardar para cuenta") como por "+ Agregar jugador".
  const [modalCuenta, setModalCuenta] = useState<{
    onSeleccionar: (eCodCuenta: string) => void;
    cuentaActual?: { eCodCuenta: string; tIdentificador: string };
    permitirCrear?: boolean;
  } | null>(null);

  // Modal de split de tiempo — aparece al cobrar si hay segmentos
  // compartidos (2+ cuentas) sin porcentaje definido todavía.
  const [modalSplit, setModalSplit] = useState<{
    segmentos: {
      fkeCodSegmento: string;
      fhInicio: string;
      fhFin: string | null;
      bCerrado: boolean;
      eCostoHora: number;
      otrasCuentas: { eCodCuenta: string; tIdentificador: string }[];
    }[];
    // Necesario para que ModalSplit muestre el cobro total real (productos
    // + su parte del tiempo) — el método de pago y el vuelto (si aplica)
    // ahora se resuelven DENTRO de ModalSplit, no antes, porque el total
    // real no se conoce hasta que el % queda fijo.
    totalProductos: number;
    // Cuenta desde cuyo punto de vista se abrió el cobro — necesaria para
    // que ModalSplit arme el reparto completo (ella + otrasCuentas), no solo
    // el % de un tercero.
    eCodCuentaActual: string;
    tIdentificadorActual: string;
    // Si viene de "Cobrar cuenta existente" (pedido directo, sin mesa), el
    // flujo normal de ejecutarCobro no aplica porque no hay eCodOrden de
    // mesa — se necesita saber explícitamente sobre qué cuenta operar.
    eCodCuentaOverride?: string;
  } | null>(null);

  // Modal de "Cobrar cuenta existente" desde pedido directo — cuenta sin
  // ninguna mesa asociada (huérfana, guardada para después que nunca llegó
  // a sentarse en una mesa).
  // "Cobrar cuenta existente" ya no abre un modal — carga el consumo en el
  // panel derecho, de solo lectura salvo por quitar productos. Estado
  // separado de itemsCuenta/segmentosCuenta (que pertenecen al flujo de
  // mesa) para que no se pisen entre sí si ambos coexistieran en memoria.
  const [cuentaEnRevision, setCuentaEnRevision] = useState<{ eCodCuenta: string; tIdentificador: string } | null>(null);
  const [itemsRevision, setItemsRevision] = useState<OrdenMesaDetalleConProducto[]>([]);
  const [segmentosRevision, setSegmentosRevision] = useState<
    { fkeCodSegmento: string; fhInicio: string; fhFin: string | null; eCostoHora: number; ePorcentaje: number | null }[]
  >([]);
  const [segmentosAmbiguosRevision, setSegmentosAmbiguosRevision] = useState<Set<string>>(new Set());
  const [cargandoRevision, setCargandoRevision] = useState(false);

  // Modal de confirmación para "Un jugador se retira" — corta tiempo
  // compartido, merece fricción explícita, no un window.confirm() nativo.
  const [modalConfirmarRetiro, setModalConfirmarRetiro] = useState<{ eCodCuenta: string; tIdentificador: string } | null>(null);

  // Modal dedicado de "Renombrar cuenta" — acción explícita en el header,
  // no escondida dentro de "+ Agregar jugador" como estaba antes.
  const [modalRenombrar, setModalRenombrar] = useState<{ eCodCuenta: string; tIdentificador: string } | null>(null);

  // ── Modal de entrega de cocina ────────────────────────────────────────────
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

  // Mapa eCodConcepto -> eCostoHora, para no repetir el .find() en cada tick del timer
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
   * Costo de tiempo de ESTA cuenta, separando lo ya resuelto (ePorcentaje
   * definido) de lo pendiente (segmento compartido sin split todavía — se
   * define hasta cobrar, vía ModalSplit). No es la fuente de verdad del
   * cobro final — eso lo calcula cobrarCuenta en el servidor al momento
   * exacto de cobrar. Esto es solo para que el cajero vea un estimado
   * mientras la cuenta sigue consumiendo.
   */
  const calcCostoCuenta = useCallback((): { confirmado: number; segmentosPendientes: number } => {
    if (!ahoraEfectivo) return { confirmado: 0, segmentosPendientes: 0 };
    // Si la mesa solo tiene una cuenta, no hay ambigüedad real — el servidor
    // va a auto-resolver cualquier segmento pendiente a 100% al cobrar. Se
    // muestra como confirmado aquí también, aunque en la DB siga NULL hasta
    // el momento del cobro (cobrarCuenta lo resuelve, no antes).
    const sinAmbiguedad = cuentasActivas.length <= 1;

    let confirmado = 0;
    let segmentosPendientes = 0;
    for (const s of segmentosCuenta) {
      const fin   = s.fhFin ? new Date(s.fhFin) : ahoraEfectivo;
      const horas = Math.max(0, (fin.getTime() - new Date(s.fhInicio).getTime()) / (1000 * 60 * 60));
      const porcentaje = s.ePorcentaje ?? (sinAmbiguedad ? 100 : null);
      if (porcentaje === null) {
        segmentosPendientes += 1;
        continue;
      }
      confirmado += horas * s.eCostoHora * (porcentaje / 100);
    }
    return { confirmado: Math.round(confirmado * 100) / 100, segmentosPendientes };
  }, [ahoraEfectivo, segmentosCuenta, cuentasActivas]);

  /**
   * Reloj mostrado junto al cargo de tiempo — DEBE usar los mismos segmentos
   * que calcCostoCuenta, no fhOrdenActiva. Antes mostraba el tiempo desde que
   * se abrió la mesa completa, sin importar si "Terminar de jugar" ya congeló
   * el segmento — resultado: el dinero se detenía pero el reloj seguía
   * corriendo, dos fuentes de datos desincronizadas.
   */
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
   * Costo de tiempo para "Cobrar cuenta existente" en el panel — mismo
   * criterio que se corrigió en ModalCobrarCuentaExistente: un segmento con
   * ePorcentaje null solo es "pendiente" de verdad si además está en
   * segmentosAmbiguosRevision (2+ cuentas todavía abiertas). Si no, se
   * auto-resuelve a 100% sin preguntar, y se cuenta como confirmado.
   */
  function calcCostoRevision(): { confirmado: number; pendientes: number } {
    let confirmado = 0;
    let pendientes = 0;
    for (const s of segmentosRevision) {
      const esAmbiguo = segmentosAmbiguosRevision.has(s.fkeCodSegmento);
      if (s.ePorcentaje === null && esAmbiguo) { pendientes += 1; continue; }
      const porcentaje = s.ePorcentaje ?? 100;
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

  // Mismo patrón que recargarConsumoCuenta, pero para "Cobrar cuenta
  // existente" — además trae segmentosAmbiguos (obtenerSegmentosPendientesSplit)
  // para no repetir el bug de mostrar "sin repartir" en el caso de un solo
  // jugador, que se auto-resuelve a 100% sin preguntar nada.
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

  // ── Recargar consumo filtrado por cuenta cada vez que cambia la selección ──
  useEffect(() => {
    if (!esBillar) return;
    recargarConsumoCuenta(eCodCuenta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eCodCuenta, esBillar]);

  // ── Polling de mesas (para el badge de cocina) ────────────────────────────
  useEffect(() => {
    if (vista !== "mesas") return;
    recargarMesas();                          // inmediato al entrar a la vista
    const id = setInterval(recargarMesas, 5000); // cada 5s en lugar de 8s
    return () => clearInterval(id);
  }, [vista]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click en mesa del floor plan ──────────────────────────────────────────
  async function handleClickMesa(mesa: MesaConEstado) {
    if (!tieneTurno) {
      toast.error("Debes abrir un turno antes de atender mesas");
      return;
    }

    setMesaActiva(mesa);
    setErrorVenta(null);

    if (mesa.ordenAbierta) {
      if (cuentaParaAbrirMesa) {
        // Hay una cuenta esperando ser asignada a una mesa LIBRE — esta ya
        // está ocupada, no tiene sentido aquí. No se limpia el estado
        // pendiente para que el cajero pueda intentar con otra mesa.
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
        // Forzado explícito: si eCodCuenta resuelve al MISMO valor que ya
        // tenía en estado (misma cuenta de una visita anterior a esta mesa),
        // el useEffect que depende de [eCodCuenta] no vuelve a dispararse
        // porque React no ve cambio de valor — itemsCuenta se quedaría con
        // datos viejos. Se llama aquí directo para no depender de eso.
        await recargarConsumoCuenta(cuentas[0].eCodCuenta);
      } else if (esBillar && cuentas.length !== 1) {
        // 0 cuentas: algo falló al abrir la mesa (ver comentario en abrirOrdenMesa).
        // >1 cuenta: requiere que el cajero elija — el selector se muestra en
        // la vista de orden (abajo), no se auto-selecciona ninguna aquí.
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

  // ── Click en badge de cocina ──────────────────────────────────────────────
  function handleBadgeClick(mesa: MesaConEstado) {
    if (!mesa.ordenAbierta) return;
    setModalCocina({
      eCodOrden:   mesa.ordenAbierta.eCodOrden,
      tNombreMesa: mesa.tNombre,
    });
  }

  // ── "+ Agregar jugador" ────────────────────────────────────────────────────
  function handleAbrirModalAgregarJugador() {
    if (!eCodOrden) return;
    setModalCuenta({
      // Si hay exactamente 1 cuenta activa (el caso típico: se agrega el
      // segundo jugador), se ofrece renombrarla de "Mesa X" al nombre real.
      // Con 2+ ya no aplica — cuál renombrar dejaría de ser obvio.
      cuentaActual: cuentasActivas.length === 1 ? cuentasActivas[0] : undefined,
      onSeleccionar: (eCodCuentaNueva: string) => {
        startTransition(async () => {
          const result = await agregarJugador(eCodOrden, eCodCuentaNueva);
          if ("error" in result) { toast.error(result.error); return; }
          toast.success("Jugador agregado");
          setModalCuenta(null);
          if (mesaActiva) await handleClickMesa(mesaActiva); // recarga cuentasActivas
          // handleClickMesa no dispara recargarConsumoCuenta si eCodCuenta no
          // cambia de valor (la cuenta seleccionada puede seguir siendo la
          // misma) — se fuerza aquí para no quedarse con datos viejos.
          if (eCodCuenta) await recargarConsumoCuenta(eCodCuenta);
        });
      },
    });
  }

  // ── "Terminar de jugar" — corta el timer sin cobrar todavía ───────────────
  function handleTerminarDeJugar() {
    if (!eCodOrden) return;
    startTransition(async () => {
      const result = await terminarDeJugar(eCodOrden);
      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Tiempo detenido");
      if (eCodCuenta) await recargarConsumoCuenta(eCodCuenta);
    });
  }

  // ── "Reabrir segmento" — corrige un "Terminar de jugar" o "Un jugador se
  // retira" apretado por error. El servidor valida que sea el más reciente
  // y que nadie haya cobrado ya con ese reparto — aquí solo se manda el ID
  // del segmento más reciente que este cliente conoce (de segmentosCuenta);
  // si no coincide con lo que el servidor considera "el más reciente de
  // verdad", el servidor lo rechaza con un mensaje claro, no se asume nada.
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

  // ── "Renombrar cuenta" — acción explícita en el header, para la cuenta
  // actualmente seleccionada. Antes solo era posible renombrar entrando a
  // "+ Agregar jugador", lo cual no tenía relación conceptual con la tarea.
  function handleAbrirRenombrar() {
    if (!eCodCuenta) return;
    const actual = cuentasActivas.find((c) => c.eCodCuenta === eCodCuenta);
    if (!actual) return;
    setModalRenombrar({ eCodCuenta: actual.eCodCuenta, tIdentificador: actual.tIdentificador });
  }

  // ── "Liberar mesa" — el jugador se fue sin pagar, pero la mesa física debe
  // quedar disponible para otro cliente. La deuda de la cuenta se conserva y
  // se cobra después desde "Cobrar cuenta existente" en pedido directo. El
  // servidor rechaza si todavía hay tiempo corriendo (falta "Terminar de
  // jugar" primero).
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

  // ── "Un jugador se retira" — corta el segmento compartido sin tocar el
  // tiempo de quien se queda. Necesario porque cobrar una cuenta que sigue
  // compartiendo segmento con otra le cortaría el tiempo a esta última sin
  // que nadie lo pida (mismo incidente que ya pasó con "fa", esta vez desde
  // la mesa en vez de pedido directo).
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
      if (mesaActiva) await handleClickMesa(mesaActiva); // recarga cuentasActivas + segmentos
      // Si la cuenta retirada era la seleccionada, cambiar a otra restante
      // para no dejar el panel apuntando a algo que ya no está en la mesa.
      if (eCodCuenta === eCodCuentaQueSeVa) {
        const restantes = cuentasActivas.filter((c) => c.eCodCuenta !== eCodCuentaQueSeVa);
        setECodCuenta(restantes[0]?.eCodCuenta ?? null);
      }
    });
  }

  // ── Pedido directo ────────────────────────────────────────────────────────
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

  // ── "Guardar para cuenta" — todo el carrito directo se va a una cuenta,
  // en vez de cobrarse de inmediato. No pasa por crearVenta ni descuenta
  // inventario todavía — eso ocurre hasta que esa cuenta se cobre (mesa o
  // pedido directo, da igual, cobrarCuenta ve todo el consumo junto).
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

  // ── "Cobrar cuenta existente" (sin mesa) ───────────────────────────────────
  function handleAbrirCobrarCuentaSuelta() {
    setModalCuenta({
      permitirCrear: false,
      onSeleccionar: (eCodCuentaSel: string) => {
        startTransition(async () => {
          const result = await obtenerCuenta(eCodCuentaSel);
          if ("error" in result) { toast.error(result.error); return; }
          if (!result.bAbierta) { toast.error("Esa cuenta ya fue cobrada"); return; }

          // Bloquear si sigue jugando en alguna mesa — cobrar aquí cerraría
          // por tiempo TODO el segmento, incluida cualquier otra cuenta que
          // siga compartiendo esa mesa (ej. otro jugador todavía activo).
          // Ese cobro debe hacerse desde la mesa, donde el cajero ve el
          // contexto completo, no a ciegas desde pedido directo.
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

  // ── "Abrir mesa para cuenta existente" — un cliente que ya jugó, liberó su
  // mesa (o terminó y no ha cobrado), y ahora va a jugar en OTRA mesa. Sin
  // esto, abrir cualquier mesa nueva crea una cuenta genérica distinta,
  // dejando el consumo viejo separado del nuevo. Busca la cuenta primero;
  // el siguiente clic en una mesa LIBRE la usa en vez de crear una nueva.
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

  // ── Mesa: agregar producto ────────────────────────────────────────────────
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

  // Cambiar cantidad / eliminar: en billar, opera por PRODUCTO (no por
  // eCodDetalle) porque ordenes_mesa_detalle y cuenta_detalle_producto tienen
  // IDs independientes — ver nota en actualizarCantidadItemCuenta.
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
      // limpiarOrdenMesa solo borra ordenes_mesa_detalle, nunca
      // cuenta_detalle_producto — usarlo aquí dejaría el cobro real
      // desincronizado del carrito visible (cobraría productos ya
      // "limpiados"). Bloqueado hasta que exista una versión dual-write.
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

    // Defensivo: PedidoPanel debería estar bloqueado (bloqueado=true) mientras
    // haya split pendiente, así que esto no debería alcanzar a dispararse.
    // Si de algún modo se dispara, se rechaza en vez de cobrar con datos
    // incompletos — no se repite el bug de "vuelto contra un total sin
    // repartir" que ya se encontró y se movió a "Resolver reparto y cobrar".
    if (esBillar) {
      const { pendientes } = await verificarSplitPendiente(eCodCuenta as string);
      if (pendientes) {
        toast.error("Hay tiempo sin repartir — usa \"Resolver reparto y cobrar\" primero");
        return;
      }
    }

    await ejecutarCobro(metodoPago, []);
  }

  // Chequeo liviano reutilizado por handleFinalizar (defensivo) y por
  // handleAbrirResolverSplit (real). No usa calcCostoCuenta() porque esa
  // depende del estado local segmentosCuenta, que puede no estar
  // perfectamente sincronizado — esto consulta al servidor directo.
  async function verificarSplitPendiente(codCuenta: string): Promise<{ pendientes: boolean }> {
    const result = await obtenerSegmentosPendientesSplit(codCuenta);
    if ("error" in result) return { pendientes: false };
    return { pendientes: result.segmentos.length > 0 };
  }

  // ── "Resolver reparto y cobrar" — reemplaza el botón normal de PedidoPanel
  // (bloqueado mientras haya split pendiente). Abre ModalSplit directo, sin
  // método de pago pre-elegido — el método y el vuelto se resuelven DENTRO
  // de ModalSplit, una vez que el % (y por tanto el total real) ya está fijo.
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
    setVentaExitosa(result.eCodVenta);
    await recargarMesas();
  }

  /**
   * Cobra una cuenta SIN pasar por el contexto de mesa (eCodOrden, eCodCuenta
   * del estado). Usada por "Cobrar cuenta existente" desde pedido directo —
   * para cuentas huérfanas que se guardaron para después pero nunca llegaron
   * a sentarse en una mesa.
   */
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
    setCuentaEnRevision(null);
    setVentaDirectaOk(result.eCodVenta);
  }

  // ── Revisión de "Cobrar cuenta existente" en el panel ──────────────────────
  // Solo lectura salvo por quitar productos (o reducir cantidad). No se
  // pueden agregar productos nuevos desde aquí — para eso existe "Guardar
  // para cuenta" en el carrito normal de pedido directo.
  function handleCerrarRevision() {
    setCuentaEnRevision(null);
    setItemsRevision([]);
    setSegmentosRevision([]);
    setSegmentosAmbiguosRevision(new Set());
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
    // Defensivo — mismo criterio que handleFinalizar: no debería alcanzar a
    // dispararse porque PedidoPanel está bloqueado mientras haya pendiente.
    const { pendientes } = await verificarSplitPendiente(cuentaEnRevision.eCodCuenta);
    if (pendientes) {
      toast.error("Hay tiempo sin repartir — usa \"Resolver reparto y cobrar\" primero");
      return;
    }
    await ejecutarCobroSuelta(cuentaEnRevision.eCodCuenta, metodoPago, []);
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

        {/* Modal de entrega de cocina */}
        {modalCocina && (
          <ModalEntregaCocina
            eCodOrden={modalCocina.eCodOrden}
            tNombreMesa={modalCocina.tNombreMesa}
            onCerrar={() => setModalCocina(null)}
            onEntregado={recargarMesas}
          />
        )}

        {/* Modal de "Abrir mesa para cuenta existente" — la vista de mesas
            nunca tenía este render, por eso no aparecía nada al presionar el
            botón hasta entrar a una mesa (donde esta vista sí lo renderiza). */}
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

        {enRevision && calcCostoRevision().pendientes > 0 && (
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
              Resolver reparto y cobrar
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
            bloqueado={enRevision && calcCostoRevision().pendientes > 0}
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
            metodosPago={metodosPago}
            onConfirmar={async (splits, metodoPago) => {
              const override = modalSplit.eCodCuentaOverride;
              setModalSplit(null);
              if (override) await ejecutarCobroSuelta(override, metodoPago, splits);
            }}
            onCerrar={() => setModalSplit(null)}
          />
        )}
      </>
    );
  }

  // ── Vista: orden de mesa ──────────────────────────────────────────────────
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
            // Solo mostrar si el segmento más reciente está cerrado y esta
            // cuenta todavía no tiene reparto resuelto ahí — no es la misma
            // validación exacta del servidor (esa mira TODOS los
            // participantes, no solo esta cuenta), pero evita el caso más
            // común: ofrecer el botón cuando obviamente no hay nada que
            // reabrir porque el tiempo sigue corriendo.
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
            // Mismo criterio que "Reabrir segmento": solo tiene sentido si el
            // segmento más reciente ya está detenido — liberar la mesa con
            // tiempo corriendo cortaría el juego sin avisar.
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

        {esBillar && fhOrdenActiva && calcCostoCuenta().segmentosPendientes > 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
            padding: "10px 14px", background: "#fff8e1", border: "1px solid #ffe082",
            borderRadius: 8, margin: "0 var(--space-3) var(--space-2)", fontSize: 12, color: "#8a6d00",
          }}>
            <span>⏱ Tiempo corriendo ({formatTiempoCuenta()}) — hay reparto sin resolver, cóbralo desde ahí.</span>
            <button
              onClick={handleAbrirResolverSplit}
              style={{
                fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 6,
                border: "1px solid #8a6d00", background: "white", color: "#8a6d00",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Resolver reparto y cobrar
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
        bloqueado={esBillar && fhOrdenActiva !== null && calcCostoCuenta().segmentosPendientes > 0}
        cargoExtra={
          esBillar && fhOrdenActiva
            ? (() => {
                const { confirmado, segmentosPendientes } = calcCostoCuenta();
                const label = segmentosPendientes > 0
                  ? `Tiempo de mesa (${formatTiempoCuenta()}) — ${segmentosPendientes} segmento(s) sin repartir`
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
          metodosPago={metodosPago}
          onConfirmar={async (splits, metodoPago) => {
            const override = modalSplit.eCodCuentaOverride;
            setModalSplit(null);
            if (override) await ejecutarCobroSuelta(override, metodoPago, splits);
            else await ejecutarCobro(metodoPago, splits);
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
// Usado por "+ Agregar jugador" y (más adelante) por "Guardar para cuenta"
// en pedido directo. Nunca auto-selecciona — homónimos son responsabilidad
// del cajero, no del sistema.
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
// Aparece solo cuando hay segmentos con 2+ cuentas y ePorcentaje sin definir.
// Un segmento por fila; el % de "esta cuenta" se captura, el resto (100 - x)
// se asume que corresponde a las otras cuentas del segmento (solo soporta
// 2 participantes por segmento en la UI — con 3+ habría que repartir entre
// varias, que no está contemplado en este modal).
function ModalSplit({
  segmentos,
  eCodCuentaActual,
  tIdentificadorActual,
  totalProductos,
  metodosPago,
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
  metodosPago: MetodoPagoGlobal[];
  onConfirmar: (
    splits: { fkeCodSegmento: string; repartos: { eCodCuenta: string; ePorcentaje: number }[] }[],
    metodoPago: MetodoPago
  ) => void;
  onCerrar: () => void;
}) {
  // Reparto igual por default (caso más común, confirmado con el cliente).
  // El último participante absorbe el residuo del redondeo para garantizar
  // que la suma dé exactamente 100, no 99.9 o 100.1 por división no exacta
  // (ej. 3 personas -> 33, 33, 34, no 33.33 x3 que nunca suma 100 limpio).
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

  // Paso 1: definir %. Paso 2: elegir método de pago (y ModalEfectivo si
  // aplica) — separado a propósito. El total real de ESTA cuenta solo se
  // conoce hasta que el % queda fijo, así que el método de pago (y el
  // vuelto, si es efectivo) no se pueden pedir antes sin mostrar un total
  // equivocado — el mismo bug que tenía PedidoPanel mostrando vuelto contra
  // un total con el segmento todavía sin repartir.
  const [paso, setPaso] = useState<"porcentajes" | "metodo">("porcentajes");
  const [metodoPago, setMetodoPago] = useState<string>(metodosPago[0]?.eCodPay ?? "");
  const [mostrarEfectivo, setMostrarEfectivo] = useState(false);

  /**
   * Monto estimado en pesos para este segmento completo (100%), a partir de
   * fhInicio hasta AHORA si sigue abierto, o hasta fhFin si ya se cerró.
   * Si el segmento sigue corriendo (bCerrado=false), esto es un ESTIMADO que
   * va a diferir del monto final real — cobrarCuenta recalcula la duración
   * exacta en el momento del cobro, unos segundos o minutos después de que
   * el cajero vio este número. No se puede mostrar un monto garantizado
   * para un segmento que sigue corriendo, solo una aproximación honesta.
   */
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

  // Suma solo la parte de ESTA cuenta en cada segmento — es lo que de
  // verdad se le va a cobrar, no el total del segmento completo.
  const tiempoDeEstaCuenta = segmentos.reduce((acc, s) => {
    const pct = valores[s.fkeCodSegmento]?.[eCodCuentaActual] ?? 0;
    return acc + montoTotalSegmento(s) * (pct / 100);
  }, 0);
  const totalFinal = totalProductos + tiempoDeEstaCuenta;
  const hayAlgunSegmentoAbierto = segmentos.some((s) => !s.bCerrado);

  function construirSplits() {
    return segmentos.map((s) => ({
      fkeCodSegmento: s.fkeCodSegmento,
      repartos: Object.entries(valores[s.fkeCodSegmento] ?? {}).map(([eCodCuenta, ePorcentaje]) => ({
        eCodCuenta,
        ePorcentaje,
      })),
    }));
  }

  function handleConfirmarPorcentajes() {
    if (!todosSuman100) return;
    setPaso("metodo");
  }

  function handleElegirMetodo(eCodPay: string) {
    setMetodoPago(eCodPay);
    const metodo = metodosPago.find((m) => m.eCodPay === eCodPay);
    if (esMetodoEfectivo(metodo)) {
      setMostrarEfectivo(true);
      return;
    }
    onConfirmar(construirSplits(), eCodPay as MetodoPago);
  }

  if (paso === "metodo") {
    return (
      <>
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
        }}>
          <div style={{ background: "white", borderRadius: 12, padding: 20, width: 360, maxWidth: "90vw" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>{tIdentificadorActual}</h3>
            <p style={{ fontSize: 12, color: "var(--gray)", margin: "0 0 14px" }}>
              Total a cobrar: <strong>${totalFinal.toFixed(2)}</strong>
              {hayAlgunSegmentoAbierto && " (el tiempo sigue corriendo — puede variar un poco al confirmar)"}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {metodosPago.map((m) => (
                <button
                  key={m.eCodPay}
                  onClick={() => handleElegirMetodo(m.eCodPay)}
                  style={{
                    padding: 10, borderRadius: 8, border: "1px solid var(--border-default)",
                    background: "white", cursor: "pointer", fontWeight: 600, fontSize: 13,
                  }}
                >
                  Cobrar con {m.tNamePay}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPaso("porcentajes")}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-default)", background: "white", cursor: "pointer" }}
            >
              Volver a los porcentajes
            </button>
          </div>
        </div>

        {mostrarEfectivo && (
          <ModalEfectivo
            total={totalFinal}
            onConfirmar={() => {
              setMostrarEfectivo(false);
              onConfirmar(construirSplits(), metodoPago as MetodoPago);
            }}
            onCancelar={() => setMostrarEfectivo(false)}
          />
        )}
      </>
    );
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

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid var(--border-default)", background: "white", cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirmarPorcentajes}
            disabled={!todosSuman100}
            style={{
              flex: 2, padding: 10, borderRadius: 8, border: "none",
              background: todosSuman100 ? "var(--color-primary)" : "#ccc",
              color: "white", fontWeight: 700,
              cursor: todosSuman100 ? "pointer" : "not-allowed",
            }}
          >
            Confirmar y cobrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: "Cobrar cuenta existente" (sin mesa) ───────────────────────────────
// Trae el consumo de la cuenta (productos + tiempo, si hubiera alguno) y deja
// elegir método de pago. Si hay segmentos de tiempo sin split (caso raro para
// una cuenta que nunca tocó mesa, pero posible si la cuenta viene de un
// "+ Agregar jugador" y luego el cliente se fue sin cobrar en esa mesa),
// dispara onSplitPendiente en vez de cobrar directo.
function ModalCobrarCuentaExistente({
  eCodCuenta,
  tIdentificador,
  metodosPago,
  aplicarIva,
  onCerrar,
  onSplitPendiente,
  onCobrar,
}: {
  eCodCuenta: string;
  tIdentificador: string;
  metodosPago: { eCodPay: string; tNamePay: string }[];
  aplicarIva: boolean;
  onCerrar: () => void;
  onSplitPendiente: (
    segmentos: { fkeCodSegmento: string; fhInicio: string; otrasCuentas: { eCodCuenta: string; tIdentificador: string }[] }[],
    metodoPago: MetodoPago
  ) => void;
  onCobrar: (metodoPago: MetodoPago) => void;
}) {
  const [items, setItems] = useState<OrdenMesaDetalleConProducto[] | null>(null);
  const [segmentos, setSegmentos] = useState<
    { fkeCodSegmento: string; fhInicio: string; fhFin: string | null; eCostoHora: number; ePorcentaje: number | null }[] | null
  >(null);
  // IDs de segmentos GENUINAMENTE ambiguos (2+ cuentas todavía abiertas) —
  // fuente de verdad real, la misma que decide si se abre el modal de split
  // al cobrar. Antes, esta pantalla adivinaba "pendiente" con solo mirar
  // ePorcentaje === null, lo cual también marca como pendiente el caso de
  // un solo jugador (que se auto-resuelve a 100% sin preguntar nada) —
  // mostraba "sin repartir" como falsa alarma y luego cobraba directo sin
  // abrir ningún modal, contradiciendo lo que acababa de decir en pantalla.
  const [segmentosAmbiguos, setSegmentosAmbiguos] = useState<Set<string> | null>(null);
  const [cobrando, setCobrando] = useState(false);

  useEffect(() => {
    obtenerConsumoCuenta(eCodCuenta).then((result) => {
      if ("error" in result) { toast.error(result.error); setItems([]); return; }
      setItems(result.items);
    });
    obtenerSegmentosCuenta(eCodCuenta).then((result) => {
      if ("error" in result) { toast.error(result.error); setSegmentos([]); return; }
      setSegmentos(result.segmentos);
    });
    obtenerSegmentosPendientesSplit(eCodCuenta).then((result) => {
      if ("error" in result) { toast.error(result.error); setSegmentosAmbiguos(new Set()); return; }
      setSegmentosAmbiguos(new Set(result.segmentos.map((s) => s.fkeCodSegmento)));
    });
  }, [eCodCuenta]);

  const totalProductos = (items ?? []).reduce((acc, i) => acc + i.ePrecio * i.eCantidad, 0);

  // Un segmento con ePorcentaje null solo cuenta como "pendiente" de verdad
  // si además está en segmentosAmbiguos (2+ cuentas abiertas). Si no está
  // ahí, es el caso de un solo jugador: se auto-resuelve a 100% sin
  // preguntar, así que se cuenta como confirmado aquí también.
  let tiempoConfirmado = 0;
  let segmentosPendientes = 0;
  for (const s of segmentos ?? []) {
    const esAmbiguo = segmentosAmbiguos?.has(s.fkeCodSegmento) ?? false;
    if (s.ePorcentaje === null && esAmbiguo) { segmentosPendientes += 1; continue; }
    const porcentaje = s.ePorcentaje ?? 100; // null pero no ambiguo → se auto-resuelve a 100
    const fin = s.fhFin ? new Date(s.fhFin) : new Date();
    const horas = Math.max(0, (fin.getTime() - new Date(s.fhInicio).getTime()) / 3600000);
    tiempoConfirmado += horas * s.eCostoHora * (porcentaje / 100);
  }
  tiempoConfirmado = Math.round(tiempoConfirmado * 100) / 100;

  const total = totalProductos + tiempoConfirmado;
  const cargando = items === null || segmentos === null || segmentosAmbiguos === null;
  const hayAlgoQueCobrar = (items?.length ?? 0) > 0 || tiempoConfirmado > 0 || segmentosPendientes > 0;

  async function handleElegirMetodo(metodoPago: MetodoPago) {
    setCobrando(true);
    const pendientes = await obtenerSegmentosPendientesSplit(eCodCuenta);
    setCobrando(false);
    if ("error" in pendientes) { toast.error(pendientes.error); return; }

    if (pendientes.segmentos.length > 0) {
      onSplitPendiente(pendientes.segmentos, metodoPago);
      return;
    }
    onCobrar(metodoPago);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
    }}>
      <div style={{ background: "white", borderRadius: 12, padding: 20, width: 380, maxWidth: "90vw" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>{tIdentificador}</h3>
        <p style={{ fontSize: 12, color: "var(--gray)", margin: "0 0 14px" }}>Cuenta sin mesa asociada</p>

        {cargando ? (
          <p style={{ fontSize: 13, color: "var(--gray)" }}>Cargando consumo…</p>
        ) : !hayAlgoQueCobrar ? (
          <p style={{ fontSize: 13, color: "var(--gray)" }}>Esta cuenta no tiene consumo pendiente.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12, maxHeight: 220, overflowY: "auto" }}>
            {(items ?? []).map((i) => (
              <div key={i.eCodDetalle} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>{i.eCantidad}× {i.producto?.tNameProduct ?? "Producto"}</span>
                <span>${(i.ePrecio * i.eCantidad).toFixed(2)}</span>
              </div>
            ))}
            {(tiempoConfirmado > 0 || segmentosPendientes > 0) && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span>Tiempo de mesa</span>
                <span>{segmentosPendientes > 0 ? "sin repartir" : `$${tiempoConfirmado.toFixed(2)}`}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, borderTop: "1px solid #eee", paddingTop: 6, marginTop: 4 }}>
              <span>Total {segmentosPendientes > 0 && "(sin tiempo)"}</span>
              <span>${total.toFixed(2)}</span>
            </div>
            {segmentosPendientes > 0 && (
              <p style={{ fontSize: 11, color: "#8a6d00", margin: 0 }}>
                Hay tiempo compartido sin repartir — se define al confirmar el cobro.
              </p>
            )}
            {aplicarIva && (
              <p style={{ fontSize: 11, color: "var(--gray)", margin: 0 }}>IVA incluido</p>
            )}
          </div>
        )}

        {!cargando && hayAlgoQueCobrar && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {metodosPago.map((m) => (
              <button
                key={m.eCodPay}
                disabled={cobrando}
                onClick={() => handleElegirMetodo(m.eCodPay as MetodoPago)}
                style={{
                  padding: 10, borderRadius: 8, border: "1px solid var(--border-default)",
                  background: "white", cursor: "pointer", fontWeight: 600, fontSize: 13,
                }}
              >
                Cobrar con {m.tNamePay}
              </button>
            ))}
          </div>
        )}

        <button onClick={onCerrar} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border-default)", background: "white", cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Modal: confirmar "Un jugador se retira" ───────────────────────────────────
// Acción que corta tiempo compartido de otra(s) cuenta(s) — merece fricción
// explícita, no un window.confirm() nativo inconsistente con el resto de la UI.
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

// ── Modal: "Renombrar cuenta" — acción explícita, no escondida dentro de
// "+ Agregar jugador" como estaba antes.
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
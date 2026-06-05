"use client";

import { useState, useMemo } from "react";
import { ShoppingBag, TrendingUp } from "lucide-react";
import { StatCards }    from "@/components/ui/Statscards";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { formatFechaHora } from "@/lib/utils/fecha";
import type { DetalleVentaConProducto } from "@/types";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import styles from "./ventasEmpleado.module.css";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Venta {
  eCodVenta:     string;
  eTotal:        number;
  fkeMetodoPago: string;
  fhCreateVenta: string;
  detalle_venta: DetalleVentaConProducto[];
}

interface Props {
  ventas:      Venta[];
  totalHoy:    number;
  metodosPago: MetodoPagoGlobal[];
}

// ── Paleta de colores para badges ─────────────────────────────────────────────

const PALETA_METODO = [
  { bg: "var(--color-primary-50)",  color: "var(--color-primary-dark)", border: "var(--color-primary-light)"  },
  { bg: "var(--color-accent-bg)",   color: "var(--color-accent)",       border: "#f5d5b0"                     },
  { bg: "#E6F1FB",                  color: "#185FA5",                   border: "#B5D4F4"                     },
  { bg: "var(--color-warning-bg)",  color: "var(--color-warning)",      border: "var(--color-warning-border)" },
  { bg: "var(--color-success-bg)",  color: "var(--color-success)",      border: "var(--color-success-border)" },
];

function resolverMetodo(fkeMetodoPago: string, metodosPago: MetodoPagoGlobal[]) {
  const idx    = metodosPago.findIndex((m) => m.eCodPay === fkeMetodoPago);
  const metodo = idx >= 0 ? metodosPago[idx] : null;
  const estilo = PALETA_METODO[idx >= 0 ? idx % PALETA_METODO.length : 0];
  return { nombre: metodo?.tNamePay ?? "Método eliminado", estilo };
}

// ── Helper de periodo ─────────────────────────────────────────────────────────

type FiltroPeriodo = "hoy" | "semana" | "mes" | "todo";

function estaEnPeriodo(fechaISO: string, periodo: FiltroPeriodo): boolean {
  const d     = new Date(fechaISO);
  const ahora = new Date();
  if (periodo === "hoy") {
    return (
      d.getFullYear() === ahora.getFullYear() &&
      d.getMonth()    === ahora.getMonth()    &&
      d.getDate()     === ahora.getDate()
    );
  }
  if (periodo === "semana") {
    const inicio = new Date(ahora);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - 7);
    return d >= inicio;
  }
  if (periodo === "mes") {
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
  }
  return true;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function VentasEmpleadoClient({ ventas, totalHoy, metodosPago }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros]   = useState<FiltrosUsuario>({
    busqueda: "", roles: [], estados: [], periodo: "hoy", metodo: "todos", empleado: "todos",
  });
  const [ventaExpandida, setVentaExpandida] = useState<string | null>(null);

  const opcionesMetodo = useMemo(() => [
    { value: "todos", label: "Todos" },
    ...metodosPago.map((m) => ({ value: m.eCodPay, label: m.tNamePay })),
  ], [metodosPago]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const ventasFiltradas = useMemo(() => ventas.filter((v) => {
    const coincidePeriodo  = estaEnPeriodo(v.fhCreateVenta, (filtros.periodo ?? "hoy") as FiltroPeriodo);
    const coincideMetodo   = !filtros.metodo || filtros.metodo === "todos" || v.fkeMetodoPago === filtros.metodo;
    const folio            = v.eCodVenta.slice(-8).toUpperCase();
    const coincideBusqueda =
      !filtros.busqueda ||
      folio.includes(filtros.busqueda.toUpperCase()) ||
      v.detalle_venta.some((d) =>
        d.producto?.tNameProduct.toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
        d.presentacion?.tNombre.toLowerCase().includes(filtros.busqueda.toLowerCase())
      );
    return coincidePeriodo && coincideMetodo && coincideBusqueda;
  }), [ventas, filtros]);

  const totalFiltrado = ventasFiltradas.reduce((acc, v) => acc + v.eTotal, 0);
  const totalPiezas   = ventasFiltradas.reduce(
    (acc, v) => acc + v.detalle_venta.reduce((s, d) => s + d.eCantidad, 0), 0
  );

  return (
    <div className={styles.layout}>
      {/* Banner total del día */}
      <div className={styles.banner}>
        <div className={styles.bannerLeft}>
          <div className={styles.bannerLabel}>
            <TrendingUp size={16} />
            Mi total de ventas (Hoy)
          </div>
          <div className={styles.bannerTotal}>
            {totalHoy.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className={styles.bannerRight}>
          <ShoppingBag size={64} strokeWidth={0.8} className={styles.bannerIcon} />
        </div>
      </div>

      {/* Stats */}
      <StatCards stats={[
        { label: "Ventas en periodo", value: ventasFiltradas.length, variante: "primary" },
        { label: "Piezas vendidas",   value: totalPiezas,            variante: "success" },
        {
          label: "Total periodo",
          value: totalFiltrado.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 }),
          variante: "accent",
        },
      ]} />

      {/* Toolbar */}
      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={ventasFiltradas.length}
        ocultarRol
        ocultarEstado
        mostrarPeriodo
        opcionesMetodo={opcionesMetodo}
      />

      {/* Grid de ventas */}
      {ventasFiltradas.length === 0 ? (
        <div className={styles.vacio}>
          <ShoppingBag size={48} strokeWidth={1} />
          <p>No hay ventas en este periodo</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {ventasFiltradas.map((venta) => {
            const folio              = venta.eCodVenta.slice(-8).toUpperCase();
            const expandida          = ventaExpandida === venta.eCodVenta;
            const { nombre, estilo } = resolverMetodo(venta.fkeMetodoPago, metodosPago);

            return (
              <div
                key={venta.eCodVenta}
                className={`${styles.card} ${expandida ? styles.cardExpandida : ""}`}
                onClick={() => setVentaExpandida(expandida ? null : venta.eCodVenta)}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardFolio}>Venta #{folio}</span>
                  <span
                    className={styles.cardMetodo}
                    style={{ background: estilo.bg, color: estilo.color, border: `1px solid ${estilo.border}` }}
                  >
                    {nombre}
                  </span>
                </div>

                <div className={styles.cardFecha}>{formatFechaHora(venta.fhCreateVenta)}</div>

                <div className={styles.cardDetalle}>
                  <div className={styles.cardDetalleHeader}>
                    <span>Pzas</span>
                    <span>Producto</span>
                    <span>Precio</span>
                  </div>

                  {(expandida ? venta.detalle_venta : venta.detalle_venta.slice(0, 4)).map((d) => (
                    <div key={d.eCodDetalle} className={styles.cardDetalleRow}>
                      <span className={styles.cantidad}>{d.eCantidad}</span>
                      <span className={styles.nombre}>
                        {d.producto?.tNameProduct ?? "—"}
                        {d.presentacion?.tNombre && (
                          <span>
                            {" " + d.presentacion.tNombre}
                          </span>
                        )}
                      </span>
                      <span className={styles.precio}>${d.ePrecioUnitario.toFixed(2)}</span>
                    </div>
                  ))}

                  {!expandida && venta.detalle_venta.length > 4 && (
                    <div className={styles.masProductos}>
                      +{venta.detalle_venta.length - 4} más...
                    </div>
                  )}
                </div>

                <div className={styles.cardTotal}>
                  <span className={styles.cardTotalLabel}>Monto Total</span>
                  <span className={styles.cardTotalValor}>${venta.eTotal.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
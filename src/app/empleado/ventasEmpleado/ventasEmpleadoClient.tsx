// src/app/empleado/ventasEmpleado/ventasEmpleadoClient.tsx
"use client";

import { useState, useMemo } from "react";
import { Banknote, CreditCard, Smartphone, ShoppingBag, TrendingUp } from "lucide-react";
import { Buscador } from "@/components/ui/Buscador";
import { StatCards } from "@/components/ui/Statscards";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { formatFechaHora } from "@/lib/utils/fecha";
import styles from "./ventasEmpleado.module.css";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DetalleVenta {
  eCodDetalle:     string;
  fkeCodVenta:     string;
  fkeCodProduct:   string;
  eCantidad:       number;
  ePrecioUnitario: number;
  eSubtotal:       number;
  producto?: {
    tNameProduct: string;
    ImgProduct?:  string;
  } | null;
}

interface Venta {
  eCodVenta:     string;
  eTotal:        number;
  fkeMetodoPago:   string;
  metodoPagoNombre:  string;   // ← nombre legible
  metodoPagoIcono?:  string | null;
  fhCreateVenta: string;
  detalle_venta: DetalleVenta[];
}

interface Props {
  ventas:      Venta[];
  totalHoy:    number;
  metodosPago: string[];
}

// ── Config de métodos ─────────────────────────────────────────────────────────

const METODO_ICONS: Record<string, React.ReactNode> = {
  efectivo:      <Banknote size={13} />,
  tarjeta:       <CreditCard size={13} />,
  transferencia: <Smartphone size={13} />,
};

const METODO_LABELS: Record<string, string> = {
  efectivo:      "Efectivo",
  tarjeta:       "Tarjeta",
  transferencia: "QR / Transfer",
};

// ── Helper de periodo ─────────────────────────────────────────────────────────

type FiltroPeriodo = "hoy" | "semana" | "mes" | "todo";

function estaEnPeriodo(fechaISO: string, periodo: FiltroPeriodo): boolean {
  const d     = new Date(fechaISO);
  const ahora = new Date();

  if (periodo === "hoy") {
    return (
      d.getUTCFullYear() === ahora.getUTCFullYear() &&
      d.getUTCMonth()    === ahora.getUTCMonth()    &&
      d.getUTCDate()     === ahora.getUTCDate()
    );
  }
  if (periodo === "semana") {
    const hace7 = new Date(ahora);
    hace7.setUTCDate(ahora.getUTCDate() - 7);
    hace7.setUTCHours(0, 0, 0, 0);
    return d >= hace7;
  }
  if (periodo === "mes") {
    return (
      d.getUTCMonth()    === ahora.getUTCMonth() &&
      d.getUTCFullYear() === ahora.getUTCFullYear()
    );
  }
  return true;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VentasEmpleadoClient({ ventas, totalHoy }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "",
    roles:    [],
    estados:  [],
    periodo:  "hoy",
    metodo:   "todos",
    empleado: "todos",
  });
  const [ventaExpandida, setVentaExpandida] = useState<string | null>(null);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      const coincidePeriodo = estaEnPeriodo(
        v.fhCreateVenta,
        (filtros.periodo ?? "hoy") as FiltroPeriodo
      );

      const folio = v.eCodVenta.slice(-8).toUpperCase();
      const coincideBusqueda =
        !filtros.busqueda ||
        folio.includes(filtros.busqueda.toUpperCase()) ||
        v.detalle_venta.some((d) =>
          d.producto?.tNameProduct.toLowerCase().includes(filtros.busqueda.toLowerCase())
        );

      return coincidePeriodo && coincideBusqueda;
    });
  }, [ventas, filtros]);

  const totalFiltrado = ventasFiltradas.reduce((acc, v) => acc + v.eTotal, 0);
  const totalPiezas   = ventasFiltradas.reduce(
    (acc, v) => acc + v.detalle_venta.reduce((s, d) => s + d.eCantidad, 0),
    0
  );

  return (
    <div className={styles.layout}>
      <Buscador
        valor={busqueda}
        onChange={setBusqueda}
        placeholder="Buscar folio o producto..."
      />

      {/* ── Banner total del día ── */}
      <div className={styles.banner}>
        <div className={styles.bannerLeft}>
          <div className={styles.bannerLabel}>
            <TrendingUp size={16} />
            Mi total de ventas (Hoy)
          </div>
          <div className={styles.bannerTotal}>
            {totalHoy.toLocaleString("es-MX", {
              style:                 "currency",
              currency:              "MXN",
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className={styles.bannerRight}>
          <ShoppingBag size={64} strokeWidth={0.8} className={styles.bannerIcon} />
        </div>
      </div>

      {/* ── Stats del periodo ── */}
      <StatCards
        stats={[
          { label: "Ventas en periodo", value: ventasFiltradas.length, variante: "primary" },
          { label: "Piezas vendidas",   value: totalPiezas,            variante: "success" },
          {
            label: "Total periodo",
            value: totalFiltrado.toLocaleString("es-MX", {
              style:                 "currency",
              currency:              "MXN",
              minimumFractionDigits: 0,
            }),
            variante: "accent",
          },
        ]}
      />

      {/* ── Toolbar ── */}
      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={ventasFiltradas.length}
        ocultarRol
        ocultarEstado
        mostrarPeriodo
      />

      {/* ── Grid de ventas ── */}
      {ventasFiltradas.length === 0 ? (
        <div className={styles.vacio}>
          <ShoppingBag size={48} strokeWidth={1} />
          <p>No hay ventas en este periodo</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {ventasFiltradas.map((venta) => {
            const folio       = venta.eCodVenta.slice(-8).toUpperCase();
            const metodoLabel = venta.metodoPagoNombre;
            const metodoClase = venta.fkeMetodoPago; // para el CSS si el id coincide con la clase
            const expandida   = ventaExpandida === venta.eCodVenta;
            return (
              <div
                key={venta.eCodVenta}
                className={`${styles.card} ${expandida ? styles.cardExpandida : ""}`}
                onClick={() => setVentaExpandida(expandida ? null : venta.eCodVenta)}
              >
                {/* Encabezado */}
                <div className={styles.cardHeader}>
                  <span className={styles.cardFolio}>Venta #{folio}</span>
                  <span className={`${styles.cardMetodo} ${styles[`metodo_${metodoClase}`] ?? styles.metodo_efectivo}`}>
                    {metodoLabel}
                  </span>
                </div>

                {/* Hora */}
                <div className={styles.cardFecha}>
                  {formatFechaHora(venta.fhCreateVenta)}
                </div>

                {/* Tabla de productos */}
                <div className={styles.cardDetalle}>
                  <div className={styles.cardDetalleHeader}>
                    <span>Pzas</span>
                    <span>Producto</span>
                    <span>Precio</span>
                  </div>

                  {(expandida
                    ? venta.detalle_venta
                    : venta.detalle_venta.slice(0, 4)
                  ).map((d) => (
                    <div key={d.eCodDetalle} className={styles.cardDetalleRow}>
                      <span className={styles.cantidad}>{d.eCantidad}</span>
                      <span className={styles.nombre}>
                        {d.producto?.tNameProduct ?? "—"}
                      </span>
                      <span className={styles.precio}>
                        ${d.ePrecioUnitario.toFixed(2)}
                      </span>
                    </div>
                  ))}

                  {!expandida && venta.detalle_venta.length > 4 && (
                    <div className={styles.masProductos}>
                      +{venta.detalle_venta.length - 4} más...
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className={styles.cardTotal}>
                  <span className={styles.cardTotalLabel}>Monto Total</span>
                  <span className={styles.cardTotalValor}>
                    ${venta.eTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
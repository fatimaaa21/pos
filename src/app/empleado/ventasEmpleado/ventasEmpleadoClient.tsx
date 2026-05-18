// src/app/empleado/mis-ventas/MisVentasClient.tsx
"use client";

import { useState, useMemo } from "react";
import { Banknote, CreditCard, Smartphone, ShoppingBag, TrendingUp } from "lucide-react";
import { Buscador } from "@/components/ui/Buscador";
import { StatCards } from "@/components/ui/Statscards";
import { formatFechaHora } from "@/lib/utils/fecha";
import styles from "./ventasEmpleado.module.css";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DetalleVenta {
  eCodDetalle: string;
  fkeCodVenta: string;
  fkeCodProduct: string;
  eCantidad: number;
  ePrecioUnitario: number;
  eSubtotal: number;
  producto?: {
    tNameProduct: string;
    ImgProduct?: string;
  } | null;
}

interface Venta {
  eCodVenta: string;
  eTotal: number;
  eMetodoPago: "efectivo" | "transferencia" | "tarjeta";
  fhCreateVenta: string;
  detalle_venta: DetalleVenta[];
}

interface Props {
  ventas: Venta[];
  totalHoy: number;
}

// ── Icono por método de pago ───────────────────────────────────────────────────

const METODO_CONFIG = {
  efectivo: {
    label: "Efectivo",
    icon: <Banknote size={13} />,
    clase: "efectivo",
  },
  tarjeta: {
    label: "Tarjeta",
    icon: <CreditCard size={13} />,
    clase: "tarjeta",
  },
  transferencia: {
    label: "QR / Transfer",
    icon: <Smartphone size={13} />,
    clase: "transferencia",
  },
} as const;

// ── Filtros de fecha ──────────────────────────────────────────────────────────

type FiltroPeriodo = "hoy" | "semana" | "mes" | "todo";

const PERIODOS: { value: FiltroPeriodo; label: string }[] = [
  { value: "hoy",    label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes",    label: "Este mes" },
  { value: "todo",   label: "Todo" },
];

// Compara fechas usando la parte de fecha en UTC para evitar
// problemas de zona horaria entre servidor y navegador
function estaEnPeriodo(fechaISO: string, periodo: FiltroPeriodo): boolean {
  const d = new Date(fechaISO);
  const ahora = new Date();

  if (periodo === "hoy") {
    // Comparar año/mes/día en UTC
    return (
      d.getUTCFullYear() === ahora.getUTCFullYear() &&
      d.getUTCMonth()    === ahora.getUTCMonth()    &&
      d.getUTCDate()     === ahora.getUTCDate()
    );
  }
  if (periodo === "semana") {
    const hace7dias = new Date(ahora);
    hace7dias.setUTCDate(ahora.getUTCDate() - 7);
    hace7dias.setUTCHours(0, 0, 0, 0);
    return d >= hace7dias;
  }
  if (periodo === "mes") {
    return (
      d.getUTCMonth()    === ahora.getUTCMonth() &&
      d.getUTCFullYear() === ahora.getUTCFullYear()
    );
  }
  return true; // "todo"
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VentasEmpleadoClient({ ventas, totalHoy }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [periodo, setPeriodo] = useState<FiltroPeriodo>("hoy");
  const [ventaExpandida, setVentaExpandida] = useState<string | null>(null);

  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => {
      const coincidePeriodo = estaEnPeriodo(v.fhCreateVenta, periodo);
      const folio = v.eCodVenta.slice(-8).toUpperCase();
      const coincideBusqueda =
        !busqueda ||
        folio.includes(busqueda.toUpperCase()) ||
        v.detalle_venta.some(
          (d) =>
            d.producto?.tNameProduct
              .toLowerCase()
              .includes(busqueda.toLowerCase())
        );
      return coincidePeriodo && coincideBusqueda;
    });
  }, [ventas, periodo, busqueda]);

  const totalFiltrado = ventasFiltradas.reduce((acc, v) => acc + v.eTotal, 0);
  const totalPiezas = ventasFiltradas.reduce(
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
              style: "currency",
              currency: "MXN",
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
              style: "currency",
              currency: "MXN",
              minimumFractionDigits: 0,
            }),
            variante: "accent",
          },
        ]}
      />

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.periodos}>
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              className={`${styles.periodoBtn} ${
                periodo === p.value ? styles.periodoBtnActivo : ""
              }`}
              onClick={() => setPeriodo(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid de ventas ── */}
      {ventasFiltradas.length === 0 ? (
        <div className={styles.vacio}>
          <ShoppingBag size={48} strokeWidth={1} />
          <p>No hay ventas en este periodo</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {ventasFiltradas.map((venta) => {
            const folio = venta.eCodVenta.slice(-8).toUpperCase();
            const metodo = METODO_CONFIG[venta.eMetodoPago] ?? METODO_CONFIG.efectivo;
            const expandida = ventaExpandida === venta.eCodVenta;

            return (
              <div
                key={venta.eCodVenta}
                className={`${styles.card} ${expandida ? styles.cardExpandida : ""}`}
                onClick={() =>
                  setVentaExpandida(expandida ? null : venta.eCodVenta)
                }
              >
                {/* Encabezado */}
                <div className={styles.cardHeader}>
                  <span className={styles.cardFolio}>Venta #{folio}</span>
                  <span className={`${styles.cardMetodo} ${styles[`metodo_${metodo.clase}`]}`}>
                    {metodo.icon}
                    {metodo.label}
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
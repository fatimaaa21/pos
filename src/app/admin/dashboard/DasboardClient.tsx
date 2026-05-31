"use client";

import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, ChevronRight,
  DollarSign, ShoppingCart, BarChart2,
  Banknote, Package, Users, Clock, AlertTriangle,
} from "lucide-react";
import * as Icons from "lucide-react";
import { formatRelativo } from "@/lib/utils/fecha";
import styles from "./Dashboard.module.css";

// ── Tipos exportados para page.tsx ─────────────────────────────────────────

export interface TurnoActivo {
  eCodCorte:     string;
  fkeCodUser:    string;
  tNombreTurno:  string | null;
  fhInicioTurno: string;
  eFondoInicial: number;
  bStateCorte:   string;
  empleado:      { eCodUser: string; tNameUser: string } | null;
  ventasTurno:   { total: number; count: number };
}

export interface CorteConEmpleadoDash {
  eCodCorte:     string;
  fkeCodUser:    string;
  tNombreTurno:  string | null;
  fhCierreTurno: string | null;
  eDiferencia:   number | null;
  bStateCorte:   string;
  empleado:      { eCodUser: string; tNameUser: string } | null;
}

export interface DesglosePago {
  eCodPay:    string;
  nombre:     string;
  icono:      string;
  total:      number;
  porcentaje: number;
}

export interface TendenciaDia {
  label:  string;
  total:  number;
  esHoy:  boolean;
  fecha:  string;
}

export interface TopProducto {
  eCodProduct:  string;
  tNameProduct: string;
  ImgProduct:   string | null;
  categoria:    string | null;
  cantVendida:  number;
  totalRevenue: number;
}

export interface DashboardClientProps {
  nombreNegocio:    string;
  totalHoy:         number;
  numVentas:        number;
  ticketPromedio:   number;
  efectivoHoy:      number;
  totalAyer:        number;
  numVentasAyer:    number;
  desglosePagos:    DesglosePago[];
  turnosAbiertos:   TurnoActivo[];
  cortesPendientes: CorteConEmpleadoDash[];
  alertas:          { agotados: number; stockBajo: number };
  tendencia:        TendenciaDia[];
  topProductos:     TopProducto[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000)
    return `$${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0 });
}

function fmtFull(n: number): string {
  return n.toLocaleString("es-MX", {
    style: "currency", currency: "MXN",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function calcTendencia(hoy: number, ayer: number): number | null {
  if (ayer === 0) return null;
  return ((hoy - ayer) / ayer) * 100;
}

function getFechaLong(): string {
  return new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatDuracion(desde: string): string {
  const diff    = Date.now() - new Date(desde).getTime();
  const horas   = Math.floor(diff / (1000 * 60 * 60));
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (horas === 0) return `${minutos}m`;
  return `${horas}h${minutos > 0 ? ` ${minutos}m` : ""}`;
}

function iniciales(nombre: string): string {
  return nombre.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function IconoMetodo({ nombre, size = 14 }: { nombre: string; size?: number }) {
  const Icono = (Icons as Record<string, any>)[nombre];
  return Icono ? <Icono size={size} /> : <Icons.CreditCard size={size} />;
}

// ── Badge de tendencia ─────────────────────────────────────────────────────

function TrendBadge({
  tendencia,
  dark = false,
}: {
  tendencia: number | null;
  dark?: boolean;
}) {
  if (tendencia === null) {
    return (
      <span className={styles.kpiTrendNeutral}>
        Sin datos de ayer
      </span>
    );
  }
  const pos = tendencia >= 0;
  return (
    <span
      className={`${styles.kpiTrend} ${
        pos ? styles.kpiTrendPos : styles.kpiTrendNeg
      }`}
    >
      {pos
        ? <TrendingUp size={10} strokeWidth={2.5} />
        : <TrendingDown size={10} strokeWidth={2.5} />}
      {pos ? "+" : ""}
      {tendencia.toFixed(1)}% vs ayer
    </span>
  );
}

// ── Tooltip de recharts ────────────────────────────────────────────────────

function CustomTooltip({
  active, payload, label,
}: {
  active?:  boolean;
  payload?: Array<{ value: number }>;
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      <div className={styles.tooltipValor}>{fmtFull(payload[0].value)}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════

export function DashboardClient({
  nombreNegocio,
  totalHoy,
  numVentas,
  ticketPromedio,
  efectivoHoy,
  totalAyer,
  numVentasAyer,
  desglosePagos,
  turnosAbiertos,
  cortesPendientes,
  alertas,
  tendencia,
  topProductos,
}: DashboardClientProps) {

  const tendVentas  = calcTendencia(totalHoy, totalAyer);
  const tendTxns    = numVentasAyer > 0
    ? numVentas - numVentasAyer
    : null;

  return (
    <div className={styles.dashboard}>

      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>¡Hola, {nombreNegocio}!</h1>
          <p className={styles.pageFecha}>{getFechaLong()}</p>
        </div>

        <div className={styles.pageHeaderBadges}>
          {turnosAbiertos.length > 0 && (
            <span className={styles.badgeTurnos}>
              <span className={styles.pulseDot} />
              {turnosAbiertos.length} turno{turnosAbiertos.length !== 1 ? "s" : ""} activo
              {turnosAbiertos.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Alertas críticas ── */}
      {(alertas.agotados > 0 || cortesPendientes.length > 0) && (
        <div className={styles.alertaBanda}>
          {alertas.agotados > 0 && (
            <div className={`${styles.alertaItem} ${styles.alertaError}`}>
              <AlertTriangle size={15} />
              <span className={styles.alertaTexto}>
                {alertas.agotados} producto{alertas.agotados !== 1 ? "s" : ""} agotado
                {alertas.agotados !== 1 ? "s" : ""} con venta activa.
              </span>
              <Link href="/admin/inventario" className={styles.alertaCTA}>
                Ver inventario <ChevronRight size={11} />
              </Link>
            </div>
          )}
          {cortesPendientes.length > 0 && (
            <div className={`${styles.alertaItem} ${styles.alertaWarning}`}>
              <AlertTriangle size={15} />
              <span className={styles.alertaTexto}>
                {cortesPendientes.length} corte{cortesPendientes.length !== 1 ? "s" : ""} pendiente
                {cortesPendientes.length !== 1 ? "s" : ""} de revisión.
              </span>
              <Link href="/admin/cortes" className={styles.alertaCTA}>
                Revisar <ChevronRight size={11} />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          KPI CARDS — Fila de 4
          ══════════════════════════════════════════ */}
      <div className={styles.kpiGrid}>

        {/* ── 1. Ventas totales (card dark) ── */}
        <div className={`${styles.kpiCard} ${styles.kpiCardDark}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Ventas totales</span>
            <div className={styles.kpiIcono}>
              <DollarSign size={16} />
            </div>
          </div>
          <div className={`${styles.kpiValor} ${totalHoy >= 100_000 ? styles.kpiValorSm : ""}`}>
            {fmt(totalHoy)}
          </div>
          <div className={styles.kpiFooter}>
            <TrendBadge tendencia={tendVentas} dark />
            <Link href="/admin/ventasAdmin" className={styles.kpiLink}>
              Ver ventas <ChevronRight size={11} />
            </Link>
          </div>
        </div>

        {/* ── 2. Transacciones ── */}
        <div className={`${styles.kpiCard} ${styles.kpiCardLight}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Transacciones</span>
            <div className={styles.kpiIcono}>
              <ShoppingCart size={15} />
            </div>
          </div>
          <div className={styles.kpiValor}>{numVentas}</div>
          <div className={styles.kpiFooter}>
            {tendTxns !== null ? (
              <span
                className={`${styles.kpiTrend} ${
                  tendTxns >= 0 ? styles.kpiTrendPos : styles.kpiTrendNeg
                }`}
              >
                {tendTxns >= 0
                  ? <TrendingUp size={10} strokeWidth={2.5} />
                  : <TrendingDown size={10} strokeWidth={2.5} />}
                {tendTxns >= 0 ? "+" : ""}{tendTxns} vs ayer
              </span>
            ) : (
              <span className={styles.kpiTrendNeutral}>
                {numVentas === 1 ? "venta" : "ventas"} hoy
              </span>
            )}
            <Link href="/admin/ventasAdmin" className={styles.kpiLink}>
              Ver todas <ChevronRight size={11} />
            </Link>
          </div>
        </div>

        {/* ── 3. Ticket promedio ── */}
        <div className={`${styles.kpiCard} ${styles.kpiCardLight}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Ticket promedio</span>
            <div className={styles.kpiIcono}>
              <BarChart2 size={15} />
            </div>
          </div>
          <div className={`${styles.kpiValor} ${ticketPromedio >= 10_000 ? styles.kpiValorSm : ""}`}>
            {numVentas > 0 ? fmt(ticketPromedio) : "—"}
          </div>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiTrendNeutral}>
              {numVentas > 0 ? "por transacción" : "sin ventas hoy"}
            </span>
          </div>
        </div>

        {/* ── 4. Efectivo en ventas ── */}
        <div className={`${styles.kpiCard} ${styles.kpiCardLight}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Efectivo en ventas</span>
            <div className={styles.kpiIcono}>
              <Banknote size={15} />
            </div>
          </div>
          <div className={`${styles.kpiValor} ${efectivoHoy >= 100_000 ? styles.kpiValorSm : ""}`}>
            {fmt(efectivoHoy)}
          </div>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiTrendNeutral}>
              {totalHoy > 0
                ? `${((efectivoHoy / totalHoy) * 100).toFixed(0)}% del total`
                : "excluye tarjeta y QR"}
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MAIN GRID — Left col + Right sidebar
          ══════════════════════════════════════════ */}
      <div className={styles.mainGrid}>

        {/* ─── LEFT COL ─── */}
        <div className={styles.leftCol}>

          {/* Tendencia 7 días */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardTitulo}>Tendencia de ventas</p>
                <p className={styles.cardSub}>Últimos 7 días · todas las transacciones</p>
              </div>
              <div className={styles.chartLeyenda}>
                <div className={styles.leyendaItem}>
                  <div className={styles.leyendaDot} style={{ background: "#628321" }} />
                  Ventas
                </div>
                <div className={styles.leyendaItem}>
                  <div className={styles.leyendaDot} style={{ background: "var(--color-primary-50)", border: "1px solid var(--color-primary-light)" }} />
                  Hoy
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={tendencia} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#628321" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#628321" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill:       "var(--gray)",
                    fontSize:   11,
                    fontWeight: 600,
                    fontFamily: "var(--font-family)",
                  }}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border-default)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#628321"
                  strokeWidth={2.5}
                  fill="url(#areaGradient)"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (payload.esHoy) {
                      return (
                        <circle
                          key={`dot-${cx}-${cy}`}
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill="#628321"
                          stroke="white"
                          strokeWidth={2}
                        />
                      );
                    }
                    return (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={3}
                        fill="#628321"
                        stroke="white"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  activeDot={{ r: 6, fill: "#628321", stroke: "white", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Métodos de pago */}
          {desglosePagos.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <p className={styles.cardTitulo}>Distribución por método de pago</p>
                <Link href="/admin/ventasAdmin" className={styles.seccionLink}>
                  Ver ventas <ChevronRight size={12} />
                </Link>
              </div>
              <div className={styles.metodosLista}>
                {desglosePagos.map((m) => (
                  <div key={m.eCodPay} className={styles.metodoFila}>
                    <div className={styles.metodoLeft}>
                      <div className={styles.metodoIcono}>
                        <IconoMetodo nombre={m.icono} />
                      </div>
                      <span className={styles.metodoNombre}>{m.nombre}</span>
                    </div>
                    <div className={styles.metodoBarra}>
                      <div
                        className={styles.metodoBarraFill}
                        style={{ width: `${m.porcentaje}%` }}
                      />
                    </div>
                    <div className={styles.metodoRight}>
                      <span className={styles.metodoMonto}>{fmtFull(m.total)}</span>
                      <span className={styles.metodoPct}>{m.porcentaje.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top productos vendidos hoy */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardTitulo}>Productos más vendidos</p>
                <p className={styles.cardSub}>Por unidades vendidas hoy</p>
              </div>
              <Link href="/admin/ventasAdmin" className={styles.seccionLink}>
                Ver ventas <ChevronRight size={12} />
              </Link>
            </div>

            {topProductos.length === 0 ? (
              <div className={styles.topProductosVacio}>
                <Package size={20} strokeWidth={1.5} />
                <span>Sin ventas registradas hoy</span>
              </div>
            ) : (
              <div className={styles.topProductosList}>
                {topProductos.map((producto, idx) => (
                  <div key={producto.eCodProduct} className={styles.topProductoItem}>
                    {/* Posición */}
                    <span className={`${styles.topProductoRank} ${idx === 0 ? styles.topProductoRankPrimero : ""}`}>
                      {idx + 1}
                    </span>

                    {/* Imagen / fallback */}
                    <div className={styles.topProductoImg}>
                      {producto.ImgProduct ? (
                        <img
                          src={producto.ImgProduct}
                          alt={producto.tNameProduct}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <span className={styles.topProductoImgFallback}>
                          {producto.tNameProduct.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Nombre + categoría */}
                    <div className={styles.topProductoInfo}>
                      <p className={styles.topProductoNombre}>{producto.tNameProduct}</p>
                      {producto.categoria && (
                        <p className={styles.topProductoCategoria}>{producto.categoria}</p>
                      )}
                    </div>

                    {/* Stats: revenue + unidades */}
                    <div className={styles.topProductoStats}>
                      <span className={styles.topProductoRevenue}>
                        {fmtFull(producto.totalRevenue)}
                      </span>
                      <span className={styles.topProductoCantidad}>
                        {producto.cantVendida} pza{producto.cantVendida !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR ─── */}
        <div className={styles.rightCol}>

          {/* Turnos activos */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardTitulo}>
                  Turnos activos
                </p>
                <p className={styles.cardSub}>
                  {turnosAbiertos.length === 0
                    ? "Sin turnos en curso"
                    : `${turnosAbiertos.length} en curso ahora`}
                </p>
              </div>
              <Link href="/admin/cortes" className={styles.seccionLink}>
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>

            {turnosAbiertos.length === 0 ? (
              <div className={styles.turnosVacio}>
                <Users size={22} strokeWidth={1.5} />
                <span>Ningún empleado tiene turno abierto</span>
              </div>
            ) : (
              <div className={styles.turnosList}>
                {turnosAbiertos.map((turno) => {
                  const nombre = turno.empleado?.tNameUser ?? "Empleado";
                  return (
                    <div key={turno.eCodCorte} className={styles.turnoItem}>
                      <div className={styles.turnoIndicadorDot} />
                      <div className={styles.turnoAvatar}>
                        {iniciales(nombre)}
                      </div>
                      <div className={styles.turnoInfo}>
                        <p className={styles.turnoNombre}>{nombre}</p>
                        <p className={styles.turnoMeta}>
                          <Clock
                            size={9}
                            style={{ display: "inline", marginRight: 3 }}
                          />
                          {formatDuracion(turno.fhInicioTurno)} ·{" "}
                          {turno.ventasTurno.count} venta
                          {turno.ventasTurno.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className={styles.turnoTotal}>
                        <span className={styles.turnoTotalValor}>
                          {fmt(turno.ventasTurno.total)}
                        </span>
                        <span className={styles.turnoTotalVentas}>en turno</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inventario */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitulo}>Inventario</p>
              <Link href="/admin/inventario" className={styles.seccionLink}>
                Ver todo <ChevronRight size={12} />
              </Link>
            </div>

            <div className={styles.inventarioGrid}>
              <Link
                href="/admin/inventario"
                className={`${styles.inventarioAlerta} ${
                  alertas.agotados > 0
                    ? styles.inventarioAlertaError
                    : styles.inventarioAlertaOk
                }`}
              >
                <span className={styles.inventarioNum}>{alertas.agotados}</span>
                <span className={styles.inventarioEtiqueta}>
                  {alertas.agotados === 0 ? "Sin agotados" : "Agotados"}
                </span>
                <span className={styles.inventarioSub}>
                  {alertas.agotados === 0
                    ? "Todo con stock"
                    : "En menú activo"}
                </span>
              </Link>

              <Link
                href="/admin/inventario"
                className={`${styles.inventarioAlerta} ${
                  alertas.stockBajo > 0
                    ? styles.inventarioAlertaWarning
                    : styles.inventarioAlertaOk
                }`}
              >
                <span className={styles.inventarioNum}>{alertas.stockBajo}</span>
                <span className={styles.inventarioEtiqueta}>
                  {alertas.stockBajo === 0 ? "Stock OK" : "Stock bajo"}
                </span>
                <span className={styles.inventarioSub}>
                  {alertas.stockBajo === 0
                    ? "Todos sobre mínimo"
                    : "Cerca del mínimo"}
                </span>
              </Link>
            </div>

            <Link href="/admin/inventario" className={styles.inventarioLinkFull}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Package size={13} />
                Ver inventario completo
              </span>
              <ChevronRight size={12} />
            </Link>
          </div>

          {/* Cortes pendientes (solo si hay) */}
          {cortesPendientes.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.cardTitulo}>Cortes pendientes</p>
                  <p className={styles.cardSub}>Requieren revisión</p>
                </div>
                <Link href="/admin/cortes" className={styles.seccionLink}>
                  Ver todos <ChevronRight size={12} />
                </Link>
              </div>

              <div className={styles.cortesList}>
                {cortesPendientes.map((corte) => {
                  const nombre  = corte.empleado?.tNameUser ?? "Empleado";
                  const dif     = corte.eDiferencia ?? 0;
                  const difCls  =
                    dif < 0 ? styles.corteDifFaltante :
                    dif > 0 ? styles.corteDifSobrante :
                               styles.corteDifOk;

                  return (
                    <div key={corte.eCodCorte} className={styles.corteItem}>
                      <div className={styles.corteAvatar}>
                        {iniciales(nombre)}
                      </div>
                      <div className={styles.corteInfo}>
                        <p className={styles.corteNombre}>{nombre}</p>
                        <p className={styles.corteMeta}>
                          {corte.fhCierreTurno
                            ? formatRelativo(corte.fhCierreTurno)
                            : "—"}
                        </p>
                      </div>
                      <span className={`${styles.corteDif} ${difCls}`}>
                        {dif === 0
                          ? "OK"
                          : `${dif > 0 ? "+" : ""}${fmtFull(dif)}`}
                      </span>
                      <Link href="/admin/cortes" className={styles.corteBtn}>
                        Revisar
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
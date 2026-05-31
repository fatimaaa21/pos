"use client";

import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import {
  Building2, Users, CreditCard, TrendingUp,
  TrendingDown, ChevronRight, CircleDollarSign,
} from "lucide-react";
import * as Icons from "lucide-react";
import { formatRelativo } from "@/lib/utils/fecha";
import styles from "./sistemasDashboard.module.css";

// ── Tipos exportados ───────────────────────────────────────────────────────

export interface NegocioSistemas {
  eCodCompany:     string;
  tNameCompany:    string;
  imgCompany:      string | null;
  bStateCompany:   string;
  fhCreateCompany: string;
  adminNombre:     string | null;
  totalUsuarios:   number;
}

export interface MetodoPagoSistemas {
  eCodPay:   string;
  tNamePay:  string;
  tIconPay:  string;
  bStatePay: boolean;
}

export interface TendenciaMes {
  label: string;
  count: number;
  esMesActual: boolean;
}

export interface SistemasDashboardClientProps {
  totalNegocios:        number;
  negociosActivos:      number;
  negociosPausados:     number;
  totalUsuarios:        number;
  metodosActivosCount:  number;
  negociosEsteMes:      number;
  negociosMesAnterior:  number;
  negociosRecientes:    NegocioSistemas[];
  topNegociosPorUsuarios: NegocioSistemas[];
  metodosPago:          MetodoPagoSistemas[];
  tendenciaMeses:       TendenciaMes[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getFechaLong(): string {
  return new Date().toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function calcTendencia(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

function iniciales(nombre: string): string {
  return nombre.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function IconoMetodo({ nombre, size = 14 }: { nombre: string; size?: number }) {
  const Icono = (Icons as Record<string, any>)[nombre];
  return Icono ? <Icono size={size} /> : <Icons.CreditCard size={size} />;
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
      <div className={styles.tooltipValor}>
        {payload[0].value} negocio{payload[0].value !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ── Badge de tendencia ─────────────────────────────────────────────────────

function TrendBadge({
  tendencia, dark = false,
}: {
  tendencia: number | null;
  dark?: boolean;
}) {
  if (tendencia === null) {
    return <span className={styles.kpiTrendNeutral}>Sin datos del mes anterior</span>;
  }
  const pos = tendencia >= 0;
  return (
    <span className={`${styles.kpiTrend} ${pos ? styles.kpiTrendPos : ""}`}>
      {pos
        ? <TrendingUp size={10} strokeWidth={2.5} />
        : <TrendingDown size={10} strokeWidth={2.5} />}
      {pos ? "+" : ""}
      {tendencia.toFixed(0)}% vs mes anterior
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════

export function SistemasDashboardClient({
  totalNegocios,
  negociosActivos,
  negociosPausados,
  totalUsuarios,
  metodosActivosCount,
  negociosEsteMes,
  negociosMesAnterior,
  negociosRecientes,
  topNegociosPorUsuarios,
  metodosPago,
  tendenciaMeses,
}: SistemasDashboardClientProps) {

  const tendNegocios = calcTendencia(negociosEsteMes, negociosMesAnterior);
  const pctActivos   = totalNegocios > 0
    ? Math.round((negociosActivos / totalNegocios) * 100)
    : 0;

  return (
    <div className={styles.dashboard}>

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>¡Hola, Kivi!</h1>
          <p className={styles.pageSub}>{getFechaLong()}</p>
        </div>

        <div className={styles.headerBadges}>
          <span className={styles.headerBadge + " " + styles.headerBadgeGreen}>
            <Building2 size={11} />
            {negociosActivos} negocio{negociosActivos !== 1 ? "s" : ""} activo{negociosActivos !== 1 ? "s" : ""}
          </span>
          <span className={styles.headerBadge + " " + styles.headerBadgeBlue}>
            <Users size={11} />
            {totalUsuarios} usuario{totalUsuarios !== 1 ? "s" : ""} en la plataforma
          </span>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          KPI CARDS
          ══════════════════════════════════════════ */}
      <div className={styles.kpiGrid}>

        {/* ── 1. Total negocios (dark) ── */}
        <div className={`${styles.kpiCard} ${styles.kpiCardDark}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Total negocios</span>
            <div className={styles.kpiIcono}>
              <Building2 size={16} />
            </div>
          </div>
          <div className={styles.kpiValor}>{totalNegocios}</div>
          <div className={styles.kpiFooter}>
            <TrendBadge tendencia={tendNegocios} dark />
            <Link href="/sistemas/negocios" className={styles.kpiLink}>
              Ver todos <ChevronRight size={11} />
            </Link>
          </div>
        </div>

        {/* ── 2. Activos ── */}
        <div className={`${styles.kpiCard} ${styles.kpiCardLight}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Negocios activos</span>
            <div className={styles.kpiIcono}>
              <TrendingUp size={15} />
            </div>
          </div>
          <div className={styles.kpiValor}>{negociosActivos}</div>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiTrendNeutral}>
              {pctActivos}% del total
            </span>
            <Link href="/sistemas/negocios" className={styles.kpiLink}>
              Gestionar <ChevronRight size={11} />
            </Link>
          </div>
        </div>

        {/* ── 3. Total usuarios ── */}
        <div className={`${styles.kpiCard} ${styles.kpiCardLight}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Usuarios totales</span>
            <div className={styles.kpiIcono}>
              <Users size={15} />
            </div>
          </div>
          <div className={styles.kpiValor}>{totalUsuarios}</div>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiTrendNeutral}>
              Admins y empleados
            </span>
          </div>
        </div>

        {/* ── 4. Métodos de pago activos ── */}
        <div className={`${styles.kpiCard} ${styles.kpiCardLight}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Métodos de pago</span>
            <div className={styles.kpiIcono}>
              <CircleDollarSign size={15} />
            </div>
          </div>
          <div className={styles.kpiValor}>{metodosActivosCount}</div>
          <div className={styles.kpiFooter}>
            <span className={styles.kpiTrendNeutral}>
              activo{metodosActivosCount !== 1 ? "s" : ""} de {metodosPago.length} total
            </span>
            <Link href="/sistemas/metodosPago" className={styles.kpiLink}>
              Configurar <ChevronRight size={11} />
            </Link>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          MAIN GRID — Left + Right sidebar
          ══════════════════════════════════════════ */}
      <div className={styles.mainGrid}>

        {/* ─── LEFT COL ─── */}
        <div className={styles.leftCol}>

          {/* Gráfica: crecimiento por mes */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardTitulo}>Nuevos negocios por mes</p>
                <p className={styles.cardSub}>
                  Últimos 6 meses ·{" "}
                  {negociosEsteMes > 0
                    ? `${negociosEsteMes} ingresado${negociosEsteMes !== 1 ? "s" : ""} este mes`
                    : "Sin altas este mes"}
                </p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={tendenciaMeses}
                margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                barCategoryGap="35%"
              >
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
                <YAxis
                  hide
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-primary-50)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {tendenciaMeses.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={
                        entry.esMesActual
                          ? "#628321"
                          : "var(--color-primary-light)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Lista de negocios recientes */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardTitulo}>Negocios recientes</p>
                <p className={styles.cardSub}>Últimos registrados en la plataforma</p>
              </div>
              <Link href="/sistemas/negocios" className={styles.seccionLink}>
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>

            {negociosRecientes.length === 0 ? (
              <div className={styles.empty}>
                <Building2 size={20} strokeWidth={1.5} />
                <span>Sin negocios registrados</span>
              </div>
            ) : (
              <div className={styles.negociosList}>
                {negociosRecientes.map((negocio) => {
                  const inics = iniciales(negocio.tNameCompany);
                  const activo = negocio.bStateCompany === "activo";
                  return (
                    <div key={negocio.eCodCompany} className={styles.negocioItem}>

                      {/* Logo */}
                      <div className={styles.negocioLogo}>
                        {negocio.imgCompany ? (
                          <img
                            src={negocio.imgCompany}
                            alt={negocio.tNameCompany}
                            className={styles.negocioLogoImg}
                          />
                        ) : (
                          <div className={styles.negocioLogoFallback}>{inics}</div>
                        )}
                      </div>

                      {/* Info */}
                      <div className={styles.negocioInfo}>
                        <p className={styles.negocioNombre}>{negocio.tNameCompany}</p>
                        <p className={styles.negocioAdmin}>
                          {negocio.adminNombre ?? "Sin administrador"}
                        </p>
                      </div>

                      {/* Stats */}
                      <div className={styles.negocioRight}>
                        <span className={styles.negocioFecha}>
                          {formatRelativo(negocio.fhCreateCompany)}
                        </span>
                        <span className={styles.negocioUsuarios}>
                          <Users size={11} />
                          {negocio.totalUsuarios}
                        </span>
                        <span
                          className={`${styles.negocioBadge} ${
                            activo
                              ? styles.negocioBadgeActivo
                              : styles.negocioBadgePausado
                          }`}
                        >
                          {activo ? "Activo" : "Pausado"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR ─── */}
        <div className={styles.rightCol}>

          {/* Salud de la plataforma */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <p className={styles.cardTitulo}>Estado de la plataforma</p>
            </div>

            <div className={styles.saludGrid}>
              <div className={`${styles.saludBox} ${styles.saludBoxActivo}`}>
                <span className={styles.saludNum}>{negociosActivos}</span>
                <span className={styles.saludLabel}>Activos</span>
                <span className={styles.saludPct}>{pctActivos}% del total</span>
              </div>
              <div className={`${styles.saludBox} ${styles.saludBoxPausado}`}>
                <span className={styles.saludNum}>{negociosPausados}</span>
                <span className={styles.saludLabel}>Pausados</span>
                <span className={styles.saludPct}>
                  {totalNegocios > 0
                    ? Math.round((negociosPausados / totalNegocios) * 100)
                    : 0}% del total
                </span>
              </div>
            </div>

            {/* Barra visual */}
            <div className={styles.distBarra}>
              <div
                className={styles.distBarraFill}
                style={{ width: `${pctActivos}%` }}
              />
            </div>
            <div className={styles.distLabel}>
              <span>Activos</span>
              <span>Pausados</span>
            </div>
          </div>

          {/* Top negocios por usuarios */}
          {topNegociosPorUsuarios.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.cardTitulo}>Negocios con más usuarios</p>
                  <p className={styles.cardSub}>Por número de miembros</p>
                </div>
                <Link href="/sistemas/negocios" className={styles.seccionLink}>
                  Ver <ChevronRight size={12} />
                </Link>
              </div>
              <div className={styles.topList}>
                {topNegociosPorUsuarios.map((n, idx) => {
                  const inics = iniciales(n.tNameCompany);
                  return (
                    <div key={n.eCodCompany} className={styles.topItem}>
                      <span className={`${styles.topRank} ${idx === 0 ? styles.topRankPrimero : ""}`}>
                        {idx + 1}
                      </span>
                      <div className={styles.topLogo}>
                        {n.imgCompany ? (
                          <img
                            src={n.imgCompany}
                            alt={n.tNameCompany}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          <div className={styles.topLogoFallback}>{inics}</div>
                        )}
                      </div>
                      <span className={styles.topNombre}>{n.tNameCompany}</span>
                      <span className={styles.topUsuarios}>
                        <Users size={11} />
                        {n.totalUsuarios}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Métodos de pago configurados */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardTitulo}>Métodos de pago</p>
                <p className={styles.cardSub}>Catálogo global de la plataforma</p>
              </div>
              <Link href="/sistemas/metodosPago" className={styles.seccionLink}>
                Editar <ChevronRight size={12} />
              </Link>
            </div>

            {metodosPago.length === 0 ? (
              <div className={styles.empty}>
                <CreditCard size={20} strokeWidth={1.5} />
                <span>Sin métodos configurados</span>
              </div>
            ) : (
              <div className={styles.metodosList}>
                {metodosPago.map((m) => (
                  <div key={m.eCodPay} className={styles.metodoItem}>
                    <div
                      className={`${styles.metodoIcono} ${
                        m.bStatePay
                          ? styles.metodoIconoActivo
                          : styles.metodoIconoInactivo
                      }`}
                    >
                      <IconoMetodo nombre={m.tIconPay} />
                    </div>
                    <span className={styles.metodoNombre}>{m.tNamePay}</span>
                    <span
                      className={`${styles.metodoEstado} ${
                        m.bStatePay
                          ? styles.metodoEstadoActivo
                          : styles.metodoEstadoInactivo
                      }`}
                    >
                      {m.bStatePay ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
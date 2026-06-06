"use client";
// src/app/admin/ventasAdmin/ventasAdminClient.tsx

import { useState, useMemo }         from "react";
import { Eye, XCircle }              from "lucide-react";
import * as Icons                    from "lucide-react";
import { PageHeader }                from "@/components/ui/PageHeader";
import { StatCards }                 from "@/components/ui/Statscards";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { formatFechaHora }           from "@/lib/utils/fecha";
import { ModalVerVenta }             from "./ModalVerVenta";
import { ModalCancelarVenta }        from "@/components/ui/ModalCancelarVenta/ModalCancelarVenta";
import { cancelarVenta }             from "@/lib/actions/ventas";
import type { DetalleVentaConProducto } from "@/types";
import type { MetodoPagoGlobal }     from "@/lib/actions/metodos-pago";
import styles                        from "./ventasAdmin.module.css";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface VentaAdmin {
  eCodVenta:            string;
  eTotal:               number;
  fkeMetodoPago:        string;
  fhCreateVenta:        string;
  fkeCodUser:           string;
  // Cancelación
  bCancelada?:          boolean;
  tMotivoCancelacion?:  string | null;
  fhCancelacion?:       string | null;
  // Relaciones
  empleado?: { eCodUser: string; tNameUser: string } | null;
  detalle_venta: DetalleVentaConProducto[];
}

interface Props {
  ventas:      VentaAdmin[];
  empleados:   { id: string; nombre: string }[];
  metodosPago: MetodoPagoGlobal[];
  aplicarIva:  boolean;
}

// ── Badge de método de pago ───────────────────────────────────────────────────

function MetodoBadge({
  eCodPay,
  metodosPago,
}: {
  eCodPay:     string;
  metodosPago: MetodoPagoGlobal[];
}) {
  const metodo = metodosPago.find((m) => m.eCodPay === eCodPay);
  if (!metodo) return <span style={{ color: "var(--gray)", fontSize: 13 }}>—</span>;
  return <span>{metodo.tNamePay}</span>;
}

// ── Filtro de periodo ─────────────────────────────────────────────────────────

function estaEnPeriodo(fechaISO: string, periodo: string): boolean {
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
    const inicioDia = new Date(ahora);
    inicioDia.setHours(0, 0, 0, 0);
    inicioDia.setDate(inicioDia.getDate() - 7);
    return d >= inicioDia;
  }
  if (periodo === "mes") {
    return (
      d.getMonth()    === ahora.getMonth() &&
      d.getFullYear() === ahora.getFullYear()
    );
  }
  return true;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VentasAdminClient({ ventas, empleados, metodosPago, aplicarIva }: Props) {
  const [filtros,       setFiltros]       = useState<FiltrosUsuario>({
    busqueda: "", roles: [], estados: [], periodo: "hoy",
    metodo: "todos", empleado: "todos",
  });
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [ventaVer,      setVentaVer]      = useState<VentaAdmin | null>(null);
  const [ventaCancelar, setVentaCancelar] = useState<VentaAdmin | null>(null);

  const opcionesMetodo = useMemo(() => [
    { value: "todos", label: "Todos" },
    ...metodosPago.map((m) => ({ value: m.eCodPay, label: m.tNamePay })),
  ], [metodosPago]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    return ventas.filter((v) => {
      const coincidePeriodo  = estaEnPeriodo(v.fhCreateVenta, filtros.periodo ?? "hoy");
      const coincideMetodo   = !filtros.metodo || filtros.metodo === "todos"
        || v.fkeMetodoPago === filtros.metodo;
      const coincideEmpleado = !filtros.empleado || filtros.empleado === "todos"
        || v.fkeCodUser === filtros.empleado;

      const folio = v.eCodVenta.slice(-8).toUpperCase();
      const coincideBusqueda =
        !filtros.busqueda ||
        folio.includes(filtros.busqueda.toUpperCase()) ||
        (v.empleado?.tNameUser ?? "").toLowerCase().includes(filtros.busqueda.toLowerCase()) ||
        v.detalle_venta.some(
          (d) => d.producto?.tNameProduct.toLowerCase().includes(filtros.busqueda.toLowerCase())
        );

      return coincidePeriodo && coincideMetodo && coincideEmpleado && coincideBusqueda;
    });
  }, [ventas, filtros]);

  // Stats: excluir canceladas del total monetario
  const ventasActivas  = filtradas.filter((v) => !v.bCancelada);
  const totalFiltrado  = ventasActivas.reduce((acc, v) => acc + v.eTotal, 0);
  const totalPiezas    = ventasActivas.reduce(
    (acc, v) => acc + v.detalle_venta.reduce((s, d) => s + d.eCantidad, 0), 0
  );
  const ticketPromedio = ventasActivas.length > 0 ? totalFiltrado / ventasActivas.length : 0;
  const totalCanceladas = filtradas.filter((v) => v.bCancelada).length;

  // ── Cancelar venta ────────────────────────────────────────────────────────
  async function handleCancelar(motivo: string) {
    if (!ventaCancelar) return;
    const fd = new FormData();
    fd.append("eCodVenta",          ventaCancelar.eCodVenta);
    fd.append("tMotivoCancelacion", motivo);
    const result = await cancelarVenta(fd);
    if (!result.error) setVentaCancelar(null);
    return result;
  }

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<VentaAdmin>[] = [
    {
      key: "eCodVenta",
      label: "Folio",
      render: (v) => (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ opacity: v.bCancelada ? 0.45 : 1 }}>
            # {v.eCodVenta.slice(-8).toUpperCase()}
          </span>
          {v.bCancelada && (
            <span className={styles.badgeCancelada}>Cancelada</span>
          )}
        </div>
      ),
    },
    {
      key: "empleado",
      label: "Empleado",
      render: (v) => (
        <span style={{ opacity: v.bCancelada ? 0.45 : 1 }}>
          {v.empleado?.tNameUser ?? "—"}
        </span>
      ),
    },
    {
      key: "detalle_venta",
      label: "Productos",
      render: (v) => {
        const total  = v.detalle_venta.length;
        const piezas = v.detalle_venta.reduce((s, d) => s + d.eCantidad, 0);
        return (
          <span style={{ opacity: v.bCancelada ? 0.45 : 1 }}>
            {total} tipo{total !== 1 ? "s" : ""} · {piezas} pza{piezas !== 1 ? "s" : ""}
          </span>
        );
      },
    },
    {
      key: "fkeMetodoPago",
      label: "Método de pago",
      render: (v) => (
        <span style={{ opacity: v.bCancelada ? 0.45 : 1 }}>
          <MetodoBadge eCodPay={v.fkeMetodoPago} metodosPago={metodosPago} />
        </span>
      ),
    },
    {
      key: "eTotal",
      label: "Total",
      render: (v) => (
        <span style={{
          opacity:         v.bCancelada ? 0.45 : 1,
          textDecoration:  v.bCancelada ? "line-through" : "none",
          color:           v.bCancelada ? "var(--gray)" : "inherit",
        }}>
          ${v.eTotal.toFixed(2)}
        </span>
      ),
    },
    {
      key: "fhCreateVenta",
      label: "Fecha",
      render: (v) => (
        <span style={{ opacity: v.bCancelada ? 0.45 : 1 }}>
          {formatFechaHora(v.fhCreateVenta)}
        </span>
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (v) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button
            className={styles.actionBtn}
            onClick={() => setVentaVer(v)}
            title="Ver detalle"
          >
            <Eye size={18} />
          </button>
          {!v.bCancelada && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => setVentaCancelar(v)}
              title="Cancelar venta"
            >
              <XCircle size={18} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <PageHeader
        titulo="Ventas"
        descripcion="Historial de ventas del negocio"
      />

      <StatCards stats={[
        { label: "Ventas en periodo",  value: ventasActivas.length,                                                            variante: "primary" },
        { label: "Total facturado",    value: `$${totalFiltrado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,       variante: "success" },
        { label: "Piezas vendidas",    value: totalPiezas,                                                                     variante: "accent"  },
        { label: "Ticket promedio",    value: `$${ticketPromedio.toFixed(2)}`,                                                 variante: "neutral" },
        ...(totalCanceladas > 0
          ? [{ label: "Canceladas", value: totalCanceladas, variante: "error" as const }]
          : []),
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtradas.length}
        ocultarRol
        ocultarEstado
        mostrarPeriodo
        opcionesMetodo={opcionesMetodo}
        empleados={empleados}
      />

      <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(v) => v.eCodVenta}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No hay ventas en este periodo"
      />

      {ventaVer && (
        <ModalVerVenta
          venta={ventaVer}
          metodosPago={metodosPago}
          aplicarIva={aplicarIva}
          onClose={() => setVentaVer(null)}
        />
      )}

      {ventaCancelar && (
        <ModalCancelarVenta
          folio={ventaCancelar.eCodVenta.slice(-8).toUpperCase()}
          total={ventaCancelar.eTotal}
          onConfirmar={handleCancelar}
          onCerrar={() => setVentaCancelar(null)}
        />
      )}
    </div>
  );
}
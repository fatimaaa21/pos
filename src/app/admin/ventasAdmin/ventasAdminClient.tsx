"use client";

import { useState, useMemo } from "react";
import { Eye } from "lucide-react";
import { PageHeader }   from "@/components/ui/PageHeader";
import { StatCards }    from "@/components/ui/Statscards";
import { Buscador }     from "@/components/ui/Buscador";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { formatFechaHora } from "@/lib/utils/fecha";
import { ModalVerVenta }   from "./ModalVerVenta";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import styles from "./ventasAdmin.module.css";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface DetalleVenta {
  eCodDetalle:     string;
  fkeCodVenta:     string;
  fkeCodProduct:   string;
  eCantidad:       number;
  ePrecioUnitario: number;
  eSubtotal:       number;
  producto?: { tNameProduct: string; ImgProduct?: string } | null;
}

export interface VentaAdmin {
  eCodVenta:     string;
  eTotal:        number;
  fkeMetodoPago:   string;   // eCodPay del método
  fhCreateVenta: string;
  fkeCodUser:    string;
  empleado?: { eCodUser: string; tNameUser: string } | null;
  detalle_venta: DetalleVenta[];
}

interface Props {
  ventas:      VentaAdmin[];
  empleados:   { id: string; nombre: string }[];
  metodosPago: MetodoPagoGlobal[];
}

// ── Helper: resolver método desde eCodPay ─────────────────────────────────────

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

// ── Filtros de periodo ────────────────────────────────────────────────────────

function estaEnPeriodo(fechaISO: string, periodo: string): boolean {
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

export function VentasAdminClient({ ventas, empleados, metodosPago }: Props) {
  const [busqueda,      setBusqueda]      = useState("");
  const [filtros,       setFiltros]       = useState<FiltrosUsuario>({
    busqueda:  "",
    roles:     [],
    estados:   [],
    periodo:   "hoy",
    metodo:    "todos",
    empleado:  "todos",
  });
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [ventaVer,      setVentaVer]      = useState<VentaAdmin | null>(null);

  // Opciones de método para el toolbar — dinámicas desde el catálogo
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

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalFiltrado  = filtradas.reduce((acc, v) => acc + v.eTotal, 0);
  const totalPiezas    = filtradas.reduce(
    (acc, v) => acc + v.detalle_venta.reduce((s, d) => s + d.eCantidad, 0), 0
  );
  const ticketPromedio = filtradas.length > 0 ? totalFiltrado / filtradas.length : 0;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<VentaAdmin>[] = [
    {
      key: "eCodVenta",
      label: "Folio",
      render: (v) => <span># {v.eCodVenta.slice(-8).toUpperCase()}</span>,
    },
    {
      key: "empleado",
      label: "Empleado",
      render: (v) => <span>{v.empleado?.tNameUser ?? "—"}</span>,
    },
    {
      key: "detalle_venta",
      label: "Productos",
      render: (v) => {
        const total  = v.detalle_venta.length;
        const piezas = v.detalle_venta.reduce((s, d) => s + d.eCantidad, 0);
        return (
          <span>
            {total} tipo{total !== 1 ? "s" : ""} · {piezas} pza{piezas !== 1 ? "s" : ""}
          </span>
        );
      },
    },
    {
      key: "fkeMetodoPago",
      label: "Método de pago",
      render: (v) => (
        <MetodoBadge eCodPay={v.fkeMetodoPago} metodosPago={metodosPago} />
      ),
    },
    {
      key: "eTotal",
      label: "Total",
      render: (v) => <span>${v.eTotal.toFixed(2)}</span>,
    },
    {
      key: "fhCreateVenta",
      label: "Fecha",
      render: (v) => <span>{formatFechaHora(v.fhCreateVenta)}</span>,
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (v) => (
        <button
          className={styles.actionBtn}
          onClick={() => setVentaVer(v)}
          title="Ver detalle"
        >
          <Eye size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="container">
      <div className="header">
        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar folio, empleado o producto..."
        />
      </div>

      <PageHeader
        titulo="Ventas"
        descripcion="Historial de ventas del negocio"
      />

      <StatCards stats={[
        { label: "Ventas en periodo", value: filtradas.length,                                                           variante: "primary" },
        { label: "Total facturado",   value: `$${totalFiltrado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`, variante: "success" },
        { label: "Piezas vendidas",   value: totalPiezas,                                                                variante: "accent"  },
        { label: "Ticket promedio",   value: `$${ticketPromedio.toFixed(2)}`,                                            variante: "neutral" },
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
          onClose={() => setVentaVer(null)}
        />
      )}
    </div>
  );
}
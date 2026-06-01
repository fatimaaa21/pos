"use client";

import { useState, useMemo } from "react";
import { Eye }               from "lucide-react";
import { PageHeader }        from "@/components/ui/PageHeader";
import { StatCards }         from "@/components/ui/Statscards";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge }             from "@/components/ui/Badge";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { formatFechaHora }   from "@/lib/utils/fecha";
import { ModalRevisarCorte } from "./ModalRevisarCorte";
import type { CorteCaja }    from "@/types";
import styles                from "./cortes.module.css";

export interface CorteConEmpleado extends CorteCaja {
  empleado?: { eCodUser: string; tNameUser: string } | null;
}

interface Props {
  cortes: CorteConEmpleado[];
}

// ── Configuración de estados del corte ───────────────────────────────────────
const ESTADO_CONFIG = {
  abierto:    { label: "En turno",   variante: "admin"     },
  pendiente:  { label: "Pendiente",  variante: "pendiente" },
  aprobado:   { label: "Aprobado",   variante: "activo"    },
  diferencia: { label: "Diferencia", variante: "error"     },
} as const;

// Opciones para el filtro de estado (slot opcionesMetodo del Toolbar)
const OPCIONES_ESTADO_CORTE = [
  { value: "todos",       label: "Todos"           },
  { value: "abierto",     label: "En turno"        },
  { value: "pendiente",   label: "Pendiente"       },
  { value: "aprobado",    label: "Aprobado"        },
  { value: "diferencia",  label: "Con diferencia"  },
];

// Opciones para el filtro de diferencia (slot opcionesCategorias del Toolbar,
// reutilizado como multi-select de tipo de diferencia)
const OPCIONES_DIFERENCIA = [
  { value: "faltante",        label: "Faltante"        },
  { value: "sin_diferencia",  label: "Sin diferencia"  },
  { value: "sobrante",        label: "Sobrante"        },
];

// ── Helper: período ───────────────────────────────────────────────────────────
function estaEnPeriodo(fechaISO: string | null | undefined, periodo: string): boolean {
  if (!fechaISO || periodo === "todo") return true;
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
    return (
      d.getMonth()    === ahora.getMonth() &&
      d.getFullYear() === ahora.getFullYear()
    );
  }
  return true;
}

// ── Helper: clasifica la diferencia de un corte ───────────────────────────────
function clasificarDiferencia(c: CorteConEmpleado): string {
  if (c.eDiferencia == null) return "sin_diferencia";
  if (c.eDiferencia < 0) return "faltante";
  if (c.eDiferencia > 0) return "sobrante";
  return "sin_diferencia";
}

export function CortesAdminClient({ cortes: inicial }: Props) {
  const [cortes,        setCortes]       = useState<CorteConEmpleado[]>(inicial);
  const [corteVer,      setCorteVer]     = useState<CorteConEmpleado | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  // metodo    → estado del corte (abierto/pendiente/aprobado/diferencia/todos)
  // empleado  → eCodUser del empleado ("todos" = sin restricción)
  // periodo   → fecha de inicio del turno
  // categorias → tipo de diferencia (faltante/sin_diferencia/sobrante)
  //              reutilizamos el multi-select de categorías del Toolbar
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda:   "",
    roles:      [],
    estados:    [],
    periodo:    "todo",
    metodo:     "todos",
    empleado:   "todos",
    categorias: [],          // ← tipo de diferencia
  });

  // ── Lista de empleados únicos para el selector ────────────────────────────
  const empleadosUnicos = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of cortes) {
      if (c.empleado && !mapa.has(c.empleado.eCodUser)) {
        mapa.set(c.empleado.eCodUser, c.empleado.tNameUser);
      }
    }
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [cortes]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtrados = useMemo(() => cortes.filter((c) => {
    // 1. Búsqueda de texto: nombre del empleado o nombre del turno
    const texto = filtros.busqueda.toLowerCase().trim();
    const coincideTexto =
      !texto ||
      (c.empleado?.tNameUser ?? "").toLowerCase().includes(texto) ||
      (c.tNombreTurno        ?? "").toLowerCase().includes(texto);

    // 2. Estado del corte (filtros.metodo)
    const filtroEstado = filtros.metodo ?? "todos";
    const coincideEstado =
      filtroEstado === "todos" || c.bStateCorte === filtroEstado;

    // 3. Empleado específico (filtros.empleado)
    const coincideEmpleado =
      !filtros.empleado ||
      filtros.empleado === "todos" ||
      c.fkeCodUser === filtros.empleado;

    // 4. Período: filtra por fecha de inicio del turno
    const coincidePeriodo = estaEnPeriodo(c.fhInicioTurno, filtros.periodo ?? "todo");

    // 5. Tipo de diferencia (filtros.categorias — multi-select reutilizado)
    const filtrosDif = filtros.categorias ?? [];
    const coincideDiferencia =
      filtrosDif.length === 0 || filtrosDif.includes(clasificarDiferencia(c));

    return (
      coincideTexto    &&
      coincideEstado   &&
      coincideEmpleado &&
      coincidePeriodo  &&
      coincideDiferencia
    );
  }), [cortes, filtros]);

  // ── Stats (calculados sobre el total, no sobre los filtrados) ─────────────
  const pendientes  = cortes.filter((c) => c.bStateCorte === "pendiente").length;
  const aprobados   = cortes.filter((c) => c.bStateCorte === "aprobado").length;
  const diferencias = cortes.filter((c) => c.bStateCorte === "diferencia").length;
  const totalRecaudado = cortes
    .filter((c) => ["aprobado", "diferencia"].includes(c.bStateCorte))
    .reduce((acc, c) => acc + (c.eTotalVentas ?? 0), 0);

  // ── Callback al revisar desde el modal ───────────────────────────────────
  function handleCorteRevisado(corteActualizado: CorteCaja) {
    setCortes((prev) =>
      prev.map((c) =>
        c.eCodCorte === corteActualizado.eCodCorte
          ? { ...c, ...corteActualizado }
          : c
      )
    );
    setCorteVer(null);
  }

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<CorteConEmpleado>[] = [
    {
      key: "empleado",
      label: "Empleado",
      render: (c) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            className={styles.avatar}
            style={{
              background: "var(--color-primary-50)",
              color:      "var(--color-primary-dark)",
            }}
          >
            {(c.empleado?.tNameUser ?? "?")[0].toUpperCase()}
          </div>
          <span>{c.empleado?.tNameUser ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "tNombreTurno",
      label: "Turno",
      render: (c) => <span>{c.tNombreTurno ?? "Sin nombre"}</span>,
    },
    {
      key: "fhInicioTurno",
      label: "Inicio",
      render: (c) => <span>{formatFechaHora(c.fhInicioTurno)}</span>,
    },
    {
      key: "fhCierreTurno",
      label: "Cierre",
      render: (c) => (
        <span>{c.fhCierreTurno ? formatFechaHora(c.fhCierreTurno) : "—"}</span>
      ),
    },
    {
      key: "eTotalVentas",
      label: "Total ventas",
      render: (c) => (
        <span>
          {c.eTotalVentas != null
            ? c.eTotalVentas.toLocaleString("es-MX", {
                style:    "currency",
                currency: "MXN",
              })
            : "—"}
        </span>
      ),
    },
    {
      key: "eDiferencia",
      label: "Diferencia",
      render: (c) => {
        if (c.eDiferencia == null) return <span>—</span>;
        const color =
          c.eDiferencia < 0 ? "var(--color-error)"  :
          c.eDiferencia > 0 ? "var(--color-accent)"  :
                               "var(--dark)";
        return (
          <span style={{ color }}>
            {c.eDiferencia.toLocaleString("es-MX", {
              style:    "currency",
              currency: "MXN",
            })}
          </span>
        );
      },
    },
    {
      key: "bStateCorte",
      label: "Estado",
      render: (c) => {
        const cfg = ESTADO_CONFIG[c.bStateCorte as keyof typeof ESTADO_CONFIG];
        if (!cfg) return <Badge variante="inactivo">{c.bStateCorte}</Badge>;
        return <Badge variante={cfg.variante}>{cfg.label}</Badge>;
      },
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (c) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ActionBtn title="Ver detalles" onClick={() => setCorteVer(c)}>
            <Eye size={18} />
          </ActionBtn>
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container">
      <div className="header" />

      <PageHeader
        titulo="Cortes de caja"
        descripcion="Revisión de turnos por empleado"
      />

      <StatCards stats={[
        { label: "Pendientes",     value: pendientes,  variante: "warning" },
        { label: "Aprobados",      value: aprobados,   variante: "success" },
        { label: "Con diferencia", value: diferencias, variante: "error"   },
        {
          label:    "Total recaudado",
          value:    totalRecaudado.toLocaleString("es-MX", {
            style:                 "currency",
            currency:              "MXN",
            minimumFractionDigits: 0,
          }),
          variante: "primary",
        },
      ]} />

      {/*
        TablaToolbar — filtros disponibles:

        busqueda        → nombre del empleado o nombre del turno
        opcionesMetodo  → estado del corte (En turno / Pendiente / Aprobado / Con diferencia)
        empleados       → selector por empleado (generado dinámicamente desde los cortes)
        mostrarPeriodo  → filtra por fecha de INICIO del turno
        opcionesCategorias → tipo de diferencia (Faltante / Sin diferencia / Sobrante),
                             multi-select; solo aplica a cortes cerrados que tengan
                             eDiferencia calculado

        ocultarEstado   → true: los estados activo/inactivo no aplican a cortes
        ocultarRol      → true: no hay roles en esta vista
      */}
      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtrados.length}
        ocultarRol
        ocultarEstado
        mostrarPeriodo
        opcionesMetodo={OPCIONES_ESTADO_CORTE}
        empleados={empleadosUnicos}
        opcionesCategorias={OPCIONES_DIFERENCIA}
      />

      <DataTable
        columnas={columnas}
        datos={filtrados}
        keyExtractor={(c) => c.eCodCorte}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No hay cortes registrados"
      />

      {corteVer && (
        <ModalRevisarCorte
          corte={corteVer}
          onClose={() => setCorteVer(null)}
          onRevisado={handleCorteRevisado}
        />
      )}
    </div>
  );
}

function ActionBtn({
  children, title, onClick, danger, loading,
}: {
  children: React.ReactNode;
  title:    string;
  onClick:  () => void;
  danger?:  boolean;
  loading?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={loading}
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""}`}
    >
      {loading ? "⏳" : children}
    </button>
  );
}
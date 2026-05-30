"use client";

import { useState }          from "react";
import { Eye }               from "lucide-react";
import { PageHeader }        from "@/components/ui/PageHeader";
import { Buscador } from "@/components/ui/Buscador";
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

// Mapeo de estado → variante de Badge válida + etiqueta legible.
// Cada variante tiene su clase CSS definida en Badge.module.css.
const ESTADO_CONFIG = {
  abierto:    { label: "En turno",   variante: "admin"  },  // verde primario
  pendiente:  { label: "Pendiente",  variante: "pendiente" },  // amarillo
  aprobado:   { label: "Aprobado",   variante: "activo"    },  // verde éxito
  diferencia: { label: "Diferencia", variante: "error"     },  // rojo
} as const;

export function CortesAdminClient({ cortes: inicial }: Props) {
  const [cortes, setCortes]         = useState<CorteConEmpleado[]>(inicial);
  const [corteVer, setCorteVer]     = useState<CorteConEmpleado | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [filtros, setFiltros]       = useState<FiltrosUsuario>({
    busqueda: "",
    roles:    [],
    estados:  [],
  });

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtrados = cortes.filter(c => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto =
      !texto ||
      (c.empleado?.tNameUser ?? "").toLowerCase().includes(texto) ||
      (c.tNombreTurno ?? "").toLowerCase().includes(texto);
    return coincideTexto;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const pendientes  = cortes.filter(c => c.bStateCorte === "pendiente").length;
  const aprobados   = cortes.filter(c => c.bStateCorte === "aprobado").length;
  const diferencias = cortes.filter(c => c.bStateCorte === "diferencia").length;
  const totalRecaudado = cortes
    .filter(c => ["aprobado", "diferencia"].includes(c.bStateCorte))
    .reduce((acc, c) => acc + (c.eTotalVentas ?? 0), 0);

  // ── Callback al aprobar/marcar desde el modal ─────────────────────────────
  function handleCorteRevisado(corteActualizado: CorteCaja) {
    setCortes(prev =>
      prev.map(c =>
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
            style={{ background: "var(--color-primary-50)", color: "var(--color-primary-dark)" }}
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
      render: (c) => (
        <span>{c.tNombreTurno ?? "Sin nombre"}</span>
      ),
    },
    {
      key: "fhInicioTurno",
      label: "Inicio",
      render: (c) => <span>{formatFechaHora(c.fhInicioTurno)}</span>,
    },
    {
      key: "fhCierreTurno",
      label: "Cierre",
      render: (c) => <span>{c.fhCierreTurno ? formatFechaHora(c.fhCierreTurno) : "—"}</span>,
    },
    {
      key: "eTotalVentas",
      label: "Total ventas",
      render: (c) => (
        <span>
          {c.eTotalVentas != null
            ? c.eTotalVentas.toLocaleString("es-MX", { style: "currency", currency: "MXN" })
            : "—"}
        </span>
      ),
    },
    {
      key: "eDiferencia",
      label: "Diferencia",
      render: (c) => {
        if (c.eDiferencia == null) return <span>—</span>;
        const color = c.eDiferencia < 0
          ? "var(--color-error)"
          : c.eDiferencia > 0
          ? "var(--color-accent)"
          : "var(--dark)";
        return (
          <span style={{ color }}>
            {c.eDiferencia.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
          </span>
        );
      },
    },
    {
      key: "bStateCorte",
      label: "Estado",
      render: (c) => {
        const cfg = ESTADO_CONFIG[c.bStateCorte as keyof typeof ESTADO_CONFIG];
        // Fallback a inactivo si el estado no está mapeado (no debería ocurrir)
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

  return (
    <div className="container">
        <div className="header">
            <Buscador
                valor={filtros.busqueda}
                onChange={(value) => setFiltros((prev) => ({ ...prev, busqueda: value }))}
                placeholder="Buscar usuario..."
                />
        </div>

      <PageHeader
        titulo="Cortes de caja"
        descripcion="Revisión de turnos por empleado"
      />

      <StatCards stats={[
        { label: "Pendientes",       value: pendientes,    variante: "warning"  },
        { label: "Aprobados",        value: aprobados,     variante: "success"  },
        { label: "Con diferencia",   value: diferencias,   variante: "error"    },
        {
          label: "Total recaudado",
          value: totalRecaudado.toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 0,
          }),
          variante: "primary",
        },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtrados.length}
        ocultarRol
        ocultarEstado
      />

      <DataTable
        columnas={columnas}
        datos={filtrados}
        keyExtractor={c => c.eCodCorte}
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
  title: string;
  onClick: () => void;
  danger?: boolean;
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
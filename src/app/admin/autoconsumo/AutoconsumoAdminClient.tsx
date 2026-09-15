"use client";

import { useMemo, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/Statscards";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { ToastConfirmarEliminar } from "@/components/ui/ToastConfirmarEliminar/ToastConfirmarEliminar";
import { formatFechaHora } from "@/lib/utils/fecha";
import { eliminarAutoconsumo } from "@/lib/actions/autoconsumo";
import type { AutoconsumoAdminRow } from "@/types/autoconsumo";
import { ModalVerAutoconsumo } from "./ModalVerAutoconsumo";
import toast from "react-hot-toast";
import styles from "./autoconsumoAdmin.module.css";

interface Props {
  registros: AutoconsumoAdminRow[];
}

// ── Filtro de periodo — mismo criterio que ventasAdminClient ────────────────
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

export function AutoconsumoAdminClient({ registros: inicial }: Props) {
  const [registros, setRegistros] = useState(inicial);
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "", roles: [], estados: [], periodo: "todo", empleado: "todos",
  });
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [verRegistro, setVerRegistro]      = useState<AutoconsumoAdminRow | null>(null);
  const [eliminarObj, setEliminarObj]      = useState<AutoconsumoAdminRow | null>(null);
  const [eliminando, setEliminando]        = useState<string | null>(null);

  const empleados = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of registros) {
      if (r.empleado) map.set(r.empleado.eCodUser, r.empleado.tNameUser);
    }
    return [...map.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [registros]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    return registros.filter((r) => {
      const coincidePeriodo  = estaEnPeriodo(r.fhCreateAutoconsumo, filtros.periodo ?? "todo");
      const coincideEmpleado = !filtros.empleado || filtros.empleado === "todos"
        || r.empleado?.eCodUser === filtros.empleado;

      const texto = filtros.busqueda.toLowerCase();
      const coincideBusqueda =
        !texto ||
        (r.empleado?.tNameUser ?? "").toLowerCase().includes(texto) ||
        r.items.some((i) => i.tNombreProductoSnapshot.toLowerCase().includes(texto)) ||
        (r.tNota ?? "").toLowerCase().includes(texto);

      return coincidePeriodo && coincideEmpleado && coincideBusqueda;
    });
  }, [registros, filtros]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalUnidades = filtradas.reduce(
    (acc, r) => acc + r.items.reduce((s, i) => s + i.eCantidad, 0), 0
  );
  const valorReferencia = filtradas.reduce(
    (acc, r) => acc + r.items.reduce((s, i) => s + i.ePrecioReferenciaSnapshot * i.eCantidad, 0), 0
  );
  const empleadosActivos = new Set(filtradas.map((r) => r.empleado?.eCodUser).filter(Boolean)).size;

  // ── Eliminar ──────────────────────────────────────────────────────────────
  async function confirmarEliminar() {
    if (!eliminarObj) return;
    setEliminando(eliminarObj.eCodAutoconsumo);
    const result = await eliminarAutoconsumo(eliminarObj.eCodAutoconsumo);
    setEliminando(null);
    if (!result?.error) {
      setRegistros((prev) => prev.filter((r) => r.eCodAutoconsumo !== eliminarObj.eCodAutoconsumo));
      toast.success("Registro eliminado — se restauró el inventario e insumos");
      setEliminarObj(null);
    } else {
      toast.error(result.error);
    }
  }

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<AutoconsumoAdminRow>[] = [
    {
      key: "fhCreateAutoconsumo",
      label: "Fecha",
      render: (r) => <span>{formatFechaHora(r.fhCreateAutoconsumo)}</span>,
    },
    {
      key: "empleado",
      label: "Empleado",
      render: (r) => <span>{r.empleado?.tNameUser ?? "—"}</span>,
    },
    {
      key: "items",
      label: "Productos",
      render: (r) => {
        const tipos   = r.items.length;
        const piezas  = r.items.reduce((s, i) => s + i.eCantidad, 0);
        return (
          <span className={styles.producto}>
            {r.items.map((i, idx) => (
              <span key={idx}>
                {i.eCantidad}× {i.tNombreProductoSnapshot}
                {i.tNombrePresentacionSnapshot ? ` (${i.tNombrePresentacionSnapshot})` : ""}
                {idx < r.items.length - 1 ? ", " : ""}
              </span>
            ))}
            <span className={styles.itemsResumen}> · {tipos} tipo{tipos !== 1 ? "s" : ""}, {piezas} pza{piezas !== 1 ? "s" : ""}</span>
          </span>
        );
      },
    },
    {
      key: "tNota",
      label: "Nota",
      render: (r) => r.tNota
        ? <span className={styles.celdaNota}>{r.tNota}</span>
        : <span className={styles.sinDato}>—</span>,
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (r) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button className={styles.actionBtn} onClick={() => setVerRegistro(r)} title="Ver detalle">
            <Eye size={18} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => setEliminarObj(r)}
            title="Eliminar y restaurar inventario"
          >
            <Trash2 size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <PageHeader
        titulo="Autoconsumo"
        descripcion="Productos que los empleados registraron para consumo propio, descuentan inventario e insumos, no se cobran ni aparecen en ventas"
      />

      <StatCards stats={[
        { label: "Registros",          value: filtradas.length,                                                                       variante: "primary" },
        { label: "Unidades consumidas", value: totalUnidades,                                                                           variante: "accent"  },
        { label: "Valor de referencia", value: `$${valorReferencia.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,             variante: "warning" },
        { label: "Empleados",          value: empleadosActivos,                                                                        variante: "neutral" },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtradas.length}
        ocultarRol
        ocultarEstado
        mostrarPeriodo
        empleados={empleados}
      />

      <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(r) => r.eCodAutoconsumo}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No hay autoconsumo registrado en este periodo"
      />

      {verRegistro && (
        <ModalVerAutoconsumo registro={verRegistro} onClose={() => setVerRegistro(null)} />
      )}

      {eliminarObj && (
        <ToastConfirmarEliminar
          tipo="registro"
          nombre={formatFechaHora(eliminarObj.fhCreateAutoconsumo)}
          advertencia="Se restaurará el inventario y los insumos que se habían descontado."
          onConfirmar={confirmarEliminar}
          onCancelar={() => setEliminarObj(null)}
          cargando={eliminando === eliminarObj.eCodAutoconsumo}
        />
      )}
    </div>
  );
}

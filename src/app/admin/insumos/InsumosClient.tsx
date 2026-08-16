"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2, PlusCircle } from "lucide-react";
import type { InsumoConStock } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import styles from "./insumos.module.css";
import { toggleEstadoInsumo, eliminarInsumo } from "@/lib/actions/insumos";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { ColumnaTabla, DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ModalCrearInsumo } from "./ModalCrearInsumo";
import { ModalAgregarInsumoExistente } from "./ModalAgregarInsumoExistente";
import { ModalEditarInsumo } from "./ModalEditarInsumo";
import { ModalAjustarStockInsumo } from "./ModalAjustarStockInsumo";
import { ToastConfirmarEliminar } from "@/components/ui/ToastConfirmarEliminar/ToastConfirmarEliminar";
import { StatCards } from "@/components/ui/Statscards";
import toast from "react-hot-toast";

interface Props {
  insumos:        InsumoConStock[];
  fkeCodCompany:  string;
  fkeCodSucursal: string | null;
  sucursales:     { eCodSucursal: string; tNombre: string }[];
}

export function InsumosClient({ insumos: inicial, fkeCodCompany, fkeCodSucursal, sucursales }: Props) {
  const [insumos, setInsumos] = useState<InsumoConStock[]>(inicial);
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "", roles: [], estados: [], categorias: [],
  });
  const [modalCrear, setModalCrear]           = useState(false);
  const [modalAgregarExistente, setModalAgregarExistente] = useState(false);
  const [insumoEditar, setInsumoEditar]       = useState<InsumoConStock | null>(null);
  const [insumoAjustarStock, setInsumoAjustarStock] = useState<InsumoConStock | null>(null);
  const [toggleando, setToggleando]           = useState<string | null>(null);
  const [seleccionados, setSeleccionados]     = useState<string[]>([]);
  const [eliminando, setEliminando]           = useState<string | null>(null);
  const [insumoAEliminar, setInsumoAEliminar] = useState<InsumoConStock | null>(null);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = insumos.filter((i) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto = !texto || i.tNombre.toLowerCase().includes(texto);
    const estadoValor = i.bStateInsumoStock ? "activo" : "inactivo";
    const coincideEstado = filtros.estados.length === 0 || filtros.estados.includes(estadoValor);
    return coincideTexto && coincideEstado;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleInsumoCreado(nuevo: InsumoConStock) {
    setInsumos((prev) => [nuevo, ...prev]);
    setModalCrear(false);
    toast.success(`"${nuevo.tNombre}" creado correctamente`);
  }

  function handleInsumoAgregadoASucursal(nuevo: InsumoConStock) {
    setInsumos((prev) => [nuevo, ...prev]);
    setModalAgregarExistente(false);
    toast.success(`"${nuevo.tNombre}" agregado a esta sucursal`);
  }

  function handleInsumoEditado(actualizado: InsumoConStock) {
    setInsumos((prev) =>
      prev.map((i) => (i.eCodInsumoStock === actualizado.eCodInsumoStock ? actualizado : i))
    );
    setInsumoEditar(null);
    toast.success(`"${actualizado.tNombre}" actualizado`);
  }

  function handleStockAjustado(actualizado: InsumoConStock) {
    setInsumos((prev) =>
      prev.map((i) => (i.eCodInsumoStock === actualizado.eCodInsumoStock ? actualizado : i))
    );
    setInsumoAjustarStock(null);
    toast.success(`Stock de "${actualizado.tNombre}" actualizado`);
  }

  async function handleToggleEstado(insumo: InsumoConStock) {
    setToggleando(insumo.eCodInsumoStock);
    const result = await toggleEstadoInsumo(insumo.eCodInsumoStock, !insumo.bStateInsumoStock);
    if (!result?.error) {
      setInsumos((prev) =>
        prev.map((i) =>
          i.eCodInsumoStock === insumo.eCodInsumoStock
            ? { ...i, bStateInsumoStock: !i.bStateInsumoStock }
            : i
        )
      );
      toast.success(`"${insumo.tNombre}" ${!insumo.bStateInsumoStock ? "activado" : "desactivado"}`);
    } else {
      toast.error(`No se pudo cambiar el estado: ${result.error}`);
    }
    setToggleando(null);
  }

  function handleEliminar(insumo: InsumoConStock) {
    setInsumoAEliminar(insumo);
  }

  async function confirmarEliminar() {
    if (!insumoAEliminar) return;
    setEliminando(insumoAEliminar.eCodInsumoStock);
    const result = await eliminarInsumo(insumoAEliminar.eCodInsumoStock);
    setEliminando(null);
    if (!result?.error) {
      setInsumos((prev) => prev.filter((i) => i.eCodInsumoStock !== insumoAEliminar.eCodInsumoStock));
      toast.success(`"${insumoAEliminar.tNombre}" eliminado de esta sucursal`);
      setInsumoAEliminar(null);
    } else {
      toast.error(result.error);
      setInsumoAEliminar(null);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalActivos = insumos.filter((i) => i.bStateInsumoStock).length;
  const stockBajo = insumos.filter(
    (i) => i.bStateInsumoStock && i.eCantidadStock <= i.eStockMinimo
  ).length;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<InsumoConStock>[] = [
    { key: "tNombre", label: "Insumo", render: (i) => <span>{i.tNombre}</span> },
    {
      key: "eCantidadStock",
      label: "Stock actual",
      render: (i) => <span>{i.eCantidadStock.toLocaleString("es-MX")} {i.tUnidadReceta}</span>,
    },
    {
      key: "conversion",
      label: "Conversión",
      render: (i) => (
        <span className={styles.conversion}>
          1 {i.tUnidadCompra} = {i.eFactorConversion.toLocaleString("es-MX")} {i.tUnidadReceta}
        </span>
      ),
    },
    {
      key: "eCostoUnitario",
      label: "Costo por compra",
      render: (i) => (
        <span>
          {i.eCostoUnitario.toLocaleString("es-MX", { style: "currency", currency: "MXN" })} / {i.tUnidadCompra}
        </span>
      ),
    },
    {
      key: "stockEstado",
      label: "Nivel",
      render: (i) =>
        i.eCantidadStock <= i.eStockMinimo
          ? <Badge variante="bajo">Stock bajo</Badge>
          : <Badge variante="disponible">Disponible</Badge>,
    },
    {
      key: "bStateInsumoStock",
      label: "Estado",
      render: (i) => (
        <Badge
          activo={i.bStateInsumoStock}
          onToggle={() => handleToggleEstado(i)}
          toggling={toggleando === i.eCodInsumoStock}
        />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (i) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ActionBtn title="Ajustar stock" onClick={() => setInsumoAjustarStock(i)}>
            <Eye size={18} />
          </ActionBtn>
          <ActionBtn title="Editar" onClick={() => setInsumoEditar(i)}>
            <Pencil size={18} />
          </ActionBtn>
          <ActionBtn
            title="Eliminar de esta sucursal"
            onClick={() => handleEliminar(i)}
            loading={eliminando === i.eCodInsumoStock}
            danger
          >
            <Trash2 size={18} />
          </ActionBtn>
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <PageHeader
        titulo="Insumos"
        descripcion="Gestiona los insumos usados en tus recetas"
        boton={{ label: "Nuevo insumo", onClick: () => setModalCrear(true) }}
      />

      {/* Segundo punto de entrada: reutilizar un insumo ya creado en otra
          sucursal, sin duplicar el catálogo. Menos prominente que "Nuevo
          insumo" a propósito — es el caso menos frecuente. */}
      <button className={styles.linkAgregarExistente} onClick={() => setModalAgregarExistente(true)}>
        <PlusCircle size={14} /> Agregar un insumo que ya existe en otra sucursal
      </button>

      <StatCards stats={[
        { label: "Total insumos", value: insumos.length, variante: "primary" },
        { label: "Activos",       value: totalActivos,   variante: "success" },
        { label: "Stock bajo",    value: stockBajo,       variante: "accent"  },
      ]} />

      <TablaToolbar filtros={filtros} onChange={setFiltros} total={filtradas.length} ocultarRol />

      <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(i) => String(i.eCodInsumoStock)}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No se encontraron insumos"
      />

      {modalCrear && (
        <ModalCrearInsumo
          onClose={() => setModalCrear(false)}
          onCreado={handleInsumoCreado}
          fkeCodSucursal={fkeCodSucursal}
          sucursales={sucursales}
        />
      )}
      {modalAgregarExistente && (
        <ModalAgregarInsumoExistente
          onClose={() => setModalAgregarExistente(false)}
          onAgregado={handleInsumoAgregadoASucursal}
          fkeCodSucursal={fkeCodSucursal}
          sucursales={sucursales}
        />
      )}
      {insumoEditar && (
        <ModalEditarInsumo
          insumo={insumoEditar}
          onClose={() => setInsumoEditar(null)}
          onEditado={handleInsumoEditado}
        />
      )}
      {insumoAjustarStock && (
        <ModalAjustarStockInsumo
          insumo={insumoAjustarStock}
          onClose={() => setInsumoAjustarStock(null)}
          onAjustado={handleStockAjustado}
        />
      )}
      {insumoAEliminar && (
        <ToastConfirmarEliminar
          tipo="insumo"
          nombre={insumoAEliminar.tNombre}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setInsumoAEliminar(null)}
          cargando={eliminando === insumoAEliminar.eCodInsumoStock}
        />
      )}
    </div>
  );
}

function ActionBtn({
  children, title, onClick, danger, loading,
}: {
  children: React.ReactNode; title: string; onClick: () => void; danger?: boolean; loading?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={loading}
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""} ${loading ? styles.actionBtnLoading : ""}`}
    >
      {loading ? "" : children}
    </button>
  );
}
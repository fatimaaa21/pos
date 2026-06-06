"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { PageHeader }    from "@/components/ui/PageHeader";
import { StatCards }     from "@/components/ui/Statscards";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge }         from "@/components/ui/Badge";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { ToastConfirmarEliminar } from "@/components/ui/ToastConfirmarEliminar/ToastConfirmarEliminar";
import { ModalCrearMaterial }  from "./ModalCrearMaterial";
import { ModalEditarMaterial } from "./ModalEditarMaterial";
import { toggleEstadoMaterial, eliminarMaterial } from "@/lib/actions/materiales";
import { formatFechaHora } from "@/lib/utils/fecha";
import type { Material } from "@/types";
import toast from "react-hot-toast";
import styles from "./inventario.module.css";

interface Props {
  materiales: Material[];
}

export function InventarioImpresionClient({ materiales: inicial }: Props) {
  const [materiales,      setMateriales]      = useState<Material[]>(inicial);
  const [modalCrear,      setModalCrear]      = useState(false);
  const [materialEditar,  setMaterialEditar]  = useState<Material | null>(null);
  const [materialEliminar,setMaterialEliminar]= useState<Material | null>(null);
  const [eliminando,      setEliminando]      = useState<string | null>(null);
  const [toggleando,      setToggleando]      = useState<string | null>(null);
  const [seleccionados,   setSeleccionados]   = useState<string[]>([]);
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "", roles: [], estados: [],
  });

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtrados = materiales.filter((m) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto =
      !texto || m.tNombre.toLowerCase().includes(texto);

    const estadoValor    = m.bStateMaterial ? "activo" : "inactivo";
    const coincideEstado =
      filtros.estados.length === 0 || filtros.estados.includes(estadoValor);

    return coincideTexto && coincideEstado;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleCreado(nuevo: Material) {
    setMateriales((prev) => [nuevo, ...prev]);
    setModalCrear(false);
    toast.success(`"${nuevo.tNombre}" agregado`);
  }

  function handleEditado(actualizado: Material) {
    setMateriales((prev) =>
      prev.map((m) => m.eCodMaterial === actualizado.eCodMaterial ? actualizado : m)
    );
    setMaterialEditar(null);
    toast.success(`"${actualizado.tNombre}" actualizado`);
  }

  async function handleToggle(material: Material) {
    setToggleando(material.eCodMaterial);
    const result = await toggleEstadoMaterial(
      material.eCodMaterial,
      !material.bStateMaterial
    );
    if (!result?.error) {
      setMateriales((prev) =>
        prev.map((m) =>
          m.eCodMaterial === material.eCodMaterial
            ? { ...m, bStateMaterial: !m.bStateMaterial }
            : m
        )
      );
      const nuevoEstado = !material.bStateMaterial;
      toast.success(`"${material.tNombre}" ${nuevoEstado ? "activado" : "desactivado"}`);
    } else {
      toast.error(`No se pudo cambiar el estado: ${result.error}`);
    }
    setToggleando(null);
  }

  async function confirmarEliminar() {
    if (!materialEliminar) return;
    setEliminando(materialEliminar.eCodMaterial);
    const result = await eliminarMaterial(materialEliminar.eCodMaterial);
    setEliminando(null);
    if (!result?.error) {
      setMateriales((prev) =>
        prev.filter((m) => m.eCodMaterial !== materialEliminar.eCodMaterial)
      );
      toast.success(`"${materialEliminar.tNombre}" eliminado`);
      setMaterialEliminar(null);
    } else {
      toast.error(result.error);
      setMaterialEliminar(null);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activos   = materiales.filter((m) => m.bStateMaterial).length;
    const agotados  = materiales.filter((m) => m.eMetrosLineales <= 0).length;
    const stockBajo = materiales.filter(
    (m) => m.eStockMinimo > 0 && m.eMetrosLineales > 0 && m.eMetrosLineales <= m.eStockMinimo
    ).length;
  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<Material>[] = [
    {
      key:   "tNombre",
      label: "Material",
      render: (m) => (
        <div>
          <span>{m.tNombre}</span>
        </div>
      ),
    },
    {
      key:   "eAnchoCm",
      label: "Ancho (cm)",
      render: (m) => <span>{m.eAnchoCm} cm</span>,
    },
    {
    key:   "eMetrosLineales",
    label: "Existencia",
    render: (m) => {
        const unidad = m.tipo_material === "rollo" ? "metros" : "hojas";
        const estado =
        m.eMetrosLineales <= 0                                     ? "agotado"    :
        m.eStockMinimo > 0 && m.eMetrosLineales <= m.eStockMinimo  ? "bajo"       :
        "disponible";

        return (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Badge variante={estado} dot={false}>
            {m.eMetrosLineales} {unidad}
            </Badge>
        </div>
        );
    },
    },
    {
      key:   "fhCreateMaterial",
      label: "Fecha de ingreso",
      render: (m) => <span>{formatFechaHora(m.fhCreateMaterial)}</span>,
    },
    {
      key:   "bStateMaterial",
      label: "Estado",
      render: (m) => (
        <Badge
          activo={m.bStateMaterial}
          onToggle={() => handleToggle(m)}
          toggling={toggleando === m.eCodMaterial}
        />
      ),
    },
    {
      key:   "acciones",
      label: "Acciones",
      render: (m) => (
        <div style={{ display: "flex", gap: 4 }}>
          <ActionBtn title="Editar" onClick={() => setMaterialEditar(m)}>
            <Pencil size={18} />
          </ActionBtn>
          <ActionBtn
            title="Eliminar"
            danger
            loading={eliminando === m.eCodMaterial}
            onClick={() => setMaterialEliminar(m)}
          >
            <Trash2 size={18} />
          </ActionBtn>
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="container">
      <PageHeader
        titulo="Materiales"
        descripcion="Control de insumos para trabajos por medida o unidad"
        boton={{ label: "Agregar material", onClick: () => setModalCrear(true) }}
      />

      <StatCards stats={[
        { label: "Total materiales", value: materiales.length, variante: "primary" },
        { label: "Activos",          value: activos,            variante: "success" },
        { label: "Stock bajo",       value: stockBajo,          variante: "warning" },
        { label: "Agotados",         value: agotados,           variante: "error"   },
        ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtrados.length}
        ocultarRol
      />

      <DataTable
        columnas={columnas}
        datos={filtrados}
        keyExtractor={(m) => m.eCodMaterial}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No hay materiales registrados"
      />

      {modalCrear && (
        <ModalCrearMaterial
          onClose={() => setModalCrear(false)}
          onCreado={handleCreado}
        />
      )}
      {materialEditar && (
        <ModalEditarMaterial
          material={materialEditar}
          onClose={() => setMaterialEditar(null)}
          onEditado={handleEditado}
        />
      )}
      {materialEliminar && (
        <ToastConfirmarEliminar
          tipo="material"
          nombre={materialEliminar.tNombre}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setMaterialEliminar(null)}
          cargando={eliminando === materialEliminar.eCodMaterial}
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
"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { GrupoExtraConOpciones, OpcionExtra } from "@/types";
import styles from "./extras.module.css";
import {
  obtenerGruposExtrasNegocio,
  eliminarGrupoExtra,
  toggleEstadoGrupoExtra,
} from "@/lib/actions/extras";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { ColumnaTabla, DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/Statscards";
import { ToastConfirmarEliminar } from "@/components/ui/ToastConfirmarEliminar/ToastConfirmarEliminar";
import { ModalCrearGrupoExtra } from "./ModalCrearGrupoExtra";
import { ModalVerGrupoExtra } from "./ModalVerGrupoExtra";
import { ModalEditarGrupoExtra } from "./ModalEditarGrupoExtra";
import toast from "react-hot-toast";

export function GestionGruposExtrasNegocio() {
  const [grupos, setGrupos]     = useState<GrupoExtraConOpciones[]>([]);
  const [cargando, setCargando] = useState(true);

  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "",
    roles: [],
    estados: [],
  });

  const [modalCrear, setModalCrear]     = useState(false);
  const [grupoVer, setGrupoVer]         = useState<GrupoExtraConOpciones | null>(null);
  const [grupoEditar, setGrupoEditar]   = useState<GrupoExtraConOpciones | null>(null);
  const [toggleando, setToggleando]     = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [eliminando, setEliminando]     = useState<string | null>(null);
  const [grupoAEliminar, setGrupoAEliminar] = useState<GrupoExtraConOpciones | null>(null);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const result = await obtenerGruposExtrasNegocio();
      if (result.error) toast.error(result.error);
      else setGrupos(result.grupos ?? []);
      setCargando(false);
    })();
  }, []);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtrados = grupos.filter((g) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto = !texto || g.tNombreGrupo.toLowerCase().includes(texto);

    const estadoValor = g.bStateGrupoExtra ? "activo" : "inactivo";
    const coincideEstado = filtros.estados.length === 0 || filtros.estados.includes(estadoValor);

    return coincideTexto && coincideEstado;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleGrupoCreadoInterno(nuevo: { eCodGrupoExtra: string } & Partial<GrupoExtraConOpciones>) {
    const conOpciones: GrupoExtraConOpciones = { ...(nuevo as GrupoExtraConOpciones), opciones: [] };
    setGrupos((prev) => [...prev, conOpciones]);
    setModalCrear(false);
    toast.success(`"${conOpciones.tNombreGrupo}" creado`);
  }

  function handleGrupoEditado(actualizado: { eCodGrupoExtra: string } & Partial<GrupoExtraConOpciones>) {
    setGrupos((prev) =>
      prev.map((g) => g.eCodGrupoExtra === actualizado.eCodGrupoExtra ? { ...g, ...actualizado } : g)
    );
    setGrupoEditar(null);
    toast.success(`"${actualizado.tNombreGrupo}" actualizado`);
  }

  function handleOpcionesCambiaron(eCodGrupoExtra: string, opciones: OpcionExtra[]) {
    setGrupos((prev) =>
      prev.map((g) => g.eCodGrupoExtra === eCodGrupoExtra ? { ...g, opciones } : g)
    );
  }

  async function handleToggleEstado(grupo: GrupoExtraConOpciones) {
    setToggleando(grupo.eCodGrupoExtra);
    const result = await toggleEstadoGrupoExtra(grupo.eCodGrupoExtra, !grupo.bStateGrupoExtra);
    if (!result?.error) {
      setGrupos((prev) =>
        prev.map((g) =>
          g.eCodGrupoExtra === grupo.eCodGrupoExtra ? { ...g, bStateGrupoExtra: !g.bStateGrupoExtra } : g
        )
      );
      toast.success(`"${grupo.tNombreGrupo}" ${!grupo.bStateGrupoExtra ? "activado" : "desactivado"}`);
    } else {
      toast.error(`No se pudo cambiar el estado: ${result.error}`);
    }
    setToggleando(null);
  }

  function handleEliminar(grupo: GrupoExtraConOpciones) {
    setGrupoAEliminar(grupo);
  }

  async function confirmarEliminar() {
    if (!grupoAEliminar) return;
    setEliminando(grupoAEliminar.eCodGrupoExtra);
    const result = await eliminarGrupoExtra(grupoAEliminar.eCodGrupoExtra);
    setEliminando(null);
    if (!result?.error) {
      setGrupos((prev) => prev.filter((g) => g.eCodGrupoExtra !== grupoAEliminar.eCodGrupoExtra));
      toast.success(`"${grupoAEliminar.tNombreGrupo}" eliminado`);
      setGrupoAEliminar(null);
    } else {
      toast.error(result.error);
      setGrupoAEliminar(null);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalActivos = grupos.filter((g) => g.bStateGrupoExtra).length;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<GrupoExtraConOpciones>[] = [
    {
      key: "tNombreGrupo",
      label: "Grupo",
      render: (g) => <span style={{ fontWeight: 700 }}>{g.tNombreGrupo}</span>,
    },
    {
      key: "tipoSeleccion",
      label: "Tipo de selección",
      render: (g) => (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge variante="categoria">{g.bSeleccionMultiple ? "Múltiple" : "Única"}</Badge>
          {g.bRequerido && <Badge variante="pendiente">Requerido</Badge>}
        </div>
      ),
    },
    {
      key: "opciones",
      label: "Opciones",
      render: (g) => <span>{g.opciones.length}</span>,
    },
    {
      key: "bStateGrupoExtra",
      label: "Estado",
      render: (g) => (
        <Badge
          activo={g.bStateGrupoExtra}
          onToggle={() => handleToggleEstado(g)}
          toggling={toggleando === g.eCodGrupoExtra}
        />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (g) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ActionBtn title="Ver detalles" onClick={() => setGrupoVer(g)}>
            <Eye size={18} />
          </ActionBtn>
          <ActionBtn title="Editar" onClick={() => setGrupoEditar(g)}>
            <Pencil size={18} />
          </ActionBtn>
          <ActionBtn
            title="Eliminar"
            onClick={() => handleEliminar(g)}
            loading={eliminando === g.eCodGrupoExtra}
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
        titulo="Extras"
        descripcion="Grupos de modificadores reutilizables entre productos. Actívalos por producto desde Productos."
        boton={{ label: "Nuevo grupo", onClick: () => setModalCrear(true) }}
      />

      <StatCards stats={[
        { label: "Total grupos", value: grupos.length,               variante: "primary" },
        { label: "Activos",      value: totalActivos,                variante: "success" },
        { label: "Inactivos",    value: grupos.length - totalActivos, variante: "accent"  },
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
        keyExtractor={(g) => g.eCodGrupoExtra}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No se encontraron grupos de extras"
        cargando={cargando}
      />

      {modalCrear && (
        <ModalCrearGrupoExtra
          onClose={() => setModalCrear(false)}
          onCreado={handleGrupoCreadoInterno}
        />
      )}
      {grupoVer && (
        <ModalVerGrupoExtra
          grupo={grupoVer}
          onClose={() => setGrupoVer(null)}
        />
      )}
      {grupoEditar && (
        <ModalEditarGrupoExtra
          grupo={grupoEditar}
          onClose={() => setGrupoEditar(null)}
          onEditado={handleGrupoEditado}
          onOpcionesCambiaron={(opciones) => handleOpcionesCambiaron(grupoEditar.eCodGrupoExtra, opciones)}
        />
      )}

      {grupoAEliminar && (
        <ToastConfirmarEliminar
          tipo="grupo de extras"
          nombre={grupoAEliminar.tNombreGrupo}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setGrupoAEliminar(null)}
          cargando={eliminando === grupoAEliminar.eCodGrupoExtra}
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
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""} ${loading ? styles.actionBtnLoading : ""}`}
    >
      {loading ? "" : children}
    </button>
  );
}
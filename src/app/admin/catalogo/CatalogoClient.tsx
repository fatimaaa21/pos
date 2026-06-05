"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/Statscards";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { formatFechaHora, formatRelativo } from "@/lib/utils/fecha";
import type { Categoria } from "@/types";
import styles from "./catalogo.module.css";
import { toggleEstadoCategoria, eliminarCategoria } from "@/lib/actions/categorias";
import { ModalCrearCategoria } from "./ModalCrearCategoria";
import { ModalVerCategoria } from "./ModalVerCategoria";
import { ModalEditarCategoria } from "./ModalEditarCategoria";
import { ToastConfirmarEliminar } from "@/components/ui/ToastConfirmarEliminar/ToastConfirmarEliminar";
import { IconoCategoria } from "@/components/ui/IconoCategoria";
import toast from "react-hot-toast";

interface Props {
  categorias: Categoria[];
}

// ── Opciones para el filtro "Productos" ────────────────────────────────────────
// Se pasan como opcionesMetodo al TablaToolbar — el slot single-select
// genérico escribe en filtros.metodo, que el filtrado interpreta como
// "estado de productos" para esta vista.
const OPCIONES_PRODUCTOS = [
  { value: "todos",          label: "Todos"                    },
  { value: "con_activos",    label: "Con productos activos"    },
  { value: "sin_productos",  label: "Sin productos"            },
  { value: "solo_inactivos", label: "Solo productos inactivos" },
];

// ── Helper: clasifica el estado de productos de una categoría ─────────────────
function clasificarProductos(c: Categoria): string {
  const todos = c.productos ?? [];
  if (todos.length === 0) return "sin_productos";
  const activos = todos.filter((p) => p.bStateProduct).length;
  return activos > 0 ? "con_activos" : "solo_inactivos";
}

// ── Helper: comprueba si una fecha cae dentro del período elegido ─────────────
function estaEnPeriodo(fechaISO: string | undefined | null, periodo: string): boolean {
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

export function CatalogoClient({ categorias: inicial }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>(inicial);

  // Cache-busters: fuerzan al <img> a recargar tras editar una categoría
  const [imgTimestamps, setImgTimestamps] = useState<Record<string, number>>({});


  // ── Estado de filtros ─────────────────────────────────────────────────────
  // BUG CORREGIDO: antes existían dos estados separados —
  //   const [busqueda, setBusqueda] = useState("")  ← Buscador externo
  //   filtros.busqueda              ← TablaToolbar interno
  // El filtrado solo leía filtros.busqueda, así que el Buscador externo
  // no tenía ningún efecto. Ahora ambos componentes escriben en el mismo
  // estado: filtros.busqueda.
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "",
    roles:    [],
    estados:  [],
    periodo:  "todo",    // período de CREACIÓN de la categoría
    estadoFiltro: "todos",
  });

  // Modales
  const [modalCrear,      setModalCrear]     = useState(false);
  const [categoriaEditar, setCategoriaEditar] = useState<Categoria | null>(null);
  const [categoriaVer,    setCategoriaVer]   = useState<Categoria | null>(null);

  // Acciones en curso
  const [toggleando,    setToggleando]   = useState<string | null>(null);
  const [categoriaAEliminar, setCategoriaAEliminar] = useState<Categoria | null>(null);
  const [eliminando,    setEliminando]   = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = categorias.filter((c) => {
    // 1. Búsqueda de texto (Buscador externo + search interno del Toolbar
    //    alimentan el mismo filtros.busqueda → ya no están desconectados)
    const texto = filtros.busqueda.toLowerCase().trim();
    const coincideTexto =
      !texto || c.tNameCategory.toLowerCase().includes(texto);

    // 2. Estado activo / inactivo
    const estadoValor   = c.bStateCategory ? "activo" : "inactivo";
    const coincideEstado =
      filtros.estados.length === 0 || filtros.estados.includes(estadoValor);

    // 3. Período de creación de la categoría
    const coincidePeriodo = estaEnPeriodo(c.fhCreateCategory, filtros.periodo ?? "todo");

    // 4. Estado de productos (slot "metodo" del Toolbar)
    const filtroProductos = filtros.estadoFiltro ?? "todos";
    const coincideProductos =
      filtroProductos === "todos" || clasificarProductos(c) === filtroProductos;

    return coincideTexto && coincideEstado && coincidePeriodo && coincideProductos;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleCategoriaCreada(nuevo: Categoria) {
  setCategorias((prev) => [{ ...nuevo, productos: [] }, ...prev]);
  setModalCrear(false);
  toast.success(`"${nuevo.tNameCategory}" creada`);
}

  function handleCategoriaEditada(actualizado: Categoria) {
  setCategorias((prev) =>
    prev.map((c) =>
      c.eCodCategory === actualizado.eCodCategory
        ? { ...actualizado, productos: c.productos }
        : c
    )
  );
  setImgTimestamps((prev) => ({ ...prev, [actualizado.eCodCategory]: Date.now() }));
  setCategoriaEditar(null);
  toast.success(`"${actualizado.tNameCategory}" actualizada`);
}

  async function handleToggleEstado(categoria: Categoria) {
  setToggleando(categoria.eCodCategory);
  const result = await toggleEstadoCategoria(
    categoria.eCodCategory,
    !categoria.bStateCategory
  );
  if (!result?.error) {
    setCategorias((prev) =>
      prev.map((c) =>
        c.eCodCategory === categoria.eCodCategory
          ? { ...c, bStateCategory: !c.bStateCategory }
          : c
      )
    );
    const nuevoEstado = !categoria.bStateCategory;
    toast.success(`"${categoria.tNameCategory}" ${nuevoEstado ? "activada" : "desactivada"}`);
  } else {
    toast.error(`No se pudo cambiar el estado: ${result.error}`);
  }
  setToggleando(null);
}

  function handleEliminar(categoria: Categoria) {
    setCategoriaAEliminar(categoria);
  }
  
  async function confirmarEliminar() {
  if (!categoriaAEliminar) return;
  setEliminando(categoriaAEliminar.eCodCategory);
  const result = await eliminarCategoria(categoriaAEliminar.eCodCategory);
  setEliminando(null);
  if (!result?.error) {
    setCategorias((prev) =>
      prev.filter((c) => c.eCodCategory !== categoriaAEliminar.eCodCategory)
    );
    toast.success(`"${categoriaAEliminar.tNameCategory}" eliminada`);
    setCategoriaAEliminar(null);
  } else {
    // El servidor ya devuelve mensajes útiles (ej. "tiene productos asociados")
    toast.error(result.error);
    setCategoriaAEliminar(null);
  }
}

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalActivas = categorias.filter((c) =>  c.bStateCategory).length;
  const conProductos = categorias.filter((c) => (c.productos?.length ?? 0) > 0).length;
  const sinProductos = categorias.filter((c) => (c.productos?.length ?? 0) === 0).length;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<Categoria>[] = [
    {
      key: "tNameCategory",
      label: "Categoría",
      render: (c) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className={styles.avatarIcono}>
            <IconoCategoria
              value={c.ImgCategory}
              size={18}
              color="var(--color-primary)"
            />
          </div>
          <span>{c.tNameCategory}</span>
        </div>
      ),
    },
    {
      key: "productos",
      label: "Productos",
      render: (c) => {
        const activos = c.productos?.filter((p) => p.bStateProduct).length ?? 0;
        return (
          <div className={styles.productosCell}>
            {activos > 0 ? (
              <span>{activos} activo{activos !== 1 ? "s" : ""}</span>
            ) : (
              <span>Sin productos</span>
            )}
          </div>
        );
      },
    },
    {
      key: "fhCreateCategory",
      label: "Fecha de creación",
      render: (c) => <span>{formatFechaHora(c.fhCreateCategory)}</span>,
    },
    {
      key: "fhUpdateCategory",
      label: "Última actualización",
      render: (c) => (
        <span>
          {c.fhUpdateCategory ? formatRelativo(c.fhUpdateCategory) : "Sin cambios"}
        </span>
      ),
    },
    {
      key: "bStateCategory",
      label: "Estado",
      render: (c) => (
        <Badge
          activo={c.bStateCategory}
          onToggle={() => handleToggleEstado(c)}
          toggling={toggleando === c.eCodCategory}
        />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (c) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ActionBtn title="Ver detalles" onClick={() => setCategoriaVer(c)}>
            <Eye size={18} />
          </ActionBtn>
          <ActionBtn title="Editar" onClick={() => setCategoriaEditar(c)}>
            <Pencil size={18} />
          </ActionBtn>
          <ActionBtn
            title="Eliminar"
            onClick={() => handleEliminar(c)}
            loading={eliminando === c.eCodCategory}
            danger
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
        titulo="Categorías"
        descripcion="Gestiona las categorías de productos"
        boton={{ label: "Nueva categoría", onClick: () => setModalCrear(true) }}
      />

      {/* Stat extra: con/sin productos para ver el estado del catálogo de un vistazo */}
      <StatCards stats={[
        { label: "Total categorías", value: categorias.length, variante: "primary" },
        { label: "Activas",          value: totalActivas,       variante: "success" },
        { label: "Con productos",    value: conProductos,       variante: "accent"  },
        { label: "Sin productos",    value: sinProductos,       variante: "neutral" },
      ]} />

      {/*
        TablaToolbar — filtros añadidos respecto a la versión anterior:

        mostrarPeriodo   → filtra por fecha de CREACIÓN de la categoría
                           (Hoy / Esta semana / Este mes / Todo)

        opcionesMetodo   → slot single-select reutilizado para el estado
                           de productos de cada categoría:
                           Todos / Con activos / Sin productos / Solo inactivos
                           El valor elegido se almacena en filtros.metodo y
                           el bloque de filtrado de arriba lo interpreta.
      */}
      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtradas.length}
        ocultarRol
        mostrarPeriodo
        opcionesEstadoFiltro={OPCIONES_PRODUCTOS}
      />

      <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(c) => String(c.eCodCategory)}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No se encontraron categorías"
      />

      {modalCrear && (
        <ModalCrearCategoria
          onClose={() => setModalCrear(false)}
          onCreado={handleCategoriaCreada}
        />
      )}
      {categoriaVer && (
        <ModalVerCategoria
          categoria={categoriaVer}
          onClose={() => setCategoriaVer(null)}
        />
      )}
      {categoriaEditar && (
        <ModalEditarCategoria
          categoria={categoriaEditar}
          onClose={() => setCategoriaEditar(null)}
          onEditado={handleCategoriaEditada}
        />
      )}
      {categoriaAEliminar && (
        <ToastConfirmarEliminar
          tipo="categoría"
          nombre={categoriaAEliminar.tNameCategory}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setCategoriaAEliminar(null)}
          cargando={eliminando === categoriaAEliminar.eCodCategory}
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
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""} ${loading ? styles.actionBtnLoading : ""}`}
    >
      {loading ? "⏳" : children}
    </button>
  );
}
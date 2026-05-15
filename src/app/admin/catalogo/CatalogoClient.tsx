"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Buscador } from "@/components/ui/Buscador";
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

interface Props {
  categorias: Categoria[];
}

export function CatalogoClient({ categorias: inicial }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>(inicial);
  // Map de eCodCategory → timestamp — se actualiza cada vez que se edita una categoría.
  // Esto fuerza que el <img> recargue la imagen aunque la URL base sea la misma.
  const [imgTimestamps, setImgTimestamps] = useState<Record<string, number>>(() =>
    Object.fromEntries(inicial.map((c) => [c.eCodCategory, Date.now()]))
  );
  
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "",
    roles: [],
    estados: [],
  });
  const [modalCrear, setModalCrear] = useState(false);
  const [categoriaEditar, setCategoriaEditar] = useState<Categoria | null>(null);
  const [categoriaVer, setCategoriaVer] = useState<Categoria | null>(null);
  const [toggleando, setToggleando] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [ts] = useState(() => Date.now());

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = categorias.filter((c) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto = !texto || c.tNameCategory.toLowerCase().includes(texto);
    const estadoValor = c.bStateCategory ? "activo" : "inactivo";
    const coincideEstado =
      filtros.estados.length === 0 || filtros.estados.includes(estadoValor);
    return coincideTexto && coincideEstado;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleCategoriaCreada(nuevo: Categoria) {
    setCategorias((prev) => [{ ...nuevo, productos: [] }, ...prev]);
    setModalCrear(false);
  }

  function handleCategoriaEditada(actualizado: Categoria) {
    setCategorias((prev) =>
      prev.map((c) =>
        c.eCodCategory === actualizado.eCodCategory
          ? { ...actualizado, productos: c.productos } // preservar productos del estado local
          : c
      )
    );
    // Nuevo timestamp → el <img> recarga la imagen del bucket aunque la URL sea igual
    setImgTimestamps((prev) => ({ ...prev, [actualizado.eCodCategory]: Date.now() }));
    setCategoriaEditar(null);
  }

  async function handleToggleEstado(categoria: Categoria) {
    setToggleando(categoria.eCodCategory);
    const result = await toggleEstadoCategoria(categoria.eCodCategory, !categoria.bStateCategory);
    if (!result?.error) {
      setCategorias((prev) =>
        prev.map((c) =>
          c.eCodCategory === categoria.eCodCategory
            ? { ...c, bStateCategory: !c.bStateCategory }
            : c
        )
      );
    }
    setToggleando(null);
  }

  async function handleEliminar(categoria: Categoria) {
    const confirmar = window.confirm(
      `¿Eliminar "${categoria.tNameCategory}"? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setEliminando(categoria.eCodCategory);
    const result = await eliminarCategoria(categoria.eCodCategory);

    if (!result?.error) {
      setCategorias((prev) => prev.filter((c) => c.eCodCategory !== categoria.eCodCategory));
    } else {
      alert(`Error al eliminar categoría: ${result.error}`);
    }
    setEliminando(null);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalActivas = categorias.filter((c) => c.bStateCategory).length;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<Categoria>[] = [
    // Reemplaza la columna "tNameCategory" en el array `columnas` de CatalogoClient.tsx

    {
      key: "tNameCategory",
      label: "Categoría",
      render: (c) => {
        const ts = imgTimestamps[c.eCodCategory] ?? Date.now();
        return (
          <div className={styles.avatar} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {c.ImgCategory ? (
              <img
                src={`${c.ImgCategory.split("?")[0]}?t=${ts}`}
              />
            ) : null }
            <span>{c.tNameCategory}</span>
          </div>
        );
      },
    },
    {
      key: "productos",
      label: "Productos",
      render: (c) => {
        const total = c.productos?.length ?? 0;
        const activos = c.productos?.filter((p) => p.bStateProduct).length ?? 0;
        return (
          <div className={styles.productosCell}>
            {activos > 0 ? (
              <span>
                {activos} activo{activos !== 1 ? "s" : ""}
              </span>
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
        <span>{c.fhUpdateCategory ? formatRelativo(c.fhUpdateCategory) : "Sin cambios"}</span>
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

  return (
    <div className="container">
      <div className="header">
        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar categoría..."
        />
      </div>

      <PageHeader
        titulo="Categorías"
        descripcion="Gestiona las categorías de productos"
        boton={{ label: "Nueva categoría", onClick: () => setModalCrear(true) }}
      />

      {/* Stats */}
      <StatCards stats={[
        { label: "Total categorías",  value: categorias.length, variante: "primary" },
        { label: "Activas",         value: totalActivas, variante: "success" },
        { label: "Inactivas",         value: categorias.length - totalActivas, variante: "accent" },
      ]} />

      {/* Filtros */}
      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtradas.length}
        ocultarRol
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

      {/* Modales */}
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
      {loading ? "⏳" : children}
    </button>
  );
}
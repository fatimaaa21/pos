"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useCategorias } from "@/hooks/useCategorias";
import { Buscador } from "@/components/ui/Buscador";
import { ModalCategoria } from "@/components/ui/Modal";
import { Tabla } from "@/components/ui/Tabla";
import styles from "./page.module.css";

export default function CatalogoPage() {
  const { categorias, loading, crear, actualizar, eliminar, toggleEstado } = useCategorias();
  const [busqueda, setBusqueda] = useState("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [categoriaEditar, setCategoriaEditar] = useState<Categoria | null>(null);
  const [cargando, setCargando] = useState(false);

  const filtradas = categorias.filter((c) =>
    c.tNameCategory.toLowerCase().includes(busqueda.toLowerCase())
  );

  function abrirCrear() {
    setCategoriaEditar(null);
    setModalAbierto(true);
  }

  function abrirEditar(categoria: Categoria) {
    setCategoriaEditar(categoria);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setCategoriaEditar(null);
  }

  async function handleGuardar(tNameCategory: string, ImgCategory: string) {
    setCargando(true);
    let result: { error: unknown };
    if (categoriaEditar) {
      result = await actualizar(categoriaEditar.eCodCategory, tNameCategory, ImgCategory);
    } else {
      result = await crear(tNameCategory, ImgCategory);
    }
    setCargando(false);
    cerrarModal();
    return result;
  }

  async function handleEliminar(id: number) {
    const confirmar = window.confirm("¿Seguro que quieres eliminar esta categoría?");
    if (!confirmar) return;
    await eliminar(id);
  }

  return (
    <div className="container">

    <div className={styles.header}>
      <Buscador
        valor={busqueda}
        onChange={setBusqueda}
        placeholder="Buscar categoría..."
      />
    </div>

    <div>
      <h1 className={styles.titulo}>Categorías</h1>
      <p className={styles.subtitulo}>Gestiona las categorías de productos</p>
    </div>
    <div>
      <button className={styles.btnNuevo} onClick={abrirCrear}>
        <Plus size={16} />
        Nueva categoría
      </button>
    </div> 

    <Tabla
      datos={filtradas}
      loading={loading}
      keyExtractor={(c) => c.eCodCategory}
      mensajeVacio="No se encontraron categorías"
      columnas={[
  {
    header: "Categoría",
    render: (c) => (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>{c.ImgCategory}</span>
        <span>{c.tNameCategory}</span>
      </div>
    ),
  },
  {
    header: "Creación",
    render: (c) => c.fhCreateCategory
      ? new Date(c.fhCreateCategory).toLocaleDateString("es-MX")
      : "—",
  },
  {
    header: "Última actualización",
    render: (c) => c.fhUpdateCategory
      ? new Date(c.fhUpdateCategory).toLocaleDateString("es-MX")
      : "Sin cambios",
  },
  {
    header: "Estado",
    render: (c) => (
      <button
        onClick={() => toggleEstado(c.eCodCategory, c.bStateCategory ?? true)}
        style={{
          padding: "3px 12px",
          borderRadius: 100,
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          background: c.bStateCategory ? "#f0fdf4" : "#fef2f2",
          color: c.bStateCategory ? "#10b981" : "#ef4444",
        }}
      >
        {c.bStateCategory ? "Activo" : "Inactivo"}
      </button>
    ),
  },
  {
    header: "Acciones",
    width: "100px",
    render: (c) => (
      <div style={{ display: "flex", gap: 10 }}>
        <button className={styles.btnIcono} onClick={() => abrirEditar(c)} title="Editar">
          <Pencil size={14} />
        </button>
        <button
          className={`${styles.btnIcono} ${styles.btnEliminar}`}
          onClick={() => handleEliminar(c.eCodCategory)}
          title="Eliminar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    ),
  },
]}
    />

    {modalAbierto && (
      <ModalCategoria
        categoria={categoriaEditar}
        onGuardar={handleGuardar}
        onCerrar={cerrarModal}
        cargando={cargando}
      />
    )}

  </div>
);
}
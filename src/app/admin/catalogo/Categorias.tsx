"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useCategorias } from "@/hooks/useCategorias";
import { Buscador } from "@/components/ui/Buscador";
import { ModalCategoria } from "@/components/ui/Modal";
import type { Categoria } from "@/types";
import styles from "./Categorias.module.css";

export function Categorias() {
  const {categorias, loading, crear, actualizar, eliminar } = useCategorias();
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

  async function handleGuardar(nombre: string, icono: string) {
    setCargando(true);
    if (categoriaEditar) {
      await actualizar(categoriaEditar.eCodCategory, nombre, icono);
    } else {
      await crear(nombre, icono);
    }
    setCargando(false);
    cerrarModal();
  }

  async function handleEliminar(id: number) {
    const confirmar = window.confirm("¿Seguro que quieres eliminar esta categoría?");
    if (!confirmar) return;
    await eliminar(id);
  }

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.titulo}>Categorías</h1>
          <p className={styles.subtitulo}>Gestiona las categorías de productos</p>
        </div>
        <button className={styles.btnNuevo} onClick={abrirCrear}>
          <Plus size={16} />
          Nueva categoría
        </button>
      </div>

      {/* Buscador */}
      <div className={styles.filtros}>
        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar categoría..."
        />
        <span className={styles.conteo}>
          {filtradas.length} {filtradas.length === 1 ? "categoría" : "categorías"}
        </span>
      </div>

      {/* Lista */}
      {loading ? (
        <div className={styles.estado}>Cargando...</div>
      ) : filtradas.length === 0 ? (
        <div className={styles.estado}>No se encontraron categorías</div>
      ) : (
        <div className={styles.grid}>
          {filtradas.map((categoria) => (
            <div key={categoria.eCodCategory} className={styles.card}>
              <div className={styles.cardIcono}>{categoria.ImgCategory}</div>
              <div className={styles.cardNombre}>{categoria.tNameCategory}</div>
              <div className={styles.cardAcciones}>
                <button
                  className={styles.btnIcono}
                  onClick={() => abrirEditar(categoria)}
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className={`${styles.btnIcono} ${styles.btnEliminar}`}
                  onClick={() => handleEliminar(categoria.eCodCategory)}
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}


    </div>
  );
}
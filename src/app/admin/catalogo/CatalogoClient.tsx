"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Buscador } from "@/components/ui/Buscador";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { formatFecha, formatRelativo } from "@/lib/utils/fecha";
import type { Categoria } from "@/types";
import styles from "./catalogo.module.css";

interface Props {
  categorias: Categoria[];
}

export function CatalogoClient({ categorias: inicial }: Props) {
  const [categorias, setCategorias] = useState<Categoria[]>(inicial);
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "",
    roles: [],
    estados: [],
  });
  const [modalAbierto, setModalAbierto] = useState(false);
  const [categoriaEditar, setCategoriaEditar] = useState<Categoria | null>(null);
  const [cargando, setCargando] = useState(false);
  const [toggleando, setToggleando] = useState<number | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = categorias.filter((c) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto = !texto || c.tNameCategory.toLowerCase().includes(texto);

    const estadoValor = c.bStateCategory ? "activo" : "inactivo";
    const coincideEstado =
      filtros.estados.length === 0 || filtros.estados.includes(estadoValor);

    return coincideTexto && coincideEstado;
  });

  // ── Helpers Supabase ──────────────────────────────────────────────────────
  async function recargar() {
    const supabase = createClient();
    const { data } = await supabase
      .from("categorias")
      .select("*")
      .order("tNameCategory");
    if (data) setCategorias(data as Categoria[]);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
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
    const supabase = createClient();
    const ahora = new Date().toISOString();

    if (categoriaEditar) {
      const { data } = await supabase
        .from("categorias")
        .update({ tNameCategory, ImgCategory, fhUpdateCategory: ahora })
        .eq("eCodCategory", categoriaEditar.eCodCategory)
        .select()
        .single();

      if (data) {
        setCategorias((prev) =>
          prev.map((c) => (c.eCodCategory === categoriaEditar.eCodCategory ? (data as Categoria) : c))
        );
      }
    } else {
      const { data } = await supabase
        .from("categorias")
        .insert({ tNameCategory, ImgCategory, bStateCategory: true, fhCreateCategory: ahora })
        .select()
        .single();

      if (data) {
        setCategorias((prev) => [data as Categoria, ...prev]);
      }
    }

    setCargando(false);
    cerrarModal();
    return { error: null };
  }

  async function handleToggleEstado(categoria: Categoria) {
    setToggleando(categoria.eCodCategory);
    const supabase = createClient();
    const nuevoEstado = !(categoria.bStateCategory ?? true);

    const { data } = await supabase
      .from("categorias")
      .update({ bStateCategory: nuevoEstado, fhUpdateCategory: new Date().toISOString() })
      .eq("eCodCategory", categoria.eCodCategory)
      .select()
      .single();

    if (data) {
      setCategorias((prev) =>
        prev.map((c) => (c.eCodCategory === categoria.eCodCategory ? (data as Categoria) : c))
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
    const supabase = createClient();
    const { error } = await supabase
      .from("categorias")
      .delete()
      .eq("eCodCategory", categoria.eCodCategory);

    if (!error) {
      setCategorias((prev) => prev.filter((c) => c.eCodCategory !== categoria.eCodCategory));
    }

    setEliminando(null);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalActivas = categorias.filter((c) => c.bStateCategory).length;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<Categoria>[] = [
    {
      key: "tNameCategory",
      label: "Categoría",
      render: (c) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={styles.icono}>{c.ImgCategory}</span>
          <span style={{ fontWeight: 600 }}>{c.tNameCategory}</span>
        </div>
      ),
    },
    {
      key: "fhCreateCategory",
      label: "Creación",
      render: (c) => (
        <span style={{ color: "var(--gray)", fontSize: 13 }}>
          {formatFecha(c.fhCreateCategory)}
        </span>
      ),
    },
    {
      key: "fhUpdateCategory",
      label: "Última actualización",
      render: (c) => (
        <span style={{ color: "var(--gray)", fontSize: 13 }}>
          {c.fhUpdateCategory ? formatRelativo(c.fhUpdateCategory) : "Sin cambios"}
        </span>
      ),
    },
    {
      key: "bStateCategory",
      label: "Estado",
      render: (c) => (
        <Badge
          activo={c.bStateCategory ?? true}
          onToggle={() => handleToggleEstado(c)}
          toggling={toggleando === c.eCodCategory}
        />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      width: "100px",
      render: (c) => (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={styles.actionBtn}
            onClick={() => abrirEditar(c)}
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => handleEliminar(c)}
            disabled={eliminando === c.eCodCategory}
            title="Eliminar"
          >
            {eliminando === c.eCodCategory ? "⏳" : <Trash2 size={14} />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="container">

      <PageHeader
        titulo="Categorías"
        descripcion="Gestiona las categorías de productos"
        boton={{ label: "Nueva categoría", onClick: abrirCrear }}
      />

      {/* Stats */}
      <div className={styles.stats}>
        {[
          { label: "Total categorías", value: categorias.length,                      color: "#628321" },
          { label: "Activas",          value: totalActivas,                            color: "#3B6D11" },
          { label: "Inactivas",        value: categorias.length - totalActivas,        color: "#888780" },
        ].map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 13, color: "#7a6a5e", marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar — sin filtro de rol */}
      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtradas.length}
        ocultarRol
      />

      {/* Tabla */}
      <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(c) => String(c.eCodCategory)}
        vacio="No se encontraron categorías"
      />

      
    </div>
  );
}
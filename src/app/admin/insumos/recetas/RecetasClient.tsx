"use client";

import { useState } from "react";
import { Eye, Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ColumnaTabla, DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { TablaToolbar, type FiltrosUsuario } from "@/components/ui/TablaToolbar";
import { StatCards } from "@/components/ui/Statscards";
import { ModalVerReceta } from "./ModalVerReceta";
import { ModalRecetaPresentacion } from "./ModalRecetaPresentacion";
import type { PresentacionConReceta, OpcionConReceta } from "@/types";
import styles from "../insumos.module.css";

interface Props {
  presentaciones: PresentacionConReceta[];
  opciones:       OpcionConReceta[];
}

const OPCIONES_ESTADO_RECETA = [
  { value: "todos",       label: "Todos" },
  { value: "con_receta",  label: "Con receta" },
  { value: "sin_receta",  label: "Sin receta" },
];

type Tab = "productos" | "extras";

export function RecetasClient({ presentaciones: inicial, opciones: inicialOpciones }: Props) {
  const [tab, setTab] = useState<Tab>("productos");

  const [presentaciones, setPresentaciones] = useState(inicial);
  const [opciones, setOpciones]             = useState(inicialOpciones);

  const [viendoProducto, setViendoProducto]   = useState<PresentacionConReceta | null>(null);
  const [editandoProducto, setEditandoProducto] = useState<PresentacionConReceta | null>(null);
  const [viendoOpcion, setViendoOpcion]       = useState<OpcionConReceta | null>(null);
  const [editandoOpcion, setEditandoOpcion]   = useState<OpcionConReceta | null>(null);

  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "", roles: [], estados: [], categorias: [], estadoFiltro: "todos",
  });

  function handleCambioRecetaProducto(cantidadInsumos: number) {
    if (!editandoProducto) return;
    const key = (p: PresentacionConReceta) => p.eCodPresentacion ?? `producto:${p.eCodProduct}`;
    const keyEditando = key(editandoProducto);
    setPresentaciones((prev) => prev.map((p) => (key(p) === keyEditando ? { ...p, cantidadInsumos } : p)));
  }

  function handleCambioRecetaOpcion(cantidadInsumos: number) {
    if (!editandoOpcion) return;
    setOpciones((prev) =>
      prev.map((o) => (o.eCodOpcionExtra === editandoOpcion.eCodOpcionExtra ? { ...o, cantidadInsumos } : o))
    );
  }

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const presentacionesFiltradas = presentaciones.filter((p) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto =
      !texto || p.tNameProduct.toLowerCase().includes(texto) || p.tNombre.toLowerCase().includes(texto);

    const coincideEstado =
      !filtros.estadoFiltro || filtros.estadoFiltro === "todos"
        ? true
        : filtros.estadoFiltro === "con_receta" ? p.cantidadInsumos > 0 : p.cantidadInsumos === 0;

    return coincideTexto && coincideEstado;
  });

  const opcionesFiltradas = opciones.filter((o) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto =
      !texto || o.tNombreOpcion.toLowerCase().includes(texto) || o.tNombreGrupo.toLowerCase().includes(texto);

    const coincideEstado =
      !filtros.estadoFiltro || filtros.estadoFiltro === "todos"
        ? true
        : filtros.estadoFiltro === "con_receta" ? o.cantidadInsumos > 0 : o.cantidadInsumos === 0;

    return coincideTexto && coincideEstado;
  });

  // ── Stats (del tab activo) ───────────────────────────────────────────────
  const totalTab   = tab === "productos" ? presentaciones.length : opciones.length;
  const conReceta  = tab === "productos"
    ? presentaciones.filter((p) => p.cantidadInsumos > 0).length
    : opciones.filter((o) => o.cantidadInsumos > 0).length;
  const sinReceta  = totalTab - conReceta;

  const columnasProductos: ColumnaTabla<PresentacionConReceta>[] = [
    { key: "tNameProduct", label: "Producto", render: (p) => <span>{p.tNameProduct}</span> },
    { key: "tNombre",      label: "Presentación", render: (p) => <span>{p.tNombre}</span> },
    {
      key: "receta", label: "Receta",
      render: (p) => p.cantidadInsumos === 0
        ? <Badge variante="bajo">Sin receta</Badge>
        : <Badge variante="disponible">{p.cantidadInsumos} línea{p.cantidadInsumos !== 1 ? "s" : ""}</Badge>,
    },
    {
      key: "acciones", label: "Acciones",
      render: (p) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => setViendoProducto(p)} title="Ver receta" className={styles.actionBtn}><Eye size={18} /></button>
          <button onClick={() => setEditandoProducto(p)} title="Editar receta" className={styles.actionBtn}><Pencil size={18} /></button>
        </div>
      ),
    },
  ];

  const columnasOpciones: ColumnaTabla<OpcionConReceta>[] = [
    { key: "tNombreGrupo",  label: "Grupo",  render: (o) => <span>{o.tNombreGrupo}</span> },
    { key: "tNombreOpcion", label: "Opción", render: (o) => <span style={{ fontWeight: 700 }}>{o.tNombreOpcion}</span> },
    {
      key: "receta", label: "Receta",
      render: (o) => o.cantidadInsumos === 0
        ? <Badge variante="bajo">Sin receta</Badge>
        : <Badge variante="disponible">{o.cantidadInsumos} línea{o.cantidadInsumos !== 1 ? "s" : ""}</Badge>,
    },
    {
      key: "acciones", label: "Acciones",
      render: (o) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => setViendoOpcion(o)} title="Ver receta" className={styles.actionBtn}><Eye size={18} /></button>
          <button onClick={() => setEditandoOpcion(o)} title="Editar receta" className={styles.actionBtn}><Pencil size={18} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <PageHeader
        titulo="Recetas"
        descripcion="Define qué insumos consume cada presentación o extra al venderse"
      />

      <div className={styles.tabs} style={{ marginBottom: "var(--space-4)" }}>
        <button className={`${styles.tab} ${tab === "productos" ? styles.tabActivo : ""}`} onClick={() => setTab("productos")}>
          Productos
        </button>
        <button className={`${styles.tab} ${tab === "extras" ? styles.tabActivo : ""}`} onClick={() => setTab("extras")}>
          Extras
        </button>
      </div>

      <StatCards stats={[
        { label: "Total",       value: totalTab,  variante: "primary" },
        { label: "Con receta",  value: conReceta, variante: "success" },
        { label: "Sin receta",  value: sinReceta, variante: "accent"  },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={tab === "productos" ? presentacionesFiltradas.length : opcionesFiltradas.length}
        ocultarRol
        ocultarEstado
        opcionesEstadoFiltro={OPCIONES_ESTADO_RECETA}
      />

      {tab === "productos" ? (
        <DataTable
          columnas={columnasProductos}
          datos={presentacionesFiltradas}
          keyExtractor={(p) => p.eCodPresentacion ?? `producto:${p.eCodProduct}`}
          vacio="No se encontraron presentaciones"
        />
      ) : (
        <DataTable
          columnas={columnasOpciones}
          datos={opcionesFiltradas}
          keyExtractor={(o) => o.eCodOpcionExtra}
          vacio="No se encontraron opciones de extras"
        />
      )}

      {viendoProducto && (
        <ModalVerReceta
          fkeCodPresentacion={viendoProducto.eCodPresentacion}
          fkeCodProduct={viendoProducto.eCodPresentacion ? null : viendoProducto.eCodProduct}
          nombrePresentacion={viendoProducto.tNombre}
          nombreProducto={viendoProducto.tNameProduct}
          onClose={() => setViendoProducto(null)}
        />
      )}
      {editandoProducto && (
        <ModalRecetaPresentacion
          fkeCodPresentacion={editandoProducto.eCodPresentacion}
          fkeCodProduct={editandoProducto.eCodPresentacion ? null : editandoProducto.eCodProduct}
          nombrePresentacion={editandoProducto.tNombre}
          nombreProducto={editandoProducto.tNameProduct}
          onClose={() => setEditandoProducto(null)}
          onCambio={handleCambioRecetaProducto}
        />
      )}

      {viendoOpcion && (
        <ModalVerReceta
          fkeCodOpcionExtra={viendoOpcion.eCodOpcionExtra}
          nombreProducto={viendoOpcion.tNombreGrupo}
          nombrePresentacion={viendoOpcion.tNombreOpcion}
          onClose={() => setViendoOpcion(null)}
        />
      )}
      {editandoOpcion && (
        <ModalRecetaPresentacion
          fkeCodOpcionExtra={editandoOpcion.eCodOpcionExtra}
          nombreProducto={editandoOpcion.tNombreGrupo}
          nombrePresentacion={editandoOpcion.tNombreOpcion}
          onClose={() => setEditandoOpcion(null)}
          onCambio={handleCambioRecetaOpcion}
        />
      )}
    </div>
  );
}
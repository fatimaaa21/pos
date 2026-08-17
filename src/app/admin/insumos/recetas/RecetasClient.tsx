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
import type { PresentacionConReceta } from "@/types";
import styles from "../insumos.module.css";

interface Props {
  presentaciones: PresentacionConReceta[];
}

const OPCIONES_ESTADO_RECETA = [
  { value: "todos",       label: "Todos" },
  { value: "con_receta",  label: "Con receta" },
  { value: "sin_receta",  label: "Sin receta" },
];

export function RecetasClient({ presentaciones: inicial }: Props) {
  const [presentaciones, setPresentaciones] = useState(inicial);
  const [viendo, setViendo]     = useState<PresentacionConReceta | null>(null);
  const [editando, setEditando] = useState<PresentacionConReceta | null>(null);
  const [filtros, setFiltros] = useState<FiltrosUsuario>({
    busqueda: "", roles: [], estados: [], categorias: [], estadoFiltro: "todos",
  });

  function handleCambioReceta(cantidadInsumos: number) {
    if (!editando) return;
    setPresentaciones((prev) =>
      prev.map((p) =>
        p.eCodPresentacion === editando.eCodPresentacion ? { ...p, cantidadInsumos } : p
      )
    );
  }

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = presentaciones.filter((p) => {
    const texto = filtros.busqueda.toLowerCase();
    const coincideTexto =
      !texto ||
      p.tNameProduct.toLowerCase().includes(texto) ||
      p.tNombre.toLowerCase().includes(texto);

    const coincideEstado =
      !filtros.estadoFiltro || filtros.estadoFiltro === "todos"
        ? true
        : filtros.estadoFiltro === "con_receta"
          ? p.cantidadInsumos > 0
          : p.cantidadInsumos === 0;

    return coincideTexto && coincideEstado;
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  const conReceta = presentaciones.filter((p) => p.cantidadInsumos > 0).length;
  const sinReceta = presentaciones.length - conReceta;

  const columnas: ColumnaTabla<PresentacionConReceta>[] = [
    { key: "tNameProduct", label: "Producto", render: (p) => <span>{p.tNameProduct}</span> },
    { key: "tNombre",      label: "Presentación", render: (p) => <span>{p.tNombre}</span> },
    {
      key: "receta",
      label: "Receta",
      render: (p) =>
        p.cantidadInsumos === 0
          ? <Badge variante="bajo">Sin receta</Badge>
          : <Badge variante="disponible">{p.cantidadInsumos} insumo{p.cantidadInsumos !== 1 ? "s" : ""}</Badge>,
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (p) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => setViendo(p)} title="Ver receta" className={styles.actionBtn}>
            <Eye size={18} />
          </button>
          <button onClick={() => setEditando(p)} title="Editar receta" className={styles.actionBtn}>
            <Pencil size={18} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <PageHeader
        titulo="Recetas"
        descripcion="Define qué insumos consume cada presentación al venderse"
      />

      <StatCards stats={[
        { label: "Total presentaciones", value: presentaciones.length, variante: "primary" },
        { label: "Con receta",           value: conReceta,             variante: "success" },
        { label: "Sin receta",           value: sinReceta,             variante: "accent"  },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtradas.length}
        ocultarRol
        ocultarEstado
        opcionesEstadoFiltro={OPCIONES_ESTADO_RECETA}
      />

      <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(p) => p.eCodPresentacion}
        vacio="No se encontraron presentaciones"
      />

      {viendo && (
        <ModalVerReceta
          fkeCodPresentacion={viendo.eCodPresentacion}
          nombrePresentacion={viendo.tNombre}
          nombreProducto={viendo.tNameProduct}
          onClose={() => setViendo(null)}
        />
      )}

      {editando && (
        <ModalRecetaPresentacion
          fkeCodPresentacion={editando.eCodPresentacion}
          nombrePresentacion={editando.tNombre}
          nombreProducto={editando.tNameProduct}
          onClose={() => setEditando(null)}
          onCambio={handleCambioReceta}
        />
      )}
    </div>
  );
}
"use client";
// src/components/ui/DataTable.tsx

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./DataTable.module.css";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ColumnaTabla<T> {
  key:     string;
  label:   string;
  width?:  string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columnas:           ColumnaTabla<T>[];
  datos:              T[];
  keyExtractor:       (item: T) => string;
  seleccionable?:     boolean;
  seleccionados?:     string[];
  onSeleccionar?:     (keys: string[]) => void;
  vacio?:             string;
  cargando?:          boolean;
  /** Activa la paginación interna. Default: true */
  paginado?:          boolean;
  /** Filas visibles por página. Default: 15 */
  registrosPorPagina?: number;
}

// ── Helper: páginas visibles con elipsis ──────────────────────────────────────

function getPaginas(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: (number | "…")[] = [1];

  if (actual > 3)                items.push("…");

  for (let p = Math.max(2, actual - 1); p <= Math.min(total - 1, actual + 1); p++) {
    items.push(p);
  }

  if (actual < total - 2)        items.push("…");
  items.push(total);

  return items;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function DataTable<T>({
  columnas,
  datos,
  keyExtractor,
  seleccionable       = false,
  seleccionados       = [],
  onSeleccionar,
  vacio               = "No hay datos",
  cargando            = false,
  paginado            = true,
  registrosPorPagina  = 10,
}: DataTableProps<T>) {

  const [pagina, setPagina] = useState(1);

  // Volver a la primera página cuando cambia el conjunto de datos
  // (el usuario aplicó un filtro y la lista se redujo/amplió)
  useEffect(() => {
    setPagina(1);
  }, [datos.length]);

  const totalPaginas   = paginado && datos.length > 0
    ? Math.ceil(datos.length / registrosPorPagina)
    : 1;

  const datosVisibles  = paginado
    ? datos.slice((pagina - 1) * registrosPorPagina, pagina * registrosPorPagina)
    : datos;

  const todosSeleccionados =
    datos.length > 0 && seleccionados.length === datos.length;

  function toggleTodos() {
    if (!onSeleccionar) return;
    onSeleccionar(todosSeleccionados ? [] : datos.map(keyExtractor));
  }

  function toggleItem(key: string) {
    if (!onSeleccionar) return;
    onSeleccionar(
      seleccionados.includes(key)
        ? seleccionados.filter((k) => k !== key)
        : [...seleccionados, key]
    );
  }

  const desde = datos.length === 0 ? 0 : (pagina - 1) * registrosPorPagina + 1;
  const hasta  = Math.min(pagina * registrosPorPagina, datos.length);

  return (
    <div className={styles.wrapper}>
      {/* ── Tabla ── */}
      <table className={styles.table}>
        <thead>
          <tr key="header-row">
            {seleccionable && (
              <th className={styles.checkboxCol}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={todosSeleccionados}
                  onChange={toggleTodos}
                />
              </th>
            )}
            {columnas.map((col) => (
              <th
                key={col.key}
                className={styles.headerCell}
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {cargando ? (
            <tr>
              <td
                colSpan={columnas.length + (seleccionable ? 1 : 0)}
                className={styles.emptyCell}
              >
                <div className={styles.skeletonWrapper}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={styles.skeleton} />
                  ))}
                </div>
              </td>
            </tr>
          ) : datos.length === 0 ? (
            <tr>
              <td
                colSpan={columnas.length + (seleccionable ? 1 : 0)}
                className={styles.emptyCell}
              >
                <span className={styles.emptyText}>{vacio}</span>
              </td>
            </tr>
          ) : (
            datosVisibles.map((item) => {
              const key         = keyExtractor(item);
              const seleccionado = seleccionados.includes(key);
              return (
                <tr
                  key={key}
                  className={`${styles.row} ${seleccionado ? styles.rowSelected : ""}`}
                >
                  {seleccionable && (
                    <td className={styles.checkboxCol}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={seleccionado}
                        onChange={() => toggleItem(key)}
                      />
                    </td>
                  )}
                  {columnas.map((col) => (
                    <td key={col.key} className={styles.cell}>
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* ── Paginador ── */}
      {paginado && totalPaginas > 1 && !cargando && datos.length > 0 && (
        <div className={styles.paginador}>
          {/* Rango */}
          <span className={styles.paginadorInfo}>
            {desde.toLocaleString("es-MX")}–{hasta.toLocaleString("es-MX")} de{" "}
            <strong>{datos.length.toLocaleString("es-MX")}</strong>
          </span>

          {/* Botones */}
          <div className={styles.paginadorBtns}>
            <button
              className={styles.paginadorBtn}
              onClick={() => setPagina((p) => p - 1)}
              disabled={pagina === 1}
              aria-label="Página anterior"
            >
              <ChevronLeft size={14} />
            </button>

            {getPaginas(pagina, totalPaginas).map((p, i) =>
              p === "…" ? (
                <span key={`sep-${i}`} className={styles.paginadorSep}>…</span>
              ) : (
                <button
                  key={p}
                  className={`${styles.paginadorBtn} ${
                    p === pagina ? styles.paginadorBtnActivo : ""
                  }`}
                  onClick={() => setPagina(p as number)}
                >
                  {p}
                </button>
              )
            )}

            <button
              className={styles.paginadorBtn}
              onClick={() => setPagina((p) => p + 1)}
              disabled={pagina === totalPaginas}
              aria-label="Página siguiente"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
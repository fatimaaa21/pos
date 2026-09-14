"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { GrupoExtraConOpciones, ExtraCarrito, ProductoConStock } from "@/types";

interface Props {
  producto: ProductoConStock;
  grupos:   GrupoExtraConOpciones[];
  onConfirmar: (extras: ExtraCarrito[]) => void;
  onCerrar:    () => void;
}

// Selección en curso por grupo: id de opción -> cantidad elegida (1..eCantidadMaxima)
type SeleccionPorGrupo = Map<string, Map<string, number>>;

export function ModalExtras({ producto, grupos, onConfirmar, onCerrar }: Props) {
  const [seleccion, setSeleccion] = useState<SeleccionPorGrupo>(new Map());

  function seleccionadasDe(eCodGrupoExtra: string): Map<string, number> {
    return seleccion.get(eCodGrupoExtra) ?? new Map();
  }

  function elegirUnica(eCodGrupoExtra: string, eCodOpcionExtra: string) {
    setSeleccion((prev) => {
      const copia = new Map(prev);
      const actual = seleccionadasDe(eCodGrupoExtra);
      // Selección única: si ya estaba elegida, deselecciona; si no, reemplaza.
      const yaElegida = actual.has(eCodOpcionExtra);
      copia.set(eCodGrupoExtra, yaElegida ? new Map() : new Map([[eCodOpcionExtra, 1]]));
      return copia;
    });
  }

  function toggleMultiple(eCodGrupoExtra: string, opcion: { eCodOpcionExtra: string; eCantidadMaxima: number }) {
    setSeleccion((prev) => {
      const copia = new Map(prev);
      const actual = new Map(seleccionadasDe(eCodGrupoExtra));
      if (actual.has(opcion.eCodOpcionExtra)) {
        actual.delete(opcion.eCodOpcionExtra);
      } else {
        actual.set(opcion.eCodOpcionExtra, 1);
      }
      copia.set(eCodGrupoExtra, actual);
      return copia;
    });
  }

  function cambiarCantidad(eCodGrupoExtra: string, eCodOpcionExtra: string, delta: number, eCantidadMaxima: number) {
    setSeleccion((prev) => {
      const copia = new Map(prev);
      const actual = new Map(seleccionadasDe(eCodGrupoExtra));
      const actualCant = actual.get(eCodOpcionExtra) ?? 0;
      const nueva = Math.min(eCantidadMaxima, Math.max(0, actualCant + delta));
      if (nueva === 0) actual.delete(eCodOpcionExtra);
      else actual.set(eCodOpcionExtra, nueva);
      copia.set(eCodGrupoExtra, actual);
      return copia;
    });
  }

  // Validación: cada grupo requerido necesita al menos una selección, y cada
  // grupo múltiple debe respetar su min/máx si están definidos.
  const errorPorGrupo = new Map<string, string>();
  for (const g of grupos) {
    const elegidas = seleccionadasDe(g.eCodGrupoExtra);
    const totalElegidas = elegidas.size;

    if (g.bRequerido && totalElegidas === 0) {
      errorPorGrupo.set(g.eCodGrupoExtra, "Selecciona una opción");
      continue;
    }
    if (g.bSeleccionMultiple && totalElegidas > 0) {
      if (g.eSeleccionMinima != null && totalElegidas < g.eSeleccionMinima) {
        errorPorGrupo.set(g.eCodGrupoExtra, `Elige al menos ${g.eSeleccionMinima}`);
      } else if (g.eSeleccionMaxima != null && totalElegidas > g.eSeleccionMaxima) {
        errorPorGrupo.set(g.eCodGrupoExtra, `Elige como máximo ${g.eSeleccionMaxima}`);
      }
    }
  }

  const hayErrores = errorPorGrupo.size > 0;

  const extrasResueltos: ExtraCarrito[] = grupos.flatMap((g) => {
    const elegidas = seleccionadasDe(g.eCodGrupoExtra);
    return g.opciones
      .filter((o) => elegidas.has(o.eCodOpcionExtra))
      .map((o) => ({
        fkeCodOpcionExtra: o.eCodOpcionExtra,
        eCantidad:         elegidas.get(o.eCodOpcionExtra) ?? 1,
        ePrecioExtra:      o.ePrecioExtra,
        tNombreOpcion:     o.tNombreOpcion,
      }));
  });

  const totalExtras = extrasResueltos.reduce((acc, e) => acc + e.ePrecioExtra * e.eCantidad, 0);

  function handleConfirmar() {
    if (hayErrores) return;
    onConfirmar(extrasResueltos);
  }

  return (
    <Modal
      titulo={producto.tNameProduct}
      onCerrar={onCerrar}
      onConfirmar={handleConfirmar}
      labelConfirmar={totalExtras > 0 ? `Agregar (+$${totalExtras.toFixed(2)})` : "Agregar"}
      labelCancelar="Cancelar"
      deshabilitado={hayErrores}
      ancho="sm"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {grupos.map((g) => {
          const elegidas = seleccionadasDe(g.eCodGrupoExtra);
          const error = errorPorGrupo.get(g.eCodGrupoExtra);

          return (
            <div key={g.eCodGrupoExtra}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
                  {g.tNombreGrupo}
                  {g.bRequerido && <span style={{ color: "var(--color-error)" }}> *</span>}
                </span>
                {g.bSeleccionMultiple && (
                  <span style={{ fontSize: 11, color: "var(--gray)" }}>
                    {g.eSeleccionMinima != null || g.eSeleccionMaxima != null
                      ? `Elige ${g.eSeleccionMinima ?? 0}${g.eSeleccionMaxima != null ? `–${g.eSeleccionMaxima}` : "+"}`
                      : "Elige los que quieras"}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {g.opciones.map((o) => {
                  const cantidadElegida = elegidas.get(o.eCodOpcionExtra) ?? 0;
                  const elegida = cantidadElegida > 0;
                  const permiteCantidad = o.eCantidadMaxima > 1;

                  return (
                    <div
                      key={o.eCodOpcionExtra}
                      onClick={() => {
                        if (permiteCantidad && elegida) return; // el +/- maneja la cantidad
                        g.bSeleccionMultiple
                          ? toggleMultiple(g.eCodGrupoExtra, o)
                          : elegirUnica(g.eCodGrupoExtra, o.eCodOpcionExtra);
                      }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "var(--space-3) var(--space-4)",
                        border: `1.5px solid ${elegida ? "var(--color-primary)" : "var(--border-default)"}`,
                        borderRadius: "var(--radius-md)",
                        background: elegida ? "var(--color-primary-50)" : "white",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--dark)" }}>
                        {o.tNombreOpcion}
                        {o.ePrecioExtra > 0 && (
                          <span style={{ color: "var(--gray)", fontWeight: 500 }}> (+${o.ePrecioExtra.toFixed(2)})</span>
                        )}
                      </span>

                      {permiteCantidad && elegida ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); cambiarCantidad(g.eCodGrupoExtra, o.eCodOpcionExtra, -1, o.eCantidadMaxima); }}
                            style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid var(--border-default)", background: "white", cursor: "pointer" }}
                          >
                            −
                          </button>
                          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{cantidadElegida}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); cambiarCantidad(g.eCodGrupoExtra, o.eCodOpcionExtra, 1, o.eCantidadMaxima); }}
                            disabled={cantidadElegida >= o.eCantidadMaxima}
                            style={{ width: 24, height: 24, borderRadius: "50%", border: "1px solid var(--border-default)", background: "white", cursor: "pointer" }}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            width: 18, height: 18,
                            borderRadius: g.bSeleccionMultiple ? 4 : "50%",
                            border: `2px solid ${elegida ? "var(--color-primary)" : "var(--border-default)"}`,
                            background: elegida ? "var(--color-primary)" : "white",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <p style={{ fontSize: 11, color: "var(--color-error)", marginTop: "var(--space-1)" }}>{error}</p>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
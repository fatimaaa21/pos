"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { GrupoExtraConOpciones } from "@/types";

interface Props {
  grupo:   GrupoExtraConOpciones;
  onClose: () => void;
}

export function ModalVerGrupoExtra({ grupo, onClose }: Props) {
  return (
    <Modal titulo={grupo.tNombreGrupo} onCerrar={onClose} sinFooter ancho="sm">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Badge activo={grupo.bStateGrupoExtra} />
          <Badge variante="categoria">{grupo.bSeleccionMultiple ? "Selección múltiple" : "Selección única"}</Badge>
          {grupo.bRequerido && <Badge variante="pendiente">Requerido</Badge>}
        </div>

        {grupo.bSeleccionMultiple && (grupo.eSeleccionMinima != null || grupo.eSeleccionMaxima != null) && (
          <p style={{ fontSize: 12, color: "var(--gray)" }}>
            Selección permitida: {grupo.eSeleccionMinima ?? 0} a {grupo.eSeleccionMaxima ?? "∞"} opciones
          </p>
        )}

        <div>
          <p style={{ margin: "0 0 var(--space-2)", fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
            Opciones
          </p>
          {grupo.opciones.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--gray)", fontStyle: "italic" }}>Sin opciones todavía.</p>
          ) : (
            <div style={{ border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              {grupo.opciones.map((o, idx) => (
                <div
                  key={o.eCodOpcionExtra}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 12px",
                    borderBottom: idx < grupo.opciones.length - 1 ? "1px solid var(--border-light)" : "none",
                    opacity: o.bStateOpcionExtra ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--dark)" }}>
                    {o.tNombreOpcion}
                    {o.eCantidadMaxima > 1 && (
                      <span style={{ color: "var(--gray)", fontWeight: 500 }}> · hasta {o.eCantidadMaxima}</span>
                    )}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
                    ${o.ePrecioExtra.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
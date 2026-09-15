"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { obtenerHistorialMermas, type MermaHistorial } from "@/lib/actions/mermas";

interface Props {
  onClose: () => void;
}

export function ModalHistorialMermas({ onClose }: Props) {
  const [mermas, setMermas]     = useState<MermaHistorial[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerHistorialMermas().then((data) => {
      setMermas(data);
      setCargando(false);
    });
  }, []);

  return (
    <Modal titulo="Historial de mermas" onCerrar={onClose} labelCancelar="Cerrar" ancho="sm">
      <p style={{ fontSize: 12, color: "var(--gray)", margin: "0 0 var(--space-3)" }}>
        Productos e insumos que no se restauraron al cancelar una venta porque
        ya se habían preparado o entregado.
      </p>

      {cargando ? (
        <p style={{ fontSize: 12, color: "var(--gray)" }}>Cargando…</p>
      ) : mermas.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--gray)" }}>
          No hay mermas registradas todavía — aparecen aquí cuando cancelas una
          venta marcando que el producto ya se preparó o entregó.
        </p>
      ) : (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {mermas.map((m) => (
            <div
              key={m.eCodMerma}
              style={{ padding: "8px 4px", borderBottom: "1px solid var(--border-default, #f5f5f5)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge variante={m.tTipo === "producto" ? "categoria" : "bajo"}>
                    {m.tTipo === "producto" ? "Producto" : "Insumo"}
                  </Badge>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.tNombreSnapshot}</span>
                </div>
                <span style={{ fontSize: 13 }}>
                  -{m.eCantidad}{m.tUnidadSnapshot ? ` ${m.tUnidadSnapshot}` : ""}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 2 }}>
                {new Date(m.fhCreateMerma).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
                {" · "}Venta #{m.eCodVenta.slice(-8).toUpperCase()}
                {m.tNombreEmpleado && ` · ${m.tNombreEmpleado}`}
                {m.tMotivo && ` · ${m.tMotivo}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

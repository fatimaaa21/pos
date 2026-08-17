"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { obtenerRecetaPresentacion } from "@/lib/actions/receta-insumos";
import type { RecetaInsumoConDatos } from "@/types";

interface Props {
  fkeCodPresentacion: string;
  nombrePresentacion: string;
  nombreProducto:      string;
  onClose: () => void;
}

// Solo lectura — sin inputs, sin botones de agregar/quitar/editar cantidad.
// Para cambios reales, se usa ModalRecetaPresentacion desde el ícono de editar.

export function ModalVerReceta({ fkeCodPresentacion, nombrePresentacion, nombreProducto, onClose }: Props) {
  const [receta, setReceta]   = useState<RecetaInsumoConDatos[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    obtenerRecetaPresentacion(fkeCodPresentacion).then((result) => {
      if (result.error) setError(result.error);
      setReceta(result.receta ?? []);
      setCargando(false);
    });
  }, [fkeCodPresentacion]);

  return (
    <Modal
      titulo={`Receta — ${nombreProducto} / ${nombrePresentacion}`}
      onCerrar={onClose}
      labelCancelar="Cerrar"
      error={error}
      ancho="sm"
    >
      {cargando ? (
        <p style={{ fontSize: 12, color: "var(--gray)" }}>Cargando receta…</p>
      ) : receta.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--gray)" }}>
          Esta presentación no tiene receta configurada — no se descuenta ningún insumo al venderla.
        </p>
      ) : (
        <div>
          {receta.map((item) => (
            <div
              key={item.eCodReceta}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderBottom: "1px solid var(--border-default, #eee)",
              }}
            >
              <span style={{ fontSize: 13 }}>{item.tNombreInsumo}</span>
              <span style={{ fontSize: 13, color: "var(--gray)" }}>
                {item.eCantidadNecesaria} {item.tUnidadReceta}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
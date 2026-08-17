"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalInfo } from "@/components/ui/Modal";
import { ajustarStockInsumo } from "@/lib/actions/insumos";
import type { InsumoConStock } from "@/types";

interface Props {
  insumo:     InsumoConStock;
  onClose:    () => void;
  onAjustado: (insumo: InsumoConStock) => void;
}

// Ajuste manual: positivo para compra nueva, negativo para merma o
// corrección de conteo. Toca solo insumos_stock — el maestro no participa.
// El motivo es obligatorio: queda en historial_ajustes_insumos para poder
// auditar después por qué cambió el número.

export function ModalAjustarStockInsumo({ insumo, onClose, onAjustado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [eCantAgregar, setECantAgregar] = useState("");
  const [tMotivo, setTMotivo] = useState("");

  const cantidadNum = parseFloat(eCantAgregar);
  const resultante = isNaN(cantidadNum) ? insumo.eCantidadStock : insumo.eCantidadStock + cantidadNum;

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("eCodInsumoStock", insumo.eCodInsumoStock);
    fd.append("eCantAgregar", eCantAgregar);
    fd.append("tMotivo", tMotivo.trim());

    const result = await ajustarStockInsumo(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.insumo) {
      onAjustado(result.insumo);
    }
  }

  const deshabilitado =
    !eCantAgregar.trim() || isNaN(cantidadNum) || cantidadNum === 0 || resultante < 0 || !tMotivo.trim();

  return (
    <Modal
      titulo={`Ajustar stock — ${insumo.tNombre}`}
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Aplicar ajuste"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalInfo>
        Stock actual: {insumo.eCantidadStock.toLocaleString("es-MX")} {insumo.tUnidadReceta}
      </ModalInfo>

      <ModalField label={`Cantidad a sumar o restar (${insumo.tUnidadReceta})`} required>
        <ModalInput
          type="number"
          step="0.01"
          placeholder="Ej. 5000 (compra) o -200 (merma)"
          value={eCantAgregar}
          onChange={(e) => setECantAgregar(e.target.value)}
          autoFocus
        />
      </ModalField>

      {eCantAgregar.trim() && !isNaN(cantidadNum) && (
        <ModalInfo>
          Stock resultante: {resultante.toLocaleString("es-MX")} {insumo.tUnidadReceta}
          {resultante < 0 && " — no puede quedar en negativo"}
        </ModalInfo>
      )}

      <ModalField label="Motivo del ajuste" required>
        <ModalInput
          type="text"
          placeholder="Ej. Merma por producto vencido, corrección de conteo físico..."
          value={tMotivo}
          onChange={(e) => setTMotivo(e.target.value)}
        />
      </ModalField>
    </Modal>
  );
}
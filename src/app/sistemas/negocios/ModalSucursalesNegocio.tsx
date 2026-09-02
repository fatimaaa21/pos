"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { actualizarMaxSucursales } from "@/lib/actions/sistemas";
import type { NegocioConAdmin } from "./NegociosClient";

interface Props {
  negocio: NegocioConAdmin;
  onClose: () => void;
  onActualizado: (negocio: NegocioConAdmin) => void;
}

export function ModalSucursalesNegocio({ negocio, onClose, onActualizado }: Props) {
  const [valor, setValor]     = useState(String(negocio.eMaxSucursales));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleConfirmar() {
    const nuevoMax = parseInt(valor, 10);
    setLoading(true);
    setError(null);

    const result = await actualizarMaxSucursales(negocio.eCodCompany, nuevoMax);

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    onActualizado({ ...negocio, eMaxSucursales: result.eMaxSucursales });
  }

  const numero = parseInt(valor, 10);
  const deshabilitado = valor.trim() === "" || !Number.isInteger(numero) || numero < 1;

  return (
    <Modal
      titulo={`Sucursales — ${negocio.tNameCompany}`}
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Guardar"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Máximo de sucursales" required>
        <ModalInput
          type="number"
          min={1}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoFocus
        />
      </ModalField>
      <p style={{ fontSize: 12, color: "var(--gray)", margin: "8px 0 0" }}>
        Súbelo solo después de confirmar el pago fuera de la app (WhatsApp). Bajarlo no desactiva sucursales existentes, solo bloquea altas nuevas.
      </p>
    </Modal>
  );
}
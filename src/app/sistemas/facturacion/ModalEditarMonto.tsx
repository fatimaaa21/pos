"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { guardarMontoMensual } from "@/lib/actions/facturacion";
import type { NegocioConFacturacion } from "./FacturacionClient";

interface Props {
  negocio:    NegocioConFacturacion;
  onClose:    () => void;
  onGuardado: (negocio: NegocioConFacturacion) => void;
}

export function ModalEditarMonto({ negocio, onClose, onGuardado }: Props) {
  const [monto, setMonto]     = useState(
    negocio.eMontoMensual != null ? String(negocio.eMontoMensual) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const montoNumero = parseFloat(monto);
  const deshabilitado = monto.trim() === "" || isNaN(montoNumero) || montoNumero < 0;

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const result = await guardarMontoMensual(negocio.eCodCompany, montoNumero);

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    onGuardado({
      ...negocio,
      eMontoMensual:          result.facturacion.eMontoMensual,
      eMontoMensualPendiente: result.facturacion.eMontoMensualPendiente,
      tEstadoDomiciliacion:   result.facturacion.tEstadoDomiciliacion,
    });
  }

  const yaDomiciliado = negocio.tEstadoDomiciliacion === "domiciliado";

  return (
    <Modal
      titulo={`Pago mensual — ${negocio.tNameCompany}`}
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar={loading ? "Guardando..." : "Guardar"}
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Monto mensual (MXN)" required>
        <ModalInput
          type="number"
          placeholder="0.00"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          autoFocus
        />
      </ModalField>
      <p style={{ fontSize: 12, color: "var(--gray)", margin: 0 }}>
        {yaDomiciliado
          ? "Este negocio ya está domiciliado. El cambio no se cobra de inmediato — entra en vigor hasta el siguiente ciclo de cobro."
          : negocio.tEstadoDomiciliacion === "manual" || negocio.eMontoMensual != null
          ? "El admin todavía no domicilia tarjeta. En cuanto lo haga, se activa la suscripción con este monto."
          : "Por ahora este negocio no tiene domiciliación. Este monto queda listo para cuando el admin domicilie su tarjeta."}
      </p>
    </Modal>
  );
}
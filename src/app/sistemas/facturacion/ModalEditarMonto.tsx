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
  const [dia, setDia]         = useState(
    negocio.eDiaCobro != null ? String(negocio.eDiaCobro) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const montoNumero = parseFloat(monto);
  const diaNumero    = dia.trim() === "" ? null : parseInt(dia, 10);
  const diaInvalido  = diaNumero != null && (!Number.isInteger(diaNumero) || diaNumero < 1 || diaNumero > 28);
  const deshabilitado = monto.trim() === "" || isNaN(montoNumero) || montoNumero < 0 || diaInvalido;

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const result = await guardarMontoMensual(negocio.eCodCompany, montoNumero, diaNumero);

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    onGuardado({
      ...negocio,
      eMontoMensual:          result.facturacion.eMontoMensual,
      eMontoMensualPendiente: result.facturacion.eMontoMensualPendiente,
      eDiaCobro:              result.facturacion.eDiaCobro,
      eDiaCobroPendiente:     result.facturacion.eDiaCobroPendiente,
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
      <ModalField label="Día de cobro (1-28)">
        <ModalInput
          type="number"
          placeholder="Sin preferencia"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
          min={1}
          max={28}
        />
      </ModalField>
      <p style={{ fontSize: 12, color: "var(--gray)", margin: 0 }}>
        {yaDomiciliado
          ? "Este negocio ya está domiciliado. Ningún cambio se aplica de inmediato — ambos entran en vigor hasta el siguiente ciclo de cobro."
          : negocio.tEstadoDomiciliacion === "manual" || negocio.eMontoMensual != null
          ? "El admin todavía no domicilia tarjeta. En cuanto lo haga, se activa la suscripción con este monto y este día."
          : "Por ahora este negocio no tiene domiciliación. Esto queda listo para cuando el admin domicilie su tarjeta. Deja el día en blanco si no importa cuál sea."}
      </p>
    </Modal>
  );
}
"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { obtenerHistorialCobrosSistemas, type CobroHistorial } from "@/lib/actions/facturacion";
import type { NegocioConFacturacion } from "./FacturacionClient";

interface Props {
  negocio: NegocioConFacturacion;
  onClose: () => void;
}

const fmtMoneda = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

export function ModalHistorialCobros({ negocio, onClose }: Props) {
  const [cobros, setCobros] = useState<CobroHistorial[] | null>(null);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    obtenerHistorialCobrosSistemas(negocio.eCodCompany).then((r) => {
      if ("error" in r) setError(r.error);
      else setCobros(r.cobros);
    });
  }, [negocio.eCodCompany]);

  return (
    <Modal titulo={`Historial de cobros — ${negocio.tNameCompany}`} onCerrar={onClose} ancho="sm" sinFooter>
      {error && <p style={{ fontSize: 13, color: "var(--color-error)" }}>{error}</p>}

      {!error && cobros === null && (
        <p style={{ fontSize: 13, color: "var(--gray)" }}>Cargando...</p>
      )}

      {!error && cobros?.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--gray)" }}>
          Todavía no hay cobros registrados para este negocio.
        </p>
      )}

      {!error && cobros && cobros.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
          {cobros.map((c) => (
            <div
              key={c.eCodCobro}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                padding: "10px 12px", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtMoneda(c.eMonto)}</div>
                <div style={{ fontSize: 11, color: "var(--gray)" }}>{fmtFecha(c.fhCobro)}</div>
                {c.tEstado === "failed" && c.tMotivoFallo && (
                  <div style={{ fontSize: 11, color: "var(--color-error)", marginTop: 2 }}>{c.tMotivoFallo}</div>
                )}
              </div>
              <Badge variante={c.tEstado === "succeeded" ? "activo" : "error"}>
                {c.tEstado === "succeeded" ? "Pagado" : "Fallido"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
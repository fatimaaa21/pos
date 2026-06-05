"use client";
// src/components/ui/ModalCancelarVenta.tsx

import { useState }              from "react";
import { AlertTriangle }         from "lucide-react";
import { Modal, ModalField }     from "@/components/ui/Modal";

interface Props {
  folio:       string;
  total:       number;
  onConfirmar: (motivo: string) => Promise<{ error?: string } | void>;
  onCerrar:    () => void;
}

export function ModalCancelarVenta({ folio, total, onConfirmar, onCerrar }: Props) {
  const [motivo,  setMotivo]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleConfirmar() {
    if (!motivo.trim()) { setError("El motivo es requerido"); return; }
    setLoading(true);
    setError(null);
    const result = await onConfirmar(motivo.trim());
    setLoading(false);
    if (result && "error" in result && result.error) setError(result.error);
  }

  return (
    <Modal
      titulo="Cancelar venta"
      onCerrar={onCerrar}
      onConfirmar={handleConfirmar}
      labelConfirmar="Sí, cancelar venta"
      labelCancelar="Volver"
      varianteConfirmar="peligro"
      cargando={loading}
      deshabilitado={!motivo.trim()}
      error={error}
      ancho="sm"
    >
      {/* Aviso de acción irreversible */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
        padding: "var(--space-3) var(--space-4)",
        background: "var(--color-error-bg)",
        border: "1px solid var(--color-error-border)",
        borderRadius: "var(--radius-md)",
      }}>
        <AlertTriangle
          size={18}
          style={{ color: "var(--color-error)", flexShrink: 0, marginTop: 1 }}
        />
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--color-error)" }}>
            Esta acción no se puede deshacer
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--color-error)", opacity: 0.85 }}>
            Se cancelará la venta{" "}
            <strong>#{folio}</strong> por{" "}
            <strong>
              {total.toLocaleString("es-MX", {
                style: "currency", currency: "MXN",
              })}
            </strong>{" "}
            y se restaurará el inventario automáticamente.
          </p>
        </div>
      </div>

      {/* Motivo */}
      <ModalField label="Motivo de cancelación" required>
        <textarea
          style={{
            width: "100%",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "10px var(--space-3)",
            fontFamily: "var(--font-family)",
            fontSize: 13,
            color: "var(--dark)",
            resize: "vertical",
            outline: "none",
            minHeight: 80,
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--color-error)")}
          onBlur={(e)  => (e.target.style.borderColor = "var(--border-default)")}
          placeholder="Ej. El cliente se equivocó en el pedido, cobro incorrecto..."
          value={motivo}
          onChange={(e) => { setMotivo(e.target.value); setError(null); }}
          autoFocus
        />
      </ModalField>
    </Modal>
  );
}
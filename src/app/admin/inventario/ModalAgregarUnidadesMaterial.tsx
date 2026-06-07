"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalInfo } from "@/components/ui/Modal";
import { editarMaterial } from "@/lib/actions/materiales";
import { Package } from "lucide-react";
import type { Material } from "@/types";

interface Props {
  material:  Material;
  onClose:   () => void;
  onEditado: (material: Material) => void;
}

export function ModalAgregarUnidadesMaterial({ material, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [cantAgregar, setCantAgregar] = useState("");

  const unidad    = material.tipo_material === "rollo" ? "metros lineales" : "hojas";
  const unidadCorta = material.tipo_material === "rollo" ? "m" : "hojas";
  const cantidad  = parseFloat(cantAgregar) || 0;
  const nuevaExistencia = material.eMetrosLineales + cantidad;
  const [stockMinimo, setStockMinimo] = useState(material.eStockMinimo.toString());

  async function handleConfirmar() {
    if (cantidad <= 0) return;
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("eCodMaterial",    material.eCodMaterial);
    fd.append("tNombre",         material.tNombre);
    fd.append("tipo_material",   material.tipo_material);
    fd.append("eMetrosLineales", nuevaExistencia.toString());
    fd.append("eStockMinimo", stockMinimo || "0");
    if (material.eAnchoCm) fd.append("eAnchoCm", material.eAnchoCm.toString());

    const result = await editarMaterial(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.material) {
      onEditado(result.material);
    }
  }

  return (
    <Modal
      titulo="Agregar unidades"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Agregar"
      cargando={loading}
      deshabilitado={cantidad <= 0}
      error={error}
      ancho="sm"
    >
      {/* Preview del material */}
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-3)",
        padding: "var(--space-3)",
        background: "var(--color-primary-50)",
        border: "1px solid var(--color-primary-light)",
        borderRadius: "var(--radius-md)",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "var(--radius-md)",
          background: "white", border: "1px solid var(--border-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <IconoMaterial />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
            {material.tNombre}
          </div>
          <div style={{ fontSize: 12, color: "var(--gray)" }}>
            {material.tipo_material === "rollo"
              ? `Rollo · ${material.eAnchoCm} cm de ancho`
              : "Hojas"}
          </div>
        </div>
      </div>

      {/* Existencia actual */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)",
      }}>
        {[
          { label: "Existencia actual", valor: material.eMetrosLineales, color: "var(--color-primary)" },
          { label: "Stock mínimo",      valor: material.eStockMinimo,    color: "var(--gray)"          },
        ].map(({ label, valor, color }) => (
          <div key={label} style={{
            background: "var(--background)", borderRadius: "var(--radius-md)",
            padding: "var(--space-3)", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{valor}</div>
            <div style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <ModalField label={`Cantidad a agregar (${unidadCorta})`} required>
        <ModalInput
          type="number"
          min={0.01}
          step={material.tipo_material === "rollo" ? 0.01 : 1}
          placeholder={material.tipo_material === "rollo" ? "Ej. 25" : "Ej. 100"}
          value={cantAgregar}
          onChange={(e) => setCantAgregar(e.target.value)}
          autoFocus
        />
      </ModalField>

      <ModalField label="Stock mínimo">
        <ModalInput
            type="number"
            min={0}
            step={material.tipo_material === "rollo" ? 0.01 : 1}
            placeholder="Ej. 5"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
        />
    </ModalField>

      {cantidad > 0 && (
        <ModalInfo>
            <Package size={16} />
            Quedará con {nuevaExistencia.toFixed(
            material.tipo_material === "rollo" ? 2 : 0
            )} {unidadCorta} en existencia
            {parseFloat(stockMinimo) > 0
            ? ` · mínimo ${stockMinimo} ${unidadCorta}`
            : ""}.
        </ModalInfo>
        )}
    </Modal>
  );
}

function IconoMaterial() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="var(--color-primary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  );
}
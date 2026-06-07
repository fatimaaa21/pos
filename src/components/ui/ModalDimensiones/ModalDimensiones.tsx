"use client";

import { useEffect, useState } from "react";
import { Ruler } from "lucide-react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import type { Material, Producto, ProductoConStock } from "@/types";

interface Props {
  producto:   ProductoConStock;
  materiales: Material[];
  onConfirmar: (datos: {
    anchoCm:         number;
    largoCm:         number;
    material:        Material;
    metrosConsumidos: number;
    precioCalculado: number;
  }) => void;
  onCerrar: () => void;
}

export function ModalDimensiones({ producto, materiales, onConfirmar, onCerrar }: Props) {
  const [anchoCm, setAnchoCm] = useState("");
  const [largoCm, setLargoCm] = useState("");
  const [materialId, setMaterialId] = useState("");

  const ancho = parseFloat(anchoCm) || 0;
  const largo = parseFloat(largoCm) || 0;

  // Filtrar materiales compatibles: ancho del rollo >= ancho pedido Y con metros disponibles
  const materialesCompatibles = materiales.filter(
    (m) =>
      m.bStateMaterial &&
      m.tipo_material === "rollo" &&
      m.eMetrosLineales > 0 &&
      (m.eAnchoCm ?? 0) >= ancho * 100  // ancho pedido en cm vs ancho rollo en cm
  );

  // Si no hay dimensiones ingresadas aún mostrar todos los activos de tipo rollo
  const materialesMostrados =
    ancho > 0
      ? materialesCompatibles
      : materiales.filter((m) => m.bStateMaterial && m.tipo_material === "rollo");

  const sinMateriales = ancho > 0 && materialesCompatibles.length === 0;

  // Limpiar selección si el material elegido ya no es compatible
  useEffect(() => {
    if (materialId && !materialesCompatibles.find((m) => m.eCodMaterial === materialId)) {
      setMaterialId("");
    }
  }, [ancho]);

  const materialSeleccionado = materiales.find((m) => m.eCodMaterial === materialId);

  // Cálculo
  const areaM2          = ancho * largo;
  const metrosConsumidos = largo; // se consume largo metros lineales del rollo
  const precioCalculado = areaM2 * (producto.ePrecioM2 ?? 0);

  const deshabilitado =
    ancho <= 0      ||
    largo <= 0      ||
    !materialId     ||
    sinMateriales;

  function handleConfirmar() {
    if (!materialSeleccionado) return;
    onConfirmar({
      anchoCm:          ancho,
      largoCm:          largo,
      material:         materialSeleccionado,
      metrosConsumidos,
      precioCalculado,
    });
  }

  return (
    <Modal
      titulo={`Medidas — ${producto.tNameProduct}`}
      onCerrar={onCerrar}
      onConfirmar={handleConfirmar}
      labelConfirmar="Agregar al pedido"
      labelCancelar="Cancelar"
      deshabilitado={deshabilitado}
      ancho="sm"
    >
      {/* Precio por m² del producto */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "var(--space-3) var(--space-4)",
        background: "var(--color-primary-50)",
        border: "1px solid var(--color-primary-light)",
        borderRadius: "var(--radius-md)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Ruler size={16} color="var(--color-primary)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-primary-dark)" }}>
            Precio por m²
          </span>
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--color-primary-dark)" }}>
          {(producto.ePrecioM2 ?? 0).toLocaleString("es-MX", {
            style: "currency", currency: "MXN",
          })}
        </span>
      </div>

      {/* Dimensiones */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <ModalField label="Ancho (m)" required>
          <ModalInput
            type="number"
            min={0.01}
            step={0.01}
            placeholder="Ej. 1.5"
            value={anchoCm}
            onChange={(e) => setAnchoCm(e.target.value)}
            autoFocus
          />
        </ModalField>
        <ModalField label="Largo (m)" required>
          <ModalInput
            type="number"
            min={0.01}
            step={0.01}
            placeholder="Ej. 2"
            value={largoCm}
            onChange={(e) => setLargoCm(e.target.value)}
          />
        </ModalField>
      </div>

      {/* Preview del cálculo */}
      {ancho > 0 && largo > 0 && (
        <div style={{
          display: "flex", flexDirection: "column", gap: "var(--space-1)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--background)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-md)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "var(--gray)" }}>Área</span>
            <span style={{ fontWeight: 600 }}>{areaM2.toFixed(2)} m²</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "var(--gray)" }}>Metros lineales a consumir</span>
            <span style={{ fontWeight: 600 }}>{metrosConsumidos.toFixed(2)} m</span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 14, fontWeight: 800,
            borderTop: "1px solid var(--border-light)",
            paddingTop: "var(--space-2)", marginTop: "var(--space-1)",
          }}>
            <span style={{ color: "var(--dark)" }}>Precio estimado</span>
            <span style={{ color: "var(--color-primary-dark)" }}>
              {precioCalculado.toLocaleString("es-MX", {
                style: "currency", currency: "MXN",
              })}
            </span>
          </div>
        </div>
      )}

      {/* Selección de material */}
      <ModalField label="Material a usar" required>
        {sinMateriales ? (
          <div style={{
            padding: "var(--space-3) var(--space-4)",
            background: "var(--color-error-bg)",
            border: "1px solid var(--color-error-border)",
            borderRadius: "var(--radius-md)",
            fontSize: 13, fontWeight: 600, color: "var(--color-error)",
          }}>
            No hay materiales disponibles con ancho ≥ {ancho * 100} cm.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {materialesMostrados.map((m) => {
              const seleccionado = m.eCodMaterial === materialId;
              const stockColor =
                m.eMetrosLineales <= 0                                       ? "var(--color-error)"   :
                m.eStockMinimo > 0 && m.eMetrosLineales <= m.eStockMinimo    ? "var(--color-warning)" :
                "var(--color-success)";
              return (
                <button
                  key={m.eCodMaterial}
                  type="button"
                  onClick={() => setMaterialId(m.eCodMaterial)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "var(--space-3) var(--space-4)",
                    border: `1.5px solid ${seleccionado ? "var(--color-primary)" : "var(--border-default)"}`,
                    borderRadius: "var(--radius-md)",
                    background: seleccionado ? "var(--color-primary-50)" : "white",
                    cursor: "pointer", transition: "all 0.15s",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
                      {m.tNombre}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--gray)" }}>
                      Ancho: {m.eAnchoCm} cm
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: stockColor }}>
                    {m.eMetrosLineales} m disponibles
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </ModalField>
    </Modal>
  );
}
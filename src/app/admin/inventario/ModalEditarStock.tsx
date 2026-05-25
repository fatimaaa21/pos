"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalInfo } from "@/components/ui/Modal";
import { editarStock } from "@/lib/actions/inventario";
import { Package } from "lucide-react";
import type { InventarioConProducto } from "./InventarioClient";

interface Props {
  inventario: InventarioConProducto;
  onClose: () => void;
  onEditado: (actualizado: InventarioConProducto) => void;
}

export function ModalEditarStock({ inventario, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [form, setForm]       = useState({
    eCantAgregar: "",
    eStockMinimo: (inventario.eStockMinimo ?? 0).toString(),
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("eCodInventory", inventario.eCodInventory);
    formData.append("eCantAgregar",  form.eCantAgregar);
    formData.append("eStockMinimo",  form.eStockMinimo);

    const result = await editarStock(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.inventario) {
      onEditado({ ...inventario, ...result.inventario });
    }
  }

  const cantAgregar    = parseFloat(form.eCantAgregar) || 0;
  const nuevasCantidad = (inventario.eCantIngresada ?? 0) + cantAgregar;
  const nuevosRestantes = (inventario.eCantRestante ?? 0) + cantAgregar;
  const deshabilitado  = cantAgregar <= 0;

  return (
    <Modal
      titulo="Agregar unidades"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Agregar unidades"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
    >
      {/* Preview del producto */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        background: "var(--color-primary-50)",
        border: "1px solid var(--color-primary-light)",
        borderRadius: "var(--radius-md)",
      }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: "var(--radius-md)",
          background: "white",
          border: "1px solid var(--border-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", flexShrink: 0,
        }}>
          {inventario.productos?.ImgProduct ? (
            <img
              src={inventario.productos.ImgProduct}
              alt={inventario.productos.tNameProduct}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : <span style={{ fontSize: 18 }}>📦</span>}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
            {inventario.productos?.tNameProduct ?? "—"}
          </div>
          <div style={{ fontSize: 12, color: "var(--gray)" }}>
            {inventario.productos?.categorias?.tNameCategory ?? "Sin categoría"}
          </div>
        </div>
      </div>

      {/* Stock actual */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-2)" }}>
        {[
          { label: "Ingresadas", valor: inventario.eCantIngresada ?? 0, color: "var(--dark)" },
          { label: "Vendidas",   valor: inventario.eCantVendida ?? 0,   color: "var(--gray)" },
          { label: "Restantes",  valor: inventario.eCantRestante ?? 0,  color: "var(--color-primary)" },
        ].map(({ label, valor, color }) => (
          <div key={label} style={{
            background: "var(--background)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-2) var(--space-3)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{valor}</div>
            <div style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      <ModalField label="Unidades a agregar" required>
        <ModalInput
          type="number"
          min={1}
          placeholder="Ej. 20"
          value={form.eCantAgregar}
          onChange={(e) => setForm({ ...form, eCantAgregar: e.target.value })}
          autoFocus
        />
      </ModalField>

      <ModalField label="Stock mínimo" required>
        <ModalInput
          type="number"
          min={0}
          placeholder="Ej. 5"
          value={form.eStockMinimo}
          onChange={(e) => setForm({ ...form, eStockMinimo: e.target.value })}
        />
      </ModalField>

      {cantAgregar > 0 && (
        <ModalInfo>
          <Package size={18} />
          Quedará con {nuevosRestantes} restantes de {nuevasCantidad} ingresadas en total.
        </ModalInfo>
      )}
    </Modal>
  );
}
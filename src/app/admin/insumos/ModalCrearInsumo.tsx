"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import { crearInsumo } from "@/lib/actions/insumos";
import type { InsumoConStock } from "@/types";

interface Props {
  onClose:        () => void;
  onCreado:       (insumo: InsumoConStock) => void;
  fkeCodSucursal: string | null; // null = admin con "todas las sucursales", requiere elegir
  sucursales:     { eCodSucursal: string; tNombre: string }[];
}

export function ModalCrearInsumo({ onClose, onCreado, fkeCodSucursal: sucursalProp, sucursales }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState(sucursalProp ?? "");
  const [form, setForm] = useState({
    tNombre:           "",
    tUnidadCompra:     "kg",
    tUnidadReceta:     "g",
    eFactorConversion: "1000", // default sensato para kg -> g
    eCostoUnitario:    "",
    eCantidadStock:    "0",
    eStockMinimo:      "0",
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("fkeCodSucursal",    sucursalSeleccionada);
    fd.append("tNombre",           form.tNombre);
    fd.append("tUnidadCompra",     form.tUnidadCompra);
    fd.append("tUnidadReceta",     form.tUnidadReceta);
    fd.append("eFactorConversion", form.eFactorConversion);
    fd.append("eCostoUnitario",    form.eCostoUnitario || "0");
    fd.append("eCantidadStock",    form.eCantidadStock || "0");
    fd.append("eStockMinimo",      form.eStockMinimo || "0");

    const result = await crearInsumo(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.insumo) {
      onCreado(result.insumo);
    }
  }

  const deshabilitado =
    !sucursalSeleccionada           ||
    !form.tNombre.trim()            ||
    !form.tUnidadCompra.trim()      ||
    !form.tUnidadReceta.trim()      ||
    !form.eFactorConversion.trim()  ||
    isNaN(parseFloat(form.eFactorConversion)) ||
    parseFloat(form.eFactorConversion) <= 0;

  return (
    <Modal
      titulo="Nuevo insumo"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Agregar insumo"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      {!sucursalProp && (
        <ModalField label="Sucursal" required>
          <ModalSelect
            value={sucursalSeleccionada}
            onChange={(e) => setSucursalSeleccionada(e.target.value)}
          >
            <option value="">Seleccionar sucursal...</option>
            {sucursales.map((s) => (
              <option key={s.eCodSucursal} value={s.eCodSucursal}>
                {s.tNombre}
              </option>
            ))}
          </ModalSelect>
        </ModalField>
      )}

      <ModalField label="Nombre del insumo" required>
        <ModalInput
          type="text"
          placeholder="Ej. Queso Oaxaca"
          value={form.tNombre}
          onChange={(e) => setForm({ ...form, tNombre: e.target.value })}
          autoFocus
        />
      </ModalField>

      <div style={{ display: "flex", gap: 12 }}>
        <ModalField label="Unidad de compra" required>
          <ModalSelect
            value={form.tUnidadCompra}
            onChange={(e) => setForm({ ...form, tUnidadCompra: e.target.value })}
          >
            <option value="kg">Kilogramo (kg)</option>
            <option value="l">Litro (l)</option>
            <option value="pza">Pieza (pza)</option>
            <option value="paquete">Paquete</option>
          </ModalSelect>
        </ModalField>

        <ModalField label="Unidad de receta" required>
          <ModalSelect
            value={form.tUnidadReceta}
            onChange={(e) => setForm({ ...form, tUnidadReceta: e.target.value })}
          >
            <option value="g">Gramo (g)</option>
            <option value="ml">Mililitro (ml)</option>
            <option value="pza">Pieza (pza)</option>
          </ModalSelect>
        </ModalField>
      </div>

      <ModalField label="Factor de conversión" required>
        <ModalInput
          type="number"
          step="0.01"
          placeholder="Ej. 1000"
          value={form.eFactorConversion}
          onChange={(e) => setForm({ ...form, eFactorConversion: e.target.value })}
        />
      </ModalField>
      <ModalInfo>
        1 {form.tUnidadCompra} de compra = {form.eFactorConversion || "?"} {form.tUnidadReceta} en receta
      </ModalInfo>

      <ModalField label="Costo por unidad de compra">
        <ModalInput
          type="number"
          step="0.01"
          placeholder="Ej. 180.00"
          value={form.eCostoUnitario}
          onChange={(e) => setForm({ ...form, eCostoUnitario: e.target.value })}
        />
      </ModalField>

      <div style={{ display: "flex", gap: 12 }}>
        <ModalField label={`Stock inicial (${form.tUnidadReceta})`}>
          <ModalInput
            type="number"
            step="0.01"
            placeholder="0"
            value={form.eCantidadStock}
            onChange={(e) => setForm({ ...form, eCantidadStock: e.target.value })}
          />
        </ModalField>

        <ModalField label={`Stock mínimo (${form.tUnidadReceta})`}>
          <ModalInput
            type="number"
            step="0.01"
            placeholder="0"
            value={form.eStockMinimo}
            onChange={(e) => setForm({ ...form, eStockMinimo: e.target.value })}
          />
        </ModalField>
      </div>
    </Modal>
  );
}
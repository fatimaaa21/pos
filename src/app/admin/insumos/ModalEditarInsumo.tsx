"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import { editarInsumo } from "@/lib/actions/insumos";
import type { InsumoConStock } from "@/types";

interface Props {
  insumo:    InsumoConStock;
  onClose:   () => void;
  onEditado: (insumo: InsumoConStock) => void;
}

export function ModalEditarInsumo({ insumo, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [form, setForm] = useState({
    tNombre:           insumo.tNombre,
    tUnidadCompra:     insumo.tUnidadCompra,
    tUnidadReceta:     insumo.tUnidadReceta,
    eFactorConversion: String(insumo.eFactorConversion),
    eCostoUnitario:    String(insumo.eCostoUnitario),
    eStockMinimo:      String(insumo.eStockMinimo),
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("eCodInsumoMaestro",  insumo.eCodInsumoMaestro);
    fd.append("eCodInsumoStock",    insumo.eCodInsumoStock);
    fd.append("tNombre",            form.tNombre);
    fd.append("tUnidadCompra",      form.tUnidadCompra);
    fd.append("tUnidadReceta",      form.tUnidadReceta);
    fd.append("eFactorConversion",  form.eFactorConversion);
    fd.append("eCostoUnitario",     form.eCostoUnitario || "0");
    fd.append("eStockMinimo",       form.eStockMinimo || "0");

    const result = await editarInsumo(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.insumo) {
      onEditado(result.insumo);
    }
  }

  const deshabilitado =
    !form.tNombre.trim() ||
    !form.eFactorConversion.trim() ||
    isNaN(parseFloat(form.eFactorConversion)) ||
    parseFloat(form.eFactorConversion) <= 0;

  return (
    <Modal
      titulo="Editar insumo"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Guardar cambios"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalInfo>
        ⚠️ Nombre, unidades y factor de conversión son compartidos: si este
        insumo también está registrado en otra sucursal, cambiarlos aquí los
        cambia en todas.
      </ModalInfo>

      <ModalField label="Nombre del insumo" required>
        <ModalInput
          type="text"
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
          value={form.eFactorConversion}
          onChange={(e) => setForm({ ...form, eFactorConversion: e.target.value })}
        />
      </ModalField>
      <ModalInfo>
        1 {form.tUnidadCompra} de compra = {form.eFactorConversion || "?"} {form.tUnidadReceta} en receta.
        Cambiar esto no afecta ventas ya registradas.
      </ModalInfo>

      <hr style={{ margin: "16px 0", opacity: 0.2 }} />
      <ModalInfo>Lo siguiente aplica solo a esta sucursal:</ModalInfo>

      <ModalField label="Costo por unidad de compra">
        <ModalInput
          type="number"
          step="0.01"
          value={form.eCostoUnitario}
          onChange={(e) => setForm({ ...form, eCostoUnitario: e.target.value })}
        />
      </ModalField>

      <ModalField label={`Stock mínimo (${form.tUnidadReceta})`}>
        <ModalInput
          type="number"
          step="0.01"
          value={form.eStockMinimo}
          onChange={(e) => setForm({ ...form, eStockMinimo: e.target.value })}
        />
      </ModalField>
    </Modal>
  );
}
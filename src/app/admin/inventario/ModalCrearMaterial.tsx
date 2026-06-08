"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import { crearMaterial } from "@/lib/actions/materiales";
import { Ruler } from "lucide-react";
import type { Material } from "@/types";

interface Props {
  onClose:  () => void;
  onCreado: (material: Material) => void;
}

export function ModalCrearMaterial({ onClose, onCreado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [form, setForm] = useState({
    tNombre:         "",
    tipo_material:   "rollo" as "rollo" | "hoja",
    eAnchoCm:        "",
    eAltoCm:         "",
    eMetrosLineales: "",
    eStockMinimo:    "",
  });

  const esRollo = form.tipo_material === "rollo";

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("tNombre",         form.tNombre);
    fd.append("tipo_material",   form.tipo_material);
    fd.append("eMetrosLineales", form.eMetrosLineales);
    fd.append("eAnchoCm",        form.eAnchoCm);
    if (!esRollo) fd.append("eAltoCm", form.eAltoCm);
    fd.append("eStockMinimo", form.eStockMinimo || "0");

    const result = await crearMaterial(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.material) {
      onCreado(result.material);
    }
  }

  const deshabilitado =
    !form.tNombre.trim()          ||
    !form.eMetrosLineales.trim()  ||
    (esRollo  && !form.eAnchoCm.trim()) ||
    (!esRollo && (!form.eAnchoCm.trim() || !form.eAltoCm.trim()));

  return (
    <Modal
      titulo="Nuevo material"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Agregar material"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Nombre del material" required>
        <ModalInput
          type="text"
          placeholder="Ej. Lona vinílica mate"
          value={form.tNombre}
          onChange={(e) => setForm({ ...form, tNombre: e.target.value })}
          autoFocus
        />
      </ModalField>

      <ModalField label="Tipo de material" required>
        <ModalSelect
          value={form.tipo_material}
          onChange={(e) =>
            setForm({
              ...form,
              tipo_material: e.target.value as "rollo" | "hoja",
              eAnchoCm: "",
              eAltoCm:  "",
            })
          }
        >
          <option value="rollo">Rollo (lona, vinil...)</option>
          <option value="hoja">Hojas (papel, cartón...)</option>
        </ModalSelect>
      </ModalField>

      {esRollo ? (
        <ModalField label="Ancho del rollo (cm)" required>
          <ModalInput
            type="number"
            min={1}
            step={0.01}
            placeholder="Ej. 152"
            value={form.eAnchoCm}
            onChange={(e) => setForm({ ...form, eAnchoCm: e.target.value })}
          />
        </ModalField>
      ) : (
        <>
          <ModalField label="Ancho de la hoja (cm)" required>
            <ModalInput
              type="number"
              min={1}
              step={0.01}
              placeholder="Ej. 28"
              value={form.eAnchoCm}
              onChange={(e) => setForm({ ...form, eAnchoCm: e.target.value })}
            />
          </ModalField>
          <ModalField label="Alto de la hoja (cm)" required>
            <ModalInput
              type="number"
              min={1}
              step={0.01}
              placeholder="Ej. 21"
              value={form.eAltoCm}
              onChange={(e) => setForm({ ...form, eAltoCm: e.target.value })}
            />
          </ModalField>
        </>
      )}

      <ModalField
        label={esRollo ? "Metros lineales disponibles" : "Hojas disponibles"}
        required
      >
        <ModalInput
          type="number"
          min={1}
          step={esRollo ? 0.01 : 1}
          placeholder={esRollo ? "Ej. 50" : "Ej. 100"}
          value={form.eMetrosLineales}
          onChange={(e) => setForm({ ...form, eMetrosLineales: e.target.value })}
        />
      </ModalField>

      <ModalField label={esRollo ? "Stock mínimo (metros)" : "Stock mínimo (hojas)"} required>
            <ModalInput
                type="number"
                min={0}
                step={esRollo ? 0.01 : 1}
                placeholder="Ej. 5"
                value={form.eStockMinimo}
                onChange={(e) => setForm({ ...form, eStockMinimo: e.target.value })}
            />
        </ModalField>

      <ModalInfo>
        <Ruler size={16} />
        {esRollo
          ? "Los metros lineales se descontarán automáticamente con cada venta."
          : "Las hojas disponibles se descontarán según cuántas piezas del producto caben en cada hoja."}
      </ModalInfo>
    </Modal>
  );
}
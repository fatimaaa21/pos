"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect } from "@/components/ui/Modal";
import { editarMaterial } from "@/lib/actions/materiales";
import type { Material } from "@/types";

interface Props {
  material:  Material;
  onClose:   () => void;
  onEditado: (material: Material) => void;
}

export function ModalEditarMaterial({ material, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [form, setForm] = useState({
    tNombre:         material.tNombre,
    tipo_material:   material.tipo_material,
    eAnchoCm:        material.eAnchoCm?.toString() ?? "",
    eAltoCm:         material.eAltoCm?.toString()  ?? "",
    eMetrosLineales: material.eMetrosLineales.toString(),
    eStockMinimo: (material.eStockMinimo ?? 0).toString(),
  });

  const esRollo = form.tipo_material === "rollo";

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("eCodMaterial",    material.eCodMaterial);
    fd.append("tNombre",         form.tNombre);
    fd.append("tipo_material",   form.tipo_material);
    fd.append("eMetrosLineales", form.eMetrosLineales);
    fd.append("eAnchoCm",        form.eAnchoCm);
    if (!esRollo) fd.append("eAltoCm", form.eAltoCm);
    fd.append("eStockMinimo", form.eStockMinimo || "0");

    const result = await editarMaterial(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.material) {
      onEditado(result.material);
    }
  }

  const deshabilitado =
    !form.tNombre.trim() ||
    (esRollo  && !form.eAnchoCm.trim()) ||
    (!esRollo && (!form.eAnchoCm.trim() || !form.eAltoCm.trim()));

  return (
    <Modal
      titulo="Editar material"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Guardar cambios"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Nombre del material" required>
        <ModalInput
          type="text"
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
          min={0}
          step={esRollo ? 0.01 : 1}
          value={form.eMetrosLineales}
          onChange={(e) => setForm({ ...form, eMetrosLineales: e.target.value })}
        />
      </ModalField>

      <ModalField label={esRollo ? "Stock mínimo (metros)" : "Stock mínimo (hojas)"} required>
        <ModalInput
            type="number"
            min={0}
            step={esRollo ? 0.01 : 1}
            value={form.eStockMinimo}
            onChange={(e) => setForm({ ...form, eStockMinimo: e.target.value })}
        />
        </ModalField>
    </Modal>
  );
}
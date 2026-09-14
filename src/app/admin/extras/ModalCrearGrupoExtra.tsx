"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { crearGrupoExtra } from "@/lib/actions/extras";
import type { GrupoExtra } from "@/types";

interface Props {
  onClose:  () => void;
  onCreado: (grupo: GrupoExtra) => void;
}

export function ModalCrearGrupoExtra({ onClose, onCreado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [form, setForm] = useState({
    tNombreGrupo: "",
    bSeleccionMultiple: false,
    bRequerido: false,
    eSeleccionMinima: "",
    eSeleccionMaxima: "",
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("tNombreGrupo", form.tNombreGrupo.trim());
    fd.append("bSeleccionMultiple", String(form.bSeleccionMultiple));
    fd.append("bRequerido", String(form.bRequerido));
    if (form.bSeleccionMultiple) {
      if (form.eSeleccionMinima) fd.append("eSeleccionMinima", form.eSeleccionMinima);
      if (form.eSeleccionMaxima) fd.append("eSeleccionMaxima", form.eSeleccionMaxima);
    }

    const result = await crearGrupoExtra(fd);
    setLoading(false);

    if (result.error) { setError(result.error); return; }
    if (result.grupo) onCreado(result.grupo);
  }

  const deshabilitado = !form.tNombreGrupo.trim();

  return (
    <Modal
      titulo="Nuevo grupo de extras"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Crear grupo"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Nombre del grupo" required>
        <ModalInput
          type="text"
          placeholder="Ej. Tipo de leche"
          value={form.tNombreGrupo}
          onChange={(e) => setForm({ ...form, tNombreGrupo: e.target.value })}
          autoFocus
        />
      </ModalField>

      <div style={{ display: "flex", gap: "var(--space-4)", fontSize: 13 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={form.bSeleccionMultiple}
            onChange={(e) => setForm({ ...form, bSeleccionMultiple: e.target.checked })}
          />
          Selección múltiple
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={form.bRequerido}
            onChange={(e) => setForm({ ...form, bRequerido: e.target.checked })}
          />
          Requerido
        </label>
      </div>

      {form.bSeleccionMultiple && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
          <ModalField label="Mínimo a elegir">
            <ModalInput
              type="number" min={0} placeholder="Sin mínimo"
              value={form.eSeleccionMinima}
              onChange={(e) => setForm({ ...form, eSeleccionMinima: e.target.value })}
            />
          </ModalField>
          <ModalField label="Máximo a elegir">
            <ModalInput
              type="number" min={0} placeholder="Sin máximo"
              value={form.eSeleccionMaxima}
              onChange={(e) => setForm({ ...form, eSeleccionMaxima: e.target.value })}
            />
          </ModalField>
        </div>
      )}
    </Modal>
  );
}
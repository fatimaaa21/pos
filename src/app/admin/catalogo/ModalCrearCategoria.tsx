"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import { crearCategoria } from "@/lib/actions/categorias";
import type { Categoria } from "@/types";

interface Props {
  onClose: () => void;
  onCreado: (categoria: Categoria) => void;
}

export function ModalCrearCategoria({ onClose, onCreado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tNameCategory: "",
    ImgCategory: "",
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("tNameCategory", form.tNameCategory);
    formData.append("ImgCategory", form.ImgCategory);

    const result = await crearCategoria(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.categoria) {
      onCreado(result.categoria);
    }
  }

  const deshabilitado = !form.tNameCategory.trim() || !form.ImgCategory.trim();

  return (
    <Modal
      titulo="Nueva categoría"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Crear categoría"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
    >
      <ModalField label="Nombre de la categoría" required>
        <ModalInput
          type="text"
          placeholder="Ej. María García"
          value={form.tNameCategory}
          onChange={(e) => setForm({ ...form, tNameCategory: e.target.value })}
          autoFocus
        />
      </ModalField>

      <ModalField label="Imagen" required>
        <ModalInput
          type="text"
          placeholder="URL de la imagen"
          value={form.ImgCategory}
          onChange={(e) => setForm({ ...form, ImgCategory: e.target.value })}
        />
      </ModalField>

    </Modal>
  );
}
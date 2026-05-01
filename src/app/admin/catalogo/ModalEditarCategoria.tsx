"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { editarCategoria } from "@/lib/actions/categorias";
import type { Categoria } from "@/types";

interface Props {
  categoria: Categoria;
  onClose: () => void;
  onEditado: (categoria: Categoria) => void;
}

export function ModalEditarCategoria({ categoria, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tNameCategory: categoria.tNameCategory,
    ImgCategory: categoria.ImgCategory,
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("eCodCategory", categoria.eCodCategory);
    formData.append("tNameCategory", form.tNameCategory);
    formData.append("ImgCategory", form.ImgCategory);

    const result = await editarCategoria(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.categoria) {
      onEditado(result.categoria);
    }
  }

  const deshabilitado = !form.tNameCategory.trim() || !form.ImgCategory.trim();

  return (
    <Modal
      titulo="Editar categoría"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Guardar cambios"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
    >
      <ModalField label="Nombre de la categoría" required>
        <ModalInput
          type="text"
          value={form.tNameCategory}
          onChange={(e) => setForm({ ...form, tNameCategory: e.target.value })}
          autoFocus
        />
      </ModalField>

      <ModalField label="Imagen" required>
        <ModalInput
          type="text"
          value={form.ImgCategory}
          onChange={(e) => setForm({ ...form, ImgCategory: e.target.value })}
        />
      </ModalField>

    </Modal>
  );
}
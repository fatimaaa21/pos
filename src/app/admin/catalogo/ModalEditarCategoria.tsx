"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { editarCategoria } from "@/lib/actions/categorias";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";
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
    // URL limpia (sin ?t=...) para guardar en DB — el cache-buster lo maneja ImageUploadInput
    ImgCategory: categoria.ImgCategory?.split("?")[0] ?? "",
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

  const deshabilitado = !form.tNameCategory.trim();

  return (
    <Modal
      titulo="Editar categoría"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Guardar cambios"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Imagen">
        <ImageUploadInput
        value={form.ImgCategory}
        onChange={(url) => setForm((prev) => ({ ...prev, ImgCategory: url }))}
        placeholder="Subir imagen de categoría"
        bucket="category-images"
        storagePath={`categorias/${categoria.eCodCategory}`}
        />
      </ModalField>

      <ModalField label="Nombre de la categoría" required>
        <ModalInput
          type="text"
          value={form.tNameCategory}
          onChange={(e) => setForm((prev) => ({ ...prev, tNameCategory: e.target.value }))}
          autoFocus
        />
      </ModalField>
    </Modal>
  );
}
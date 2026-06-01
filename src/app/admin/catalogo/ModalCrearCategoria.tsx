"use client";

import { useId, useState } from "react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { crearCategoria } from "@/lib/actions/categorias";
import type { Categoria } from "@/types";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";

interface Props {
  onClose: () => void;
  onCreado: (categoria: Categoria) => void;
}

export function ModalCrearCategoria({ onClose, onCreado }: Props) {
  // ID único para el path del storage: evita colisiones entre creaciones simultáneas
  const uid = useId().replace(/:/g, "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tNameCategory: "",
    ImgCategory: "",   // se llenará con la URL pública tras el upload
  });

  async function handleConfirmar() {
    if (!form.ImgCategory) {
      setError("Por favor sube una imagen para la categoría.");
      return;
    }

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

  const deshabilitado = !form.tNameCategory.trim() || !form.ImgCategory;

  return (
    <Modal
      titulo="Nueva categoría"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Crear categoría"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
        <ModalField label="Imagen" required>
            {/* Sin eCodCategory aún → usamos timestamp como path temporal.
            // Después de crear, el path queda fijo en Storage aunque el nombre sea con timestamp.*/}
            <ImageUploadInput
            value={form.ImgCategory}
            onChange={(url) => setForm({ ...form, ImgCategory: url })}
            placeholder="Subir imagen de categoría"
            bucket="category-images"
            storagePath={`categorias/new_${Date.now()}`}   // temporal, se fija al subir
            />
      </ModalField>
      
      <ModalField label="Nombre de la categoría" required>
        <ModalInput
          type="text"
          placeholder="Ej. Pan Dulce"
          value={form.tNameCategory}
          onChange={(e) => setForm({ ...form, tNameCategory: e.target.value })}
          autoFocus
        />
      </ModalField>
    </Modal>
  );
}
"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { editarProducto } from "@/lib/actions/productos";
import type { Producto } from "@/types";

interface Props {
  producto: Producto;
  onClose: () => void;
  onEditado: (producto: Producto) => void;
}

export function ModalEditarProducto({ producto, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tNameProduct: producto.tNameProduct,
    bStateProduct: producto.bStateProduct,
    ImgProduct: producto.ImgProduct,
    
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("eCodProduct", producto.eCodProduct);
    formData.append("tNameProduct", form.tNameProduct);
    formData.append("bStateProduct", form.bStateProduct.toString());
    formData.append("ImgProduct", form.ImgProduct);
    const result = await editarProducto(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.producto) {
      onEditado(result.producto);
    }
  }

  const deshabilitado = !form.tNameProduct.trim() || !form.bStateProduct.toString().trim();

  return (
    <Modal
      titulo="Editar producto"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Guardar cambios"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
    >
      <ModalField label="Nombre del producto" required>
        <ModalInput
          type="text"
          value={form.tNameProduct}
          onChange={(e) => setForm({ ...form, tNameProduct: e.target.value })}
          autoFocus
        />
      </ModalField>

      <ModalField label="Imagen" required>
        <ModalInput
          type="text"
          value={form.ImgProduct}
          onChange={(e) => setForm({ ...form, ImgProduct: e.target.value })}
        />
      </ModalField>

    </Modal>
  );
}
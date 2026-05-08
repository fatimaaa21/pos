"use client";

import { useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect } from "@/components/ui/Modal";
import { editarProducto } from "@/lib/actions/productos";
import type { Categoria, Producto } from "@/types";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";

interface Props {
  producto: Producto;
  categorias: Categoria[];
  onClose: () => void;
  onEditado: (producto: Producto) => void;
}

export function ModalEditarProducto({ producto, categorias, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    tNameProduct: producto.tNameProduct,
    ImgProduct: producto.ImgProduct?.split("?")[0] ?? "",
    ePriceProduct: producto.ePriceProduct.toString(),
    eCostProduct: producto.eCostProduct.toString(),
    fkeCodCategory: producto.fkeCodCategory
      ? typeof producto.fkeCodCategory === "object"
        ? (producto.fkeCodCategory as any).eCodCategory
        : producto.fkeCodCategory
      : "",
  });

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("eCodProduct", producto.eCodProduct);
    formData.append("tNameProduct", form.tNameProduct);
    formData.append("ImgProduct", form.ImgProduct);
    formData.append("ePriceProduct", form.ePriceProduct);
    formData.append("eCostProduct", form.eCostProduct);
    formData.append("fkeCodCategory", form.fkeCodCategory);

    const result = await editarProducto(formData);

    console.log("[ModalEditarProducto] resultado servidor:", result);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.producto) {
      onEditado(result.producto);
    }
  }

  // Imagen no es requerida para guardar — solo nombre, precio, costo y categoría
  const deshabilitado =
    !form.tNameProduct.trim() ||
    !form.ePriceProduct.trim() ||
    !form.eCostProduct.trim() ||
    !form.fkeCodCategory.trim();

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
      <ModalField label="Imagen">
        <ImageUploadInput
          value={form.ImgProduct}
          onChange={(url) => {
            console.log("[ModalEditarProducto] onChange imagen:", url);
            setForm((prev) => ({ ...prev, ImgProduct: url }));
          }}
          placeholder="Subir imagen del producto"
          bucket="product-images"
          storagePath={`productos/${producto.eCodProduct}`}
        />
      </ModalField>

      <ModalField label="Nombre del producto" required>
        <ModalInput
          type="text"
          value={form.tNameProduct}
          onChange={(e) => setForm({ ...form, tNameProduct: e.target.value })}
          autoFocus
        />
      </ModalField>

      <ModalField label="Categoría" required>
        <ModalSelect
          value={form.fkeCodCategory}
          onChange={(e) => setForm({ ...form, fkeCodCategory: e.target.value })}
        >
          <option value="">Seleccionar categoría</option>
          {categorias.length === 0 ? (
            <option value="" disabled>No hay categorías disponibles</option>
          ) : (
            categorias.map((categoria) => (
              <option key={categoria.eCodCategory} value={categoria.eCodCategory}>
                {categoria.tNameCategory}
              </option>
            ))
          )}
        </ModalSelect>
      </ModalField>

      <ModalField label="Precio al público" required>
        <ModalInput
          type="number"
          value={form.ePriceProduct}
          onChange={(e) => setForm({ ...form, ePriceProduct: e.target.value })}
        />
      </ModalField>

      <ModalField label="Costo de producción" required>
        <ModalInput
          type="number"
          value={form.eCostProduct}
          onChange={(e) => setForm({ ...form, eCostProduct: e.target.value })}
        />
      </ModalField>
    </Modal>
  );
}
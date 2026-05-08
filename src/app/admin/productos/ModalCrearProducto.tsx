"use client";

import { useEffect, useId, useState } from "react";
import { Modal, ModalField, ModalInput, ModalSelect } from "@/components/ui/Modal";
import { crearProducto } from "@/lib/actions/productos";
import { createClient } from "@/lib/supabase/client";
import type { Categoria, Producto } from "@/types";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";

interface Props {
  onClose: () => void;
  onCreado: (producto: Producto) => void;
  categorias: Categoria[];
}

export function ModalCrearProducto({ onClose, onCreado }: Props) {
// ID único para el path del storage: evita colisiones entre creaciones simultáneas
  const uid = useId().replace(/:/g, "");

const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [categorias, setCategorias] = useState<Categoria[]>([]);
const [cargandoCategorias, setCargandoCategorias] = useState(true);
const [form, setForm] = useState({
    tNameProduct: "",
    ImgProduct: "",
    ePriceProduct: "",
    eCostProduct: "",
    fkeCodCategory: "",
});

useEffect(() => {
    async function cargarCategorias() {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("categorias")
        .select("eCodCategory, tNameCategory")
        .eq("bStateCategory", true)
        .order("tNameCategory");

    if (data) setCategorias(data as Categoria[]);
    setCargandoCategorias(false);
    if (error) {
        console.error("Error cargando categorías activas:", error.message);
    }
    }

    cargarCategorias();
}, []);

async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("tNameProduct", form.tNameProduct);
    formData.append("ImgProduct", form.ImgProduct);
    formData.append("ePriceProduct", form.ePriceProduct);
    formData.append("eCostProduct", form.eCostProduct);
    formData.append("fkeCodCategory", form.fkeCodCategory);

    const result = await crearProducto(formData);

    if (result?.error) {
    setError(result.error);
    setLoading(false);
    } else if (result?.producto) {
    onCreado(result.producto);
    }
}

const deshabilitado = !form.tNameProduct.trim() || !form.ImgProduct.trim() || !form.ePriceProduct.trim() || !form.eCostProduct.trim() || !form.fkeCodCategory.trim();

return (
    <Modal
    titulo="Nuevo producto"
    onCerrar={onClose}
    onConfirmar={handleConfirmar}
    labelConfirmar="Crear producto"
    cargando={loading}
    deshabilitado={deshabilitado}
    error={error}
    >

    <ModalField label="Imagen" required>
        <ImageUploadInput
        value={form.ImgProduct}
        onChange={(url) => setForm({ ...form, ImgProduct: url })}
        placeholder="Subir imagen del producto"
        bucket="product-images"                        // ← tu bucket de productos
        storagePath={`productos/new_${Date.now()}`}
        />
    </ModalField>

    <ModalField label="Nombre del producto" required>
        <ModalInput
        type="text"
        placeholder="Ej. María García"
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
        {cargandoCategorias ? (
            <option value="" disabled>
            Cargando categorías...
            </option>
        ) : categorias.length === 0 ? (
            <option value="" disabled>
            No hay categorías activas
            </option>
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
        placeholder="0.00"
        value={form.ePriceProduct}
        onChange={(e) => setForm({ ...form, ePriceProduct: e.target.value })}
        />
    </ModalField>

    <ModalField label="Costo de producción" required>
        <ModalInput
        type="number"
        placeholder="0.00"
        value={form.eCostProduct}
        onChange={(e) => setForm({ ...form, eCostProduct: e.target.value })}
        />
    </ModalField>

    </Modal>
);
}
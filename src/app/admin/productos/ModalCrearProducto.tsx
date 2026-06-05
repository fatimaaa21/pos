"use client";

import { useEffect, useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal, ModalField, ModalInput, ModalSelect } from "@/components/ui/Modal";
import { crearProducto } from "@/lib/actions/productos";
import { crearPresentacion } from "@/lib/actions/presentaciones";
import { createClient } from "@/lib/supabase/client";
import type { Categoria, Producto } from "@/types";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";

interface PresentacionForm {
  tNombre:            string;
  ePricePresentacion: string;
  eCostPresentacion:  string;
}

interface Props {
  onClose: () => void;
  onCreado: (producto: Producto) => void;
  categorias: Categoria[];
}

export function ModalCrearProducto({ onClose, onCreado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
  const [form, setForm] = useState({
    tNameProduct:   "",
    ImgProduct:     "",
    ePriceProduct:  "",
    eCostProduct:   "",
    fkeCodCategory: "",
  });

  // ── Presentaciones ────────────────────────────────────────────────────────
  const [presentacionesList, setPresentacionesList] = useState<PresentacionForm[]>([]);

  function agregarFilaPresentacion() {
    setPresentacionesList((prev) => [
      ...prev,
      { tNombre: "", ePricePresentacion: "", eCostPresentacion: "" },
    ]);
  }

  function actualizarPresentacion(idx: number, campo: keyof PresentacionForm, valor: string) {
    setPresentacionesList((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p))
    );
  }

  function eliminarFilaPresentacion(idx: number) {
    setPresentacionesList((prev) => prev.filter((_, i) => i !== idx));
  }

  const presentacionesValidas = presentacionesList.every(
    (p) => p.tNombre.trim() && p.ePricePresentacion && parseFloat(p.ePricePresentacion) >= 0
  );

  // ── Categorías ────────────────────────────────────────────────────────────
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
      if (error) console.error("Error cargando categorías activas:", error.message);
    }
    cargarCategorias();
  }, []);

  // ── Confirmar ─────────────────────────────────────────────────────────────
  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    // 1. Crear el producto
    const formData = new FormData();
    formData.append("tNameProduct",   form.tNameProduct);
    formData.append("ImgProduct",     form.ImgProduct);
    formData.append("ePriceProduct",  form.ePriceProduct);
    formData.append("eCostProduct",   form.eCostProduct);
    formData.append("fkeCodCategory", form.fkeCodCategory);

    const result = await crearProducto(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const producto = result?.producto!;

    // 2. Crear las presentaciones (si las hay)
    for (const p of presentacionesList) {
      const fd = new FormData();
      fd.append("fkeCodProduct",      producto.eCodProduct);
      fd.append("tNombre",            p.tNombre.trim());
      fd.append("ePricePresentacion", p.ePricePresentacion);
      fd.append("eCostPresentacion",  p.eCostPresentacion || "0");
      const resP = await crearPresentacion(fd);
      if (resP?.error) {
        // El producto ya fue creado — notificamos pero no revertimos
        setError(`Producto creado, pero falló una presentación: ${resP.error}`);
        setLoading(false);
        onCreado(producto); // de todas formas avisamos que el producto existe
        return;
      }
    }

    onCreado(producto);
  }

  const deshabilitado =
    !form.tNameProduct.trim() ||
    !form.ImgProduct.trim()    ||
    !form.ePriceProduct.trim() ||
    !form.eCostProduct.trim()  ||
    !form.fkeCodCategory.trim() ||
    !presentacionesValidas;

  return (
    <Modal
      titulo="Nuevo producto"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Crear producto"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      <ModalField label="Imagen" required>
        <ImageUploadInput
          value={form.ImgProduct}
          onChange={(url) => setForm({ ...form, ImgProduct: url })}
          placeholder="Subir imagen del producto"
          bucket="product-images"
          storagePath={`productos/new_${Date.now()}`}
        />
      </ModalField>

      <ModalField label="Nombre del producto" required>
        <ModalInput
          type="text"
          placeholder="Ej. Refresco"
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
            <option disabled>Cargando...</option>
          ) : categorias.length === 0 ? (
            <option disabled>No hay categorías activas</option>
          ) : (
            categorias.map((c) => (
              <option key={c.eCodCategory} value={c.eCodCategory}>
                {c.tNameCategory}
              </option>
            ))
          )}
        </ModalSelect>
      </ModalField>

      <ModalField
        label="Precio al público"
        required
      >
        <ModalInput
          type="number"
          placeholder="0.00"
          value={form.ePriceProduct}
          onChange={(e) => setForm({ ...form, ePriceProduct: e.target.value })}
        />
      </ModalField>

      <ModalField
        label= "Costo de producción"
        required
      >
        <ModalInput
          type="number"
          placeholder="0.00"
          value={form.eCostProduct}
          onChange={(e) => setForm({ ...form, eCostProduct: e.target.value })}
        />
      </ModalField>

      {/* ── Sección presentaciones ── */}
      <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
              Presentaciones
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--gray)" }}>
              Opcional — chico/grande, lata/botella, 250g/500g, etc.
            </p>
          </div>
          <button
            type="button"
            onClick={agregarFilaPresentacion}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "6px 12px", border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)", background: "white", cursor: "pointer",
              fontSize: 12, fontWeight: 700, color: "var(--dark)",
              fontFamily: "var(--font-family)",
            }}
          >
            <Plus size={13} /> Agregar
          </button>
        </div>

        {presentacionesList.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--gray)", fontStyle: "italic", margin: 0 }}>
            Sin presentaciones — las ventas usarán el precio al público.
          </p>
        )}

        {presentacionesList.map((p, idx) => (
          <div
            key={idx}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 90px 90px 28px",
              gap: "var(--space-2)",
              marginBottom: "var(--space-2)",
              alignItems: "center",
            }}
          >
            <ModalInput
              type="text"
              placeholder="Nombre"
              value={p.tNombre}
              onChange={(e) => actualizarPresentacion(idx, "tNombre", e.target.value)}
            />
            <ModalInput
              type="number"
              placeholder="Precio"
              value={p.ePricePresentacion}
              onChange={(e) => actualizarPresentacion(idx, "ePricePresentacion", e.target.value)}
            />
            <ModalInput
              type="number"
              placeholder="Costo"
              value={p.eCostPresentacion}
              onChange={(e) => actualizarPresentacion(idx, "eCostPresentacion", e.target.value)}
            />
            <button
              type="button"
              onClick={() => eliminarFilaPresentacion(idx)}
              style={{
                width: 28, height: 28, border: "none", background: "transparent",
                cursor: "pointer", color: "var(--color-error)", display: "flex",
                alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)",
              }}
              title="Eliminar presentación"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {presentacionesList.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 90px 28px",
            gap: "var(--space-2)",
            paddingTop: "var(--space-1)",
          }}>
            <span style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600 }}>Nombre</span>
            <span style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600 }}>Precio</span>
            <span style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600 }}>Costo</span>
            <span />
          </div>
        )}
      </div>
    </Modal>
  );
}
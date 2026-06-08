"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Ruler } from "lucide-react";
import { Modal, ModalField, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import { crearProducto } from "@/lib/actions/productos";
import { crearPresentacion } from "@/lib/actions/presentaciones";
import { getMateriales } from "@/lib/actions/materiales";
import type { Categoria, Material, Producto } from "@/types";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";

interface PresentacionForm {
  tNombre:            string;
  ePricePresentacion: string;
  eCostPresentacion:  string;
  eCantidadUnidades:  string;
}

interface Props {
  onClose:    () => void;
  onCreado:   (producto: Producto) => void;
  categorias: Categoria[];
}

export function ModalCrearProductoImpresion({ onClose, onCreado, categorias }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [form, setForm] = useState({
    tNameProduct:   "",
    ImgProduct:     "",
    ePriceProduct:  "",
    eCostProduct:   "",
    fkeCodCategory: "",
    tipo_producto:  "medida" as "medida" | "unidad",
    ePrecioM2:      "",
    // Dimensiones para unidad con consumo de hojas
    eAnchoCm:       "",
    eAltoCm:        "",
    fkeCodMaterial: "",
  });

  const [presentacionesList, setPresentacionesList] = useState<PresentacionForm[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);

  const esMedida = form.tipo_producto === "medida";
  const hojasDisponibles = materiales.filter((m) => m.tipo_material === "hoja");

  // Cargar materiales tipo hoja al abrir
  useEffect(() => {
    getMateriales().then((data) => setMateriales(data));
  }, []);

  function agregarFilaPresentacion() {
    setPresentacionesList((prev) => [
      ...prev,
      { tNombre: "", ePricePresentacion: "", eCostPresentacion: "", eCantidadUnidades: "1" },
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

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("tNameProduct",   form.tNameProduct);
    fd.append("ImgProduct",     form.ImgProduct);
    fd.append("ePriceProduct",  esMedida ? "0" : form.ePriceProduct);
    fd.append("eCostProduct",   form.eCostProduct);
    fd.append("fkeCodCategory", form.fkeCodCategory);
    fd.append("tipo_producto",  form.tipo_producto);
    if (esMedida) fd.append("ePrecioM2", form.ePrecioM2);
    if (!esMedida && form.eAnchoCm)       fd.append("eAnchoCm",       form.eAnchoCm);
    if (!esMedida && form.eAltoCm)        fd.append("eAltoCm",        form.eAltoCm);
    if (!esMedida && form.fkeCodMaterial) fd.append("fkeCodMaterial", form.fkeCodMaterial);

    const result = await crearProducto(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const producto = result?.producto!;

    if (!esMedida) {
      for (const p of presentacionesList) {
        const pfd = new FormData();
        pfd.append("fkeCodProduct",      producto.eCodProduct);
        pfd.append("tNombre",            p.tNombre.trim());
        pfd.append("ePricePresentacion", p.ePricePresentacion);
        pfd.append("eCostPresentacion",  p.eCostPresentacion  || "0");
        pfd.append("eCantidadUnidades",  p.eCantidadUnidades  || "1");
        const resP = await crearPresentacion(pfd);
        if (resP?.error) {
          setError(`Producto creado, pero falló una presentación: ${resP.error}`);
          setLoading(false);
          onCreado(producto);
          return;
        }
      }
    }

    onCreado(producto);
  }

  const deshabilitado =
    !form.tNameProduct.trim()    ||
    !form.ImgProduct.trim()      ||
    !form.eCostProduct.trim()    ||
    !form.fkeCodCategory.trim()  ||
    (esMedida  && !form.ePrecioM2.trim())     ||
    (!esMedida && !form.ePriceProduct.trim()) ||
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
          placeholder="Ej. Lona"
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

      <ModalField label="Tipo de producto" required>
        <ModalSelect
          value={form.tipo_producto}
          onChange={(e) =>
            setForm({
              ...form,
              tipo_producto:  e.target.value as "medida" | "unidad",
              ePrecioM2:      "",
              ePriceProduct:  "",
              eAnchoCm:       "",
              eAltoCm:        "",
              fkeCodMaterial: "",
            })
          }
        >
          <option value="medida">Por medida (precio por m²)</option>
          <option value="unidad">Por unidad / presentación</option>
        </ModalSelect>
      </ModalField>

      {esMedida ? (
        <>
          <ModalField label="Precio por m²" required>
            <ModalInput
              type="number"
              min={0}
              step={0.01}
              placeholder="Ej. 120.00"
              value={form.ePrecioM2}
              onChange={(e) => setForm({ ...form, ePrecioM2: e.target.value })}
            />
          </ModalField>
          <ModalField label="Costo de producción por m²" required>
            <ModalInput
              type="number"
              min={0}
              step={0.01}
              placeholder="Ej. 60.00"
              value={form.eCostProduct}
              onChange={(e) => setForm({ ...form, eCostProduct: e.target.value })}
            />
          </ModalField>
        </>
      ) : (
        <>
          <ModalField label="Precio al público" required>
            <ModalInput
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={form.ePriceProduct}
              onChange={(e) => setForm({ ...form, ePriceProduct: e.target.value })}
            />
          </ModalField>
          <ModalField label="Costo de producción" required>
            <ModalInput
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={form.eCostProduct}
              onChange={(e) => setForm({ ...form, eCostProduct: e.target.value })}
            />
          </ModalField>

          {/* ── Dimensiones del producto y material a consumir ── */}
          <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-4)" }}>
            <p style={{ margin: "0 0 var(--space-1)", fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
              Dimensiones del producto
            </p>
            <p style={{ margin: "0 0 var(--space-3)", fontSize: 11, color: "var(--gray)" }}>
              Opcional — llena estos campos si el producto se imprime en hoja y quieres que el sistema descuente automáticamente las hojas utilizadas.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <ModalField label="Ancho (cm)">
                <ModalInput
                  type="number" min={0.1} step={0.01} placeholder="Ej. 9"
                  value={form.eAnchoCm}
                  onChange={(e) => setForm({ ...form, eAnchoCm: e.target.value })}
                />
              </ModalField>
              <ModalField label="Alto (cm)">
                <ModalInput
                  type="number" min={0.1} step={0.01} placeholder="Ej. 7"
                  value={form.eAltoCm}
                  onChange={(e) => setForm({ ...form, eAltoCm: e.target.value })}
                />
              </ModalField>
            </div>
            <div style={{ paddingTop: "var(--space-3)" }}>
              <ModalField label="Material a consumir">
                <ModalSelect
                  value={form.fkeCodMaterial}
                  onChange={(e) => setForm({ ...form, fkeCodMaterial: e.target.value })}
                >
                  <option value="">Sin material vinculado</option>
                  {hojasDisponibles.map((m) => (
                    <option key={m.eCodMaterial} value={m.eCodMaterial}>
                      {m.tNombre} ({m.eAnchoCm}×{m.eAltoCm} cm · {m.eMetrosLineales} hojas)
                    </option>
                  ))}
                </ModalSelect>
              </ModalField>
            </div>
            <div style={{ paddingTop: "var(--space-3)" }}>
              {(form.eAnchoCm || form.eAltoCm || form.fkeCodMaterial) && (
                <ModalInfo>
                  <Ruler size={16} />
                  El sistema calculará cuántas hojas se necesitan por venta según las dimensiones del producto, y las descontará automáticamente.
                </ModalInfo>
              )}
            </div>
          </div>

          {/* Presentaciones — solo para productos por unidad */}
          <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
                  Presentaciones
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--gray)" }}>
                  Opcional — docena, medio ciento, ciento, etc.
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
                Sin presentaciones — se usará el precio al público.
              </p>
            )}

            {presentacionesList.map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 76px 76px 60px 28px",
                  gap: "var(--space-2)",
                  marginBottom: "var(--space-2)",
                  alignItems: "center",
                }}
              >
                <ModalInput
                  type="text"
                  placeholder="Nombre (ej. Docena)"
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
                <ModalInput
                  type="number"
                  min={1}
                  step={1}
                  placeholder="Pzs"
                  title="Unidades físicas por presentación (ej. 12 para docena)"
                  value={p.eCantidadUnidades}
                  onChange={(e) => actualizarPresentacion(idx, "eCantidadUnidades", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => eliminarFilaPresentacion(idx)}
                  style={{
                    width: 28, height: 28, border: "none", background: "transparent",
                    cursor: "pointer", color: "var(--color-error)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {presentacionesList.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 76px 76px 60px 28px",
                gap: "var(--space-2)",
                paddingTop: "var(--space-1)",
              }}>
                <span style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600 }}>Nombre</span>
                <span style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600 }}>Precio</span>
                <span style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600 }}>Costo</span>
                <span style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600 }}>Pzas</span>
                <span />
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
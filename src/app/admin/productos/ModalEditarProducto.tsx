"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Modal, ModalField, ModalInput, ModalSelect } from "@/components/ui/Modal";
import { editarProducto } from "@/lib/actions/productos";
import {
  obtenerPresentaciones,
  crearPresentacion,
  editarPresentacion,
  eliminarPresentacion,
} from "@/lib/actions/presentaciones";
import type { Categoria, Producto, Presentacion } from "@/types";
import { ImageUploadInput } from "@/components/ui/ImageUploadInput";

interface Props {
  producto:   Producto;
  categorias: Categoria[];
  onClose:    () => void;
  onEditado:  (producto: Producto) => void;
}

interface FilaEditable extends Presentacion {
  editando:      boolean;
  nombreEdit:    string;
  precioEdit:    string;
  costoEdit:     string;
  guardandoFila: boolean;
}

function toFila(p: Presentacion): FilaEditable {
  return {
    ...p,
    editando:      false,
    nombreEdit:    p.tNombre,
    precioEdit:    p.ePricePresentacion.toString(),
    costoEdit:     p.eCostPresentacion.toString(),
    guardandoFila: false,
  };
}

export function ModalEditarProducto({ producto, categorias, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [form, setForm] = useState({
    tNameProduct:   producto.tNameProduct,
    ImgProduct:     producto.ImgProduct?.split("?")[0] ?? "",
    ePriceProduct:  producto.ePriceProduct.toString(),
    eCostProduct:   producto.eCostProduct.toString(),
    fkeCodCategory: producto.fkeCodCategory
      ? typeof producto.fkeCodCategory === "object"
        ? (producto.fkeCodCategory as any).eCodCategory
        : producto.fkeCodCategory
      : "",
  });

  // ── Presentaciones ────────────────────────────────────────────────────────
  const [presentaciones, setPresentaciones] = useState<FilaEditable[]>([]);
  const [cargandoPres,   setCargandoPres]   = useState(true);
  const [errorPres,      setErrorPres]      = useState<string | null>(null);
  const [nuevaPres, setNuevaPres] = useState({
    tNombre: "", ePricePresentacion: "", eCostPresentacion: "",
  });
  const [guardandoNueva, setGuardandoNueva] = useState(false);

  // Carga inicial — usa server action (admin client, bypasea RLS)
  useEffect(() => {
    let cancelled = false;

    async function cargar() {
      setCargandoPres(true);
      const result = await obtenerPresentaciones(producto.eCodProduct);
      if (cancelled) return;

      if (result.error) {
        setErrorPres(result.error);
      } else {
        setPresentaciones((result.presentaciones ?? []).map(toFila));
      }
      setCargandoPres(false);
    }

    cargar();
    return () => { cancelled = true; };
  }, [producto.eCodProduct]);

  // ── Edición inline ────────────────────────────────────────────────────────
  function activarEdicion(id: string) {
    setPresentaciones((prev) =>
      prev.map((p) =>
        p.eCodPresentacion === id
          ? { ...p, editando: true, nombreEdit: p.tNombre, precioEdit: p.ePricePresentacion.toString(), costoEdit: p.eCostPresentacion.toString() }
          : p
      )
    );
  }

  function cancelarEdicion(id: string) {
    setPresentaciones((prev) =>
      prev.map((p) => p.eCodPresentacion === id ? { ...p, editando: false } : p)
    );
  }

  async function guardarEdicion(id: string) {
    const fila = presentaciones.find((p) => p.eCodPresentacion === id);
    if (!fila) return;

    setPresentaciones((prev) =>
      prev.map((p) => p.eCodPresentacion === id ? { ...p, guardandoFila: true } : p)
    );

    const fd = new FormData();
    fd.append("eCodPresentacion",   id);
    fd.append("tNombre",            fila.nombreEdit.trim());
    fd.append("ePricePresentacion", fila.precioEdit);
    fd.append("eCostPresentacion",  fila.costoEdit || "0");

    const result = await editarPresentacion(fd);

    if (result?.error) {
      setErrorPres(result.error);
      setPresentaciones((prev) =>
        prev.map((p) => p.eCodPresentacion === id ? { ...p, guardandoFila: false } : p)
      );
    } else if (result?.presentacion) {
      setPresentaciones((prev) =>
        prev.map((p) => p.eCodPresentacion === id ? toFila(result.presentacion!) : p)
      );
    }
  }

  // ── Agregar nueva ─────────────────────────────────────────────────────────
  async function handleAgregarPresentacion() {
    if (!nuevaPres.tNombre.trim() || !nuevaPres.ePricePresentacion) return;
    setGuardandoNueva(true);
    setErrorPres(null);

    const fd = new FormData();
    fd.append("fkeCodProduct",      producto.eCodProduct);
    fd.append("tNombre",            nuevaPres.tNombre.trim());
    fd.append("ePricePresentacion", nuevaPres.ePricePresentacion);
    fd.append("eCostPresentacion",  nuevaPres.eCostPresentacion || "0");

    const result = await crearPresentacion(fd);

    if (result?.error) {
      setErrorPres(result.error);
    } else if (result?.presentacion) {
      setPresentaciones((prev) => [...prev, toFila(result.presentacion!)]);
      setNuevaPres({ tNombre: "", ePricePresentacion: "", eCostPresentacion: "" });
    }

    setGuardandoNueva(false);
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  async function handleEliminarPresentacion(id: string) {
    setErrorPres(null);
    const result = await eliminarPresentacion(id);
    if (result?.error) setErrorPres(result.error);
    else setPresentaciones((prev) => prev.filter((p) => p.eCodPresentacion !== id));
  }

  // ── Guardar producto ──────────────────────────────────────────────────────
  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("eCodProduct",    producto.eCodProduct);
    formData.append("tNameProduct",   form.tNameProduct);
    formData.append("ImgProduct",     form.ImgProduct);
    formData.append("ePriceProduct",  form.ePriceProduct);
    formData.append("eCostProduct",   form.eCostProduct);
    formData.append("fkeCodCategory", form.fkeCodCategory);

    const result = await editarProducto(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.producto) {
      onEditado(result.producto);
    }
  }

  const deshabilitado =
    !form.tNameProduct.trim()   ||
    !form.ePriceProduct.trim()  ||
    !form.eCostProduct.trim()   ||
    !form.fkeCodCategory.trim();

  const filaPresentacionValida =
    nuevaPres.tNombre.trim() !== "" && nuevaPres.ePricePresentacion !== "";

  // ── Estilos de tabla reutilizables ────────────────────────────────────────
  const cellStyle = {
    padding: "8px 10px", fontSize: 12, fontWeight: 600,
    color: "var(--dark)", fontFamily: "var(--font-family)",
  } as const;

  const headerCellStyle = {
    padding: "6px 10px", fontSize: 11, fontWeight: 700,
    color: "var(--gray)", textTransform: "uppercase" as const,
    letterSpacing: "0.04em", fontFamily: "var(--font-family)",
  };

  const inputStyle = {
    width: "100%", border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-sm)", padding: "4px 6px",
    fontFamily: "var(--font-family)", fontSize: 12,
  } as const;

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
      {/* Imagen */}
      <ModalField label="Imagen">
        <ImageUploadInput
          value={form.ImgProduct}
          onChange={(url) => setForm((prev) => ({ ...prev, ImgProduct: url }))}
          placeholder="Subir imagen del producto"
          bucket="product-images"
          storagePath={`productos/${producto.eCodProduct}`}
        />
      </ModalField>

      {/* Nombre */}
      <ModalField label="Nombre del producto" required>
        <ModalInput
          type="text"
          value={form.tNameProduct}
          onChange={(e) => setForm({ ...form, tNameProduct: e.target.value })}
          autoFocus
        />
      </ModalField>

      {/* Categoría */}
      <ModalField label="Categoría" required>
        <ModalSelect
          value={form.fkeCodCategory}
          onChange={(e) => setForm({ ...form, fkeCodCategory: e.target.value })}
        >
          <option value="">Seleccionar categoría</option>
          {categorias.length === 0 ? (
            <option disabled>No hay categorías disponibles</option>
          ) : (
            categorias.map((c) => (
              <option key={c.eCodCategory} value={c.eCodCategory}>
                {c.tNameCategory}
              </option>
            ))
          )}
        </ModalSelect>
      </ModalField>

      {/* Precio */}
      <ModalField
        label= "Precio al público"
        required
      >
        <ModalInput
          type="number"
          value={form.ePriceProduct}
          onChange={(e) => setForm({ ...form, ePriceProduct: e.target.value })}
        />
      </ModalField>

      {/* Costo */}
      <ModalField
        label= "Costo de producción"
        required
      >
        <ModalInput
          type="number"
          value={form.eCostProduct}
          onChange={(e) => setForm({ ...form, eCostProduct: e.target.value })}
        />
      </ModalField>

      {/* ── Sección presentaciones ── */}
      <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-4)" }}>
        <p style={{ margin: "0 0 var(--space-3)", fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
          Presentaciones
        </p>

        {cargandoPres ? (
          <p style={{ fontSize: 12, color: "var(--gray)" }}>Cargando presentaciones…</p>
        ) : (
          <>
            {/* Tabla de presentaciones existentes */}
            {presentaciones.length > 0 && (
              <div style={{
                border: "1px solid var(--border-light)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                marginBottom: "var(--space-3)",
              }}>
                {/* Header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 90px 90px 60px",
                  background: "var(--background)",
                  borderBottom: "1px solid var(--border-light)",
                }}>
                  {["Nombre", "Precio", "Costo", ""].map((h) => (
                    <span key={h} style={headerCellStyle}>{h}</span>
                  ))}
                </div>

                {presentaciones.map((p, idx) => (
                  <div
                    key={p.eCodPresentacion}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 90px 60px",
                      alignItems: "center",
                      borderBottom: idx < presentaciones.length - 1
                        ? "1px solid var(--border-light)"
                        : "none",
                      background: p.editando ? "var(--color-primary-50)" : "white",
                    }}
                  >
                    {p.editando ? (
                      <>
                        <div style={{ padding: "4px 6px" }}>
                          <input
                            type="text"
                            value={p.nombreEdit}
                            style={inputStyle}
                            onChange={(e) =>
                              setPresentaciones((prev) =>
                                prev.map((x) =>
                                  x.eCodPresentacion === p.eCodPresentacion
                                    ? { ...x, nombreEdit: e.target.value }
                                    : x
                                )
                              )
                            }
                          />
                        </div>
                        <div style={{ padding: "4px 4px" }}>
                          <input
                            type="number"
                            value={p.precioEdit}
                            style={inputStyle}
                            onChange={(e) =>
                              setPresentaciones((prev) =>
                                prev.map((x) =>
                                  x.eCodPresentacion === p.eCodPresentacion
                                    ? { ...x, precioEdit: e.target.value }
                                    : x
                                )
                              )
                            }
                          />
                        </div>
                        <div style={{ padding: "4px 4px" }}>
                          <input
                            type="number"
                            value={p.costoEdit}
                            style={inputStyle}
                            onChange={(e) =>
                              setPresentaciones((prev) =>
                                prev.map((x) =>
                                  x.eCodPresentacion === p.eCodPresentacion
                                    ? { ...x, costoEdit: e.target.value }
                                    : x
                                )
                              )
                            }
                          />
                        </div>
                        <div style={{ display: "flex", gap: 2, padding: "4px 6px", justifyContent: "center" }}>
                          <button
                            onClick={() => guardarEdicion(p.eCodPresentacion)}
                            disabled={p.guardandoFila}
                            style={{ width: 22, height: 22, border: "none", background: "var(--color-primary)", color: "white", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            {p.guardandoFila ? "…" : <Check size={11} strokeWidth={3} />}
                          </button>
                          <button
                            onClick={() => cancelarEdicion(p.eCodPresentacion)}
                            style={{ width: 22, height: 22, border: "1px solid var(--border-default)", background: "white", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray)" }}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span style={cellStyle}>{p.tNombre}</span>
                        <span style={cellStyle}>${p.ePricePresentacion.toFixed(2)}</span>
                        <span style={{ ...cellStyle, color: "var(--gray)" }}>${p.eCostPresentacion.toFixed(2)}</span>
                        <div style={{ display: "flex", gap: 2, padding: "4px 6px", justifyContent: "center" }}>
                          <button
                            onClick={() => activarEdicion(p.eCodPresentacion)}
                            title="Editar"
                            style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", color: "var(--gray)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)" }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleEliminarPresentacion(p.eCodPresentacion)}
                            title="Eliminar"
                            style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", color: "var(--color-error)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)" }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Fila para agregar nueva presentación */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 90px 90px 36px",
              gap: "var(--space-2)",
              alignItems: "center",
            }}>
              <ModalInput
                type="text"
                placeholder="Nombre (ej. Chico)"
                value={nuevaPres.tNombre}
                onChange={(e) => setNuevaPres((p) => ({ ...p, tNombre: e.target.value }))}
              />
              <ModalInput
                type="number"
                placeholder="Precio"
                value={nuevaPres.ePricePresentacion}
                onChange={(e) => setNuevaPres((p) => ({ ...p, ePricePresentacion: e.target.value }))}
              />
              <ModalInput
                type="number"
                placeholder="Costo"
                value={nuevaPres.eCostPresentacion}
                onChange={(e) => setNuevaPres((p) => ({ ...p, eCostPresentacion: e.target.value }))}
              />
              <button
                type="button"
                onClick={handleAgregarPresentacion}
                disabled={!filaPresentacionValida || guardandoNueva}
                title="Agregar presentación"
                style={{
                  width: 36, height: 36, border: "none",
                  background: filaPresentacionValida
                    ? "var(--color-primary)"
                    : "var(--border-default)",
                  color: "white", borderRadius: "var(--radius-md)",
                  cursor: filaPresentacionValida ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {guardandoNueva ? "…" : <Plus size={16} />}
              </button>
            </div>

            {presentaciones.length === 0 && !cargandoPres && (
              <p style={{ fontSize: 11, color: "var(--gray)", fontStyle: "italic", marginTop: "var(--space-2)" }}>
                Sin presentaciones — el precio al público aplica directamente.
              </p>
            )}

            {errorPres && (
              <p style={{ fontSize: 12, color: "var(--color-error)", fontWeight: 600, marginTop: "var(--space-2)" }}>
                ⚠ {errorPres}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
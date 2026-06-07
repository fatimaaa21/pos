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

export function ModalEditarProductoImpresion({ producto, categorias, onClose, onEditado }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const [form, setForm] = useState({
    tNameProduct:   producto.tNameProduct,
    ImgProduct:     producto.ImgProduct?.split("?")[0] ?? "",
    ePriceProduct:  producto.ePriceProduct.toString(),
    eCostProduct:   producto.eCostProduct.toString(),
    fkeCodCategory: typeof producto.fkeCodCategory === "object"
      ? (producto.fkeCodCategory as any).eCodCategory
      : (producto.fkeCodCategory ?? ""),
    tipo_producto:  (producto.tipo_producto ?? "unidad") as "medida" | "unidad",
    ePrecioM2:      producto.ePrecioM2?.toString() ?? "",
  });

  const esMedida = form.tipo_producto === "medida";

  const [presentaciones,  setPresentaciones]  = useState<FilaEditable[]>([]);
  const [cargandoPres,    setCargandoPres]     = useState(true);
  const [errorPres,       setErrorPres]        = useState<string | null>(null);
  const [nuevaPres, setNuevaPres] = useState({
    tNombre: "", ePricePresentacion: "", eCostPresentacion: "",
  });
  const [guardandoNueva, setGuardandoNueva] = useState(false);

  useEffect(() => {
    if (esMedida) { setCargandoPres(false); return; }
    let cancelled = false;
    async function cargar() {
      const result = await obtenerPresentaciones(producto.eCodProduct);
      if (cancelled) return;
      if (result.error) setErrorPres(result.error);
      else setPresentaciones((result.presentaciones ?? []).map(toFila));
      setCargandoPres(false);
    }
    cargar();
    return () => { cancelled = true; };
  }, [producto.eCodProduct, esMedida]);

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
    if (result?.error) setErrorPres(result.error);
    else if (result?.presentacion) {
      setPresentaciones((prev) => [...prev, toFila(result.presentacion!)]);
      setNuevaPres({ tNombre: "", ePricePresentacion: "", eCostPresentacion: "" });
    }
    setGuardandoNueva(false);
  }

  async function handleEliminarPresentacion(id: string) {
    setErrorPres(null);
    const result = await eliminarPresentacion(id);
    if (result?.error) setErrorPres(result.error);
    else setPresentaciones((prev) => prev.filter((p) => p.eCodPresentacion !== id));
  }

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("eCodProduct",    producto.eCodProduct);
    fd.append("tNameProduct",   form.tNameProduct);
    fd.append("ImgProduct",     form.ImgProduct);
    fd.append("ePriceProduct",  esMedida ? "0" : form.ePriceProduct);
    fd.append("eCostProduct",   form.eCostProduct);
    fd.append("fkeCodCategory", form.fkeCodCategory);
    fd.append("tipo_producto",  form.tipo_producto);
    if (esMedida) fd.append("ePrecioM2", form.ePrecioM2);

    const result = await editarProducto(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.producto) {
      onEditado(result.producto);
    }
  }

  const deshabilitado =
    !form.tNameProduct.trim()   ||
    !form.fkeCodCategory.trim() ||
    !form.eCostProduct.trim()   ||
    (esMedida  && !form.ePrecioM2.trim())     ||
    (!esMedida && !form.ePriceProduct.trim());

  const inputStyle = {
    width: "100%", border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-sm)", padding: "4px 6px",
    fontFamily: "var(--font-family)", fontSize: 12,
  } as const;

  const cellStyle = {
    padding: "8px 10px", fontSize: 12, fontWeight: 600,
    color: "var(--dark)", fontFamily: "var(--font-family)",
  } as const;

  const headerCellStyle = {
    padding: "6px 10px", fontSize: 11, fontWeight: 700,
    color: "var(--gray)", textTransform: "uppercase" as const,
    letterSpacing: "0.04em", fontFamily: "var(--font-family)",
  };

  return (
    <Modal
      titulo="Editar producto"
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
          value={form.ImgProduct}
          onChange={(url) => setForm((prev) => ({ ...prev, ImgProduct: url }))}
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
          {categorias.map((c) => (
            <option key={c.eCodCategory} value={c.eCodCategory}>
              {c.tNameCategory}
            </option>
          ))}
        </ModalSelect>
      </ModalField>

      <ModalField label="Tipo de producto" required>
        <ModalSelect
          value={form.tipo_producto}
          onChange={(e) =>
            setForm({
              ...form,
              tipo_producto: e.target.value as "medida" | "unidad",
              ePrecioM2:     "",
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
              value={form.ePrecioM2}
              onChange={(e) => setForm({ ...form, ePrecioM2: e.target.value })}
            />
          </ModalField>
          <ModalField label="Costo de producción por m²" required>
            <ModalInput
              type="number"
              min={0}
              step={0.01}
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
              value={form.ePriceProduct}
              onChange={(e) => setForm({ ...form, ePriceProduct: e.target.value })}
            />
          </ModalField>
          <ModalField label="Costo de producción" required>
            <ModalInput
              type="number"
              min={0}
              step={0.01}
              value={form.eCostProduct}
              onChange={(e) => setForm({ ...form, eCostProduct: e.target.value })}
            />
          </ModalField>

          {/* Presentaciones */}
          <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-4)" }}>
            <p style={{ margin: "0 0 var(--space-3)", fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
              Presentaciones
            </p>

            {cargandoPres ? (
              <p style={{ fontSize: 12, color: "var(--gray)" }}>Cargando…</p>
            ) : (
              <>
                {presentaciones.length > 0 && (
                  <div style={{
                    border: "1px solid var(--border-light)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    marginBottom: "var(--space-3)",
                  }}>
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 90px 90px 60px",
                      background: "var(--background)", borderBottom: "1px solid var(--border-light)",
                    }}>
                      {["Nombre", "Precio", "Costo", ""].map((h) => (
                        <span key={h} style={headerCellStyle}>{h}</span>
                      ))}
                    </div>
                    {presentaciones.map((p, idx) => (
                      <div
                        key={p.eCodPresentacion}
                        style={{
                          display: "grid", gridTemplateColumns: "1fr 90px 90px 60px",
                          alignItems: "center",
                          borderBottom: idx < presentaciones.length - 1 ? "1px solid var(--border-light)" : "none",
                          background: p.editando ? "var(--color-primary-50)" : "white",
                        }}
                      >
                        {p.editando ? (
                          <>
                            <div style={{ padding: "4px 6px" }}>
                              <input type="text" value={p.nombreEdit} style={inputStyle}
                                onChange={(e) => setPresentaciones((prev) => prev.map((x) =>
                                  x.eCodPresentacion === p.eCodPresentacion ? { ...x, nombreEdit: e.target.value } : x
                                ))} />
                            </div>
                            <div style={{ padding: "4px 4px" }}>
                              <input type="number" value={p.precioEdit} style={inputStyle}
                                onChange={(e) => setPresentaciones((prev) => prev.map((x) =>
                                  x.eCodPresentacion === p.eCodPresentacion ? { ...x, precioEdit: e.target.value } : x
                                ))} />
                            </div>
                            <div style={{ padding: "4px 4px" }}>
                              <input type="number" value={p.costoEdit} style={inputStyle}
                                onChange={(e) => setPresentaciones((prev) => prev.map((x) =>
                                  x.eCodPresentacion === p.eCodPresentacion ? { ...x, costoEdit: e.target.value } : x
                                ))} />
                            </div>
                            <div style={{ display: "flex", gap: 2, padding: "4px 6px", justifyContent: "center" }}>
                              <button onClick={() => guardarEdicion(p.eCodPresentacion)} disabled={p.guardandoFila}
                                style={{ width: 22, height: 22, border: "none", background: "var(--color-primary)", color: "white", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {p.guardandoFila ? "…" : <Check size={11} strokeWidth={3} />}
                              </button>
                              <button onClick={() => cancelarEdicion(p.eCodPresentacion)}
                                style={{ width: 22, height: 22, border: "1px solid var(--border-default)", background: "white", borderRadius: "var(--radius-sm)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray)" }}>
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
                              <button onClick={() => activarEdicion(p.eCodPresentacion)} title="Editar"
                                style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", color: "var(--gray)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)" }}>
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => handleEliminarPresentacion(p.eCodPresentacion)} title="Eliminar"
                                style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", color: "var(--color-error)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)" }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 36px", gap: "var(--space-2)", alignItems: "center" }}>
                  <ModalInput type="text" placeholder="Nombre (ej. Docena)"
                    value={nuevaPres.tNombre}
                    onChange={(e) => setNuevaPres((p) => ({ ...p, tNombre: e.target.value }))} />
                  <ModalInput type="number" placeholder="Precio"
                    value={nuevaPres.ePricePresentacion}
                    onChange={(e) => setNuevaPres((p) => ({ ...p, ePricePresentacion: e.target.value }))} />
                  <ModalInput type="number" placeholder="Costo"
                    value={nuevaPres.eCostPresentacion}
                    onChange={(e) => setNuevaPres((p) => ({ ...p, eCostPresentacion: e.target.value }))} />
                  <button type="button" onClick={handleAgregarPresentacion}
                    disabled={!nuevaPres.tNombre.trim() || !nuevaPres.ePricePresentacion || guardandoNueva}
                    style={{
                      width: 36, height: 36, border: "none",
                      background: nuevaPres.tNombre.trim() && nuevaPres.ePricePresentacion ? "var(--color-primary)" : "var(--border-default)",
                      color: "white", borderRadius: "var(--radius-md)", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                    {guardandoNueva ? "…" : <Plus size={16} />}
                  </button>
                </div>

                {errorPres && (
                  <p style={{ fontSize: 12, color: "var(--color-error)", fontWeight: 600, marginTop: "var(--space-2)" }}>
                    ⚠ {errorPres}
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
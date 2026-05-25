"use client";

import { useEffect, useState } from "react";
import { Infinity as InfinityIcon, Package } from "lucide-react";
import { Modal, ModalField, ModalInput, ModalSelect, ModalInfo } from "@/components/ui/Modal";
import { agregarStock } from "@/lib/actions/inventario";
import { createClient } from "@/lib/supabase/client";
import type { Inventario, Producto } from "@/types";

interface Props {
  onClose: () => void;
  onAgregado: (inventario: Inventario) => void;
}

export function ModalAgregarStock({ onClose, onAgregado }: Props) {
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [form, setForm] = useState({
    fkeCodProduct:  "",
    bIlimitado:      false,   // estado local del toggle
    eCantIngresada: "",
    eStockMinimo:   "",
  });

  useEffect(() => {
    async function cargar() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("productos")
        .select("eCodProduct, tNameProduct, ImgProduct, ePriceProduct")
        .eq("bStateProduct", true)
        .order("tNameProduct");

      if (data) setProductos(data as Producto[]);
      if (error) console.error("Error cargando productos:", error.message);
      setCargandoProductos(false);
    }
    cargar();
  }, []);

  const productoSeleccionado = productos.find(p => p.eCodProduct === form.fkeCodProduct);

  async function handleConfirmar() {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("fkeCodProduct",      form.fkeCodProduct);
    formData.append("bUnlimitedInventory", form.bIlimitado ? "true" : "false");
    if (!form.bIlimitado) {
      formData.append("eCantIngresada", form.eCantIngresada);
      formData.append("eStockMinimo",   form.eStockMinimo);
    }

    const result = await agregarStock(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else if (result?.inventario) {
      onAgregado(result.inventario);
    }
  }

  const deshabilitado =
    !form.fkeCodProduct ||
    (!form.bIlimitado && (!form.eCantIngresada || parseFloat(form.eCantIngresada) <= 0));

  return (
    <Modal
      titulo="Agregar stock"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Agregar al inventario"
      cargando={loading}
      deshabilitado={deshabilitado}
      error={error}
      ancho="sm"
    >
      {/* Preview del producto seleccionado */}
      {productoSeleccionado && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-3)",
          background: "var(--color-primary-50)",
          border: "1px solid var(--color-primary-light)",
          borderRadius: "var(--radius-md)",
        }}>
          <div style={{
            width: 40, height: 40,
            background: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, flexShrink: 0,
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-md)",
          }}>
            {productoSeleccionado.ImgProduct ? (
              <img
                src={productoSeleccionado.ImgProduct}
                alt={productoSeleccionado.tNameProduct}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--radius-md)" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement!.innerHTML = "📦";
                }}
              />
            ) : "📦"}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--dark)" }}>
              {productoSeleccionado.tNameProduct}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-primary-dark)", fontWeight: 600 }}>
              Precio: ${productoSeleccionado.ePriceProduct}
            </div>
          </div>
        </div>
      )}

      {/* Selector de producto */}
      <ModalField label="Producto" required>
        <ModalSelect
          value={form.fkeCodProduct}
          onChange={(e) => setForm({ ...form, fkeCodProduct: e.target.value })}
        >
          <option value="">Seleccionar producto...</option>
          {cargandoProductos ? (
            <option disabled>Cargando productos...</option>
          ) : productos.length === 0 ? (
            <option disabled>No hay productos activos</option>
          ) : (
            productos.map((p) => (
              <option key={p.eCodProduct} value={p.eCodProduct}>
                {p.tNameProduct}
              </option>
            ))
          )}
        </ModalSelect>
      </ModalField>

      {/* Toggle stock infinito */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3) var(--space-4)",
        background: form.bIlimitado ? "var(--color-primary-50)" : "var(--background)",
        border: `1px solid ${form.bIlimitado ? "var(--color-primary-light)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-md)",
        transition: "all 0.18s",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--dark)" }}>
            Stock ilimitado
          </div>
          <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 2 }}>
            No requiere control de cantidad
          </div>
        </div>
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, bIlimitado: !f.bIlimitado }))}
          style={{
            width: 38,
            height: 22,
            borderRadius: 11,
            border: "none",
            background: form.bIlimitado ? "var(--color-primary)" : "var(--border-strong)",
            position: "relative",
            cursor: "pointer",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
          aria-label="Toggle stock ilimitado"
        >
          <span style={{
            position: "absolute",
            top: 3,
            left: form.bIlimitado ? 18 : 3,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            transition: "left 0.18s",
            boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          }} />
        </button>
      </div>

      {/* Campos de cantidad — se ocultan si es ilimitado */}
      {!form.bIlimitado && (
        <>
          <ModalField label="Cantidad a ingresar" required>
            <ModalInput
              type="number"
              min={1}
              placeholder="Ej. 40"
              value={form.eCantIngresada}
              onChange={(e) => setForm({ ...form, eCantIngresada: e.target.value })}
            />
          </ModalField>
          <ModalField label="Stock mínimo" required>
            <ModalInput
              type="number"
              min={0}
              placeholder="Ej. 5"
              value={form.eStockMinimo}
              onChange={(e) => setForm({ ...form, eStockMinimo: e.target.value })}
            />
          </ModalField>
          <ModalInfo>
            <Package />
            El stock mínimo define cuándo se muestra la alerta de "Stock bajo".
          </ModalInfo>
        </>
      )}

      {/* Info cuando es ilimitado */}
      {form.bIlimitado && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          background: "var(--color-primary-50)",
          border: "1px solid var(--color-primary-light)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-2) var(--space-3)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-primary-dark)",
        }}>
          <InfinityIcon size={18} />
          Este producto siempre estará disponible en el menú del empleado sin límite de cantidad.
        </div>
      )}
    </Modal>
  );
}
"use client";

import { useState } from "react";
import { Trash2, Minus, Plus, NotebookPen, Banknote, CreditCard, Smartphone } from "lucide-react";
import type { ItemCarritoMenu } from "@/app/empleado/menu/MenuClient";
import styles from "./PedidoPanel.module.css";
import type { MetodoPago } from "@/types";

interface Props {
  items: ItemCarritoMenu[];
  onCambiarCantidad: (eCodProduct: string, delta: number) => void;
  onLimpiar: () => void;
  onFinalizar: (metodoPago: MetodoPago) => Promise<void>;
  error?: string | null;
}

const IVA = 0.16;

const METODOS: { value: MetodoPago; label: string; icon: React.ReactNode }[] = [
  { value: "efectivo",      label: "Efectivo",      icon: <Banknote size={18} />   },
  { value: "tarjeta",       label: "Tarjeta",       icon: <CreditCard size={18} /> },
  { value: "transferencia", label: "QR / Transfer", icon: <Smartphone size={18} /> },
];

export function PedidoPanel({ items, onCambiarCantidad, onLimpiar, onFinalizar, error }: Props) {
  const [metodoPago, setMetodoPago] = useState<MetodoPago>("efectivo");
  const [cargando, setCargando] = useState(false);

  const subtotal = items.reduce(
    (acc, i) => acc + i.producto.ePriceProduct * i.cantidad,
    0
  );
  const iva   = subtotal * IVA;
  const total = subtotal + iva;

  async function handleFinalizar() {
    if (items.length === 0 || cargando) return;
    setCargando(true);
    await onFinalizar(metodoPago);  // ← pasa el método seleccionado
    setCargando(false);
  }

  return (
    <aside className={styles.panel}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerTitulo}>
          <NotebookPen size={18} className={styles.headerIcono} />
          <h2 className={styles.titulo}>Pedido Actual</h2>
        </div>
        {items.length > 0 && (
          <button className={styles.btnLimpiar} onClick={onLimpiar} title="Limpiar pedido">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* ── Lista de ítems ── */}
      <div className={styles.lista}>
        {items.length === 0 ? (
          <div className={styles.vacio}>
            <NotebookPen size={36} strokeWidth={1.2} />
            <p>Agrega productos al pedido</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.producto.eCodProduct} className={styles.item}>
              <div className={styles.itemImg}>
                {item.producto.ImgProduct ? (
                  <img src={item.producto.ImgProduct} alt={item.producto.tNameProduct} />
                ) : (
                  <div className={styles.itemImgPlaceholder} />
                )}
              </div>
              <div className={styles.itemInfo}>
                <p className={styles.itemNombre}>{item.producto.tNameProduct}</p>
                <span className={styles.itemPrecioUnit}>
                  ${item.producto.ePriceProduct.toFixed(2)}
                </span>
              </div>
              <div className={styles.itemControles}>
                <button
                  className={styles.btnCantidad}
                  onClick={() => onCambiarCantidad(item.producto.eCodProduct, -1)}
                  aria-label="Quitar uno"
                >
                  <Minus size={11} strokeWidth={2.5} />
                </button>
                <span className={styles.cantidad}>{item.cantidad}</span>
                <button
                  className={styles.btnCantidad}
                  onClick={() => onCambiarCantidad(item.producto.eCodProduct, 1)}
                  aria-label="Agregar uno"
                >
                  <Plus size={11} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Totales ── */}
      {items.length > 0 && (
        <div className={styles.totales}>
          <div className={styles.lineaTotal}>
            <span className={styles.totalLabel}>Sub Total</span>
            <span className={styles.totalValor}>${subtotal.toFixed(2)}</span>
          </div>
          <div className={styles.lineaTotal}>
            <span className={styles.totalLabel}>IVA (16%)</span>
            <span className={styles.totalValor}>${iva.toFixed(2)}</span>
          </div>
          <div className={styles.separador} />
          <div className={styles.lineaTotal}>
            <span className={styles.totalFinalLabel}>Monto Total</span>
            <span className={styles.totalFinalValor}>${total.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* ── Métodos de pago ── */}
      {items.length > 0 && (
        <div className={styles.metodos}>
          {METODOS.map((m) => (
            <button
              key={m.value}
              className={`${styles.metodoBtn} ${metodoPago === m.value ? styles.metodoBtnActivo : ""}`}
              onClick={() => setMetodoPago(m.value)}
              title={m.label}
            >
              <span className={styles.metodoIcono}>{m.icon}</span>
              <span className={styles.metodoLabel}>{m.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Error de stock u otro ── */}
      {error && items.length > 0 && (
        <div className={styles.error}>⚠ {error}</div>
      )}

      {/* ── Botón finalizar ── */}
      <div className={styles.footerAccion}>
        <button
          className={styles.btnFinalizar}
          disabled={items.length === 0 || cargando}
          onClick={handleFinalizar}
        >
          {cargando
            ? "Procesando..."
            : items.length === 0
            ? "Finalizar"
            : `Cobrar $${total.toFixed(2)}`}
        </button>
      </div>

    </aside>
  );
}
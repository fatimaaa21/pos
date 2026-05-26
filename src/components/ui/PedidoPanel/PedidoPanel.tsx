"use client";

import { useState } from "react";
import { Trash2, Minus, Plus, NotebookPen } from "lucide-react";
import * as Icons from "lucide-react";
import type { ItemCarritoMenu } from "@/app/empleado/menu/MenuClient";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import type { MetodoPago }       from "@/types";
import styles from "./PedidoPanel.module.css";
import { ModalEfectivo } from "@/components/ui/ModalEfectivo/ModalEfectivo";

interface Props {
  items:        ItemCarritoMenu[];
  metodosPago:  MetodoPagoGlobal[];
  onCambiarCantidad: (eCodProduct: string, delta: number) => void;
  onLimpiar:    () => void;
  onFinalizar:  (metodoPago: MetodoPago) => Promise<void>;
  error?:       string | null;
}

const IVA = 0.16;

function IconoMetodo({ nombre, size = 18 }: { nombre: string; size?: number }) {
  const Icono = (Icons as any)[nombre];
  return Icono ? <Icono size={size} /> : <Icons.CreditCard size={size} />;
}

// Detecta si un MetodoPagoGlobal corresponde a efectivo.
// Estrategia 1: campo tTipoPay === "efectivo" (si el backend lo expone).
// Estrategia 2: el nombre contiene "efectivo" (case-insensitive, fallback robusto).
function esMetodoEfectivo(metodo: MetodoPagoGlobal): boolean {
  if ("tTipoPay" in metodo && (metodo as any).tTipoPay === "efectivo") return true;
  return metodo.tNamePay.toLowerCase().includes("efectivo");
}

export function PedidoPanel({
  items,
  metodosPago,
  onCambiarCantidad,
  onLimpiar,
  onFinalizar,
  error,
}: Props) {
  const [metodoPago, setMetodoPago] = useState<string>(
    metodosPago[0]?.eCodPay ?? ""
  );
  const [cargando, setCargando] = useState(false);
  const [modalEfectivoAbierto, setModalEfectivoAbierto] = useState(false);

  const subtotal = items.reduce(
    (acc, i) => acc + i.producto.ePriceProduct * i.cantidad,
    0
  );
  const iva   = subtotal * IVA;
  const total = subtotal + iva;

  // Resuelve si el método activo es efectivo
  const metodoSeleccionado = metodosPago.find((m) => m.eCodPay === metodoPago);
  const metodoEsEfectivo   = metodoSeleccionado ? esMetodoEfectivo(metodoSeleccionado) : false;

  function handleClickCobrar() {
    if (items.length === 0 || cargando || !metodoPago) return;
    // Si es efectivo → abrir modal de ingreso y vuelto
    if (metodoEsEfectivo) {
      setModalEfectivoAbierto(true);
      return;
    }
    // Tarjeta, QR, etc. → procesar directo (sin modal)
    procesarVenta();
  }

  async function handleConfirmarEfectivo(_montoPagado: number) {
    setModalEfectivoAbierto(false);
    await procesarVenta();
  }

  async function procesarVenta() {
    setCargando(true);
    await onFinalizar(metodoPago as MetodoPago);
    setCargando(false);
  }

  return (
    <>
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

        {/* ── Métodos de pago dinámicos (los que el Admin activó) ── */}
        {items.length > 0 && (
          <div className={styles.metodos}>
            {metodosPago.length === 0 ? (
              <p style={{ fontSize: 11, color: "var(--gray)", textAlign: "center", padding: "var(--space-2) 0" }}>
                Sin métodos de pago configurados
              </p>
            ) : (
              metodosPago.map((m) => (
                <button
                  key={m.eCodPay}
                  className={`${styles.metodoBtn} ${metodoPago === m.eCodPay ? styles.metodoBtnActivo : ""}`}
                  onClick={() => setMetodoPago(m.eCodPay)}
                  title={m.tNamePay}
                >
                  <span className={styles.metodoIcono}>
                    <IconoMetodo nombre={m.tIconPay} />
                  </span>
                  <span className={styles.metodoLabel}>{m.tNamePay}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Error ── */}
        {error && items.length > 0 && (
          <div className={styles.error}>⚠ {error}</div>
        )}

        {/* ── Botón finalizar ── */}
        <div className={styles.footerAccion}>
          <button
            className={styles.btnFinalizar}
            disabled={items.length === 0 || cargando || !metodoPago}
            onClick={handleClickCobrar}
          >
            {cargando
              ? "Procesando..."
              : items.length === 0
              ? "Finalizar"
              : `Cobrar $${total.toFixed(2)}`}
          </button>
        </div>

      </aside>

      {/* ── Modal efectivo — solo aparece cuando el método activo es efectivo ── */}
      {modalEfectivoAbierto && (
        <ModalEfectivo
          total={total}
          onConfirmar={handleConfirmarEfectivo}
          onCancelar={() => setModalEfectivoAbierto(false)}
        />
      )}
    </>
  );
}
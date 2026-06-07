"use client";

import { useState } from "react";
import { Trash2, Minus, Plus, NotebookPen, ShoppingCart } from "lucide-react";
import * as Icons from "lucide-react";
import type { ItemCarritoMenu, MetodoPago } from "@/types";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import styles from "./PedidoPanel.module.css";
import { ModalEfectivo } from "@/components/ui/ModalEfectivo/ModalEfectivo";

interface Props {
  items:             ItemCarritoMenu[];
  metodosPago:       MetodoPagoGlobal[];
  onCambiarCantidad: (key: string, delta: number) => void;
  onLimpiar:         () => void;
  onFinalizar:       (metodoPago: MetodoPago) => Promise<void>;
  error?:            string | null;
  bloqueado?:        boolean;
  aplicarIva?:       boolean;
}

const IVA_RATE = 0.16;

function carritoKey(item: Pick<ItemCarritoMenu, "key" | "producto" | "presentacion">): string {
  if (item.key) return item.key;
  return `${item.producto.eCodProduct}_${item.presentacion?.eCodPresentacion ?? ""}`;
}

function IconoMetodo({ nombre, size = 18 }: { nombre: string; size?: number }) {
  const Icono = (Icons as any)[nombre];
  return Icono ? <Icono size={size} /> : <Icons.CreditCard size={size} />;
}

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
  bloqueado = false,
  aplicarIva = true,
}: Props) {
  const [metodoPago, setMetodoPago]           = useState<string>(metodosPago[0]?.eCodPay ?? "");
  const [cargando, setCargando]               = useState(false);
  const [modalEfectivo, setModalEfectivo]     = useState(false);
  const [mobileExpandido, setMobileExpandido] = useState(false);

  const precioItem = (item: ItemCarritoMenu) =>
  item.tipo_producto === "medida"
    ? (item.precioCalculado ?? 0)
    : (item.presentacion?.ePricePresentacion ?? item.producto.ePriceProduct);

  const total      = items.reduce((acc, i) => acc + precioItem(i) * i.cantidad, 0);
  const subtotal   = aplicarIva ? total / (1 + IVA_RATE) : total;
  const iva        = aplicarIva ? total - subtotal : 0;
  const totalItems = items.reduce((acc, i) => acc + i.cantidad, 0);

  const metodoSeleccionado = metodosPago.find((m) => m.eCodPay === metodoPago);
  const metodoEsEfectivo   = metodoSeleccionado ? esMetodoEfectivo(metodoSeleccionado) : false;

  function handleClickCobrar() {
    if (items.length === 0 || cargando || !metodoPago) return;
    if (metodoEsEfectivo) { setModalEfectivo(true); return; }
    procesarVenta();
  }

  async function handleConfirmarEfectivo(_monto: number) {
    setModalEfectivo(false);
    await procesarVenta();
  }

  async function procesarVenta() {
    setCargando(true);
    await onFinalizar(metodoPago as MetodoPago);
    setCargando(false);
    setMobileExpandido(false);
  }

  return (
    <>
      {/* Overlay mobile — detrás del panel expandido */}
      {mobileExpandido && (
        <div
          className={styles.panelOverlay}
          onClick={() => setMobileExpandido(false)}
        />
      )}

      <aside className={`${styles.panel} ${mobileExpandido ? styles.panelExpandido : ""}`}>

        {/* ── MINI BARRA (visible en mobile colapsado, oculta en desktop) ── */}
        <div
          className={styles.miniBar}
          onClick={() => !bloqueado && setMobileExpandido(true)}
        >
          <div className={styles.miniBarInfo}>
            <span className={styles.miniBarCount}>
              {totalItems === 0 ? "Sin productos" : `${totalItems} producto${totalItems !== 1 ? "s" : ""}`}
            </span>
            <span className={styles.miniBarTotal}>
              {totalItems > 0 ? `$${total.toFixed(2)}` : "Pedido vacío"}
            </span>
          </div>
          <button
            className={`${styles.miniBarBtn} ${totalItems === 0 || bloqueado ? styles.miniBarBtnDisabled : ""}`}
            onClick={(e) => { e.stopPropagation(); if (!bloqueado && totalItems > 0) setMobileExpandido(true); }}
            disabled={totalItems === 0 || bloqueado}
          >
            <ShoppingCart size={15} />
            Ver pedido
          </button>
        </div>

        {/* ── CONTENIDO COMPLETO (siempre en DOM, CSS lo oculta en mobile colapsado) ── */}
        <div className={styles.panelContent}>

          {/* Header */}
          <div
            className={styles.header}
            onClick={() => mobileExpandido && setMobileExpandido(false)}
          >
            <div className={styles.headerTitulo}>
              <NotebookPen size={18} className={styles.headerIcono} />
              <h2 className={styles.titulo}>Pedido Actual</h2>
            </div>
            {items.length > 0 && (
              <button
                className={styles.btnLimpiar}
                onClick={(e) => { e.stopPropagation(); onLimpiar(); }}
                title="Limpiar pedido"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>

          {/* Lista */}
          <div className={styles.lista}>
            {items.length === 0 ? (
              <div className={styles.vacio}>
                <NotebookPen size={36} strokeWidth={1.2} />
                <p>Agrega productos al pedido</p>
              </div>
            ) : (
              items.map((item) => {
                const key      = carritoKey(item);
                const precio   = item.tipo_producto === "medida"
                  ? (item.precioCalculado ?? 0)
                  : precioItem(item);
                const esMedida = item.tipo_producto === "medida";
                const stock    = item.presentacion?.stockDisponible ?? item.producto.stockDisponible;
                const bInf     = item.presentacion?.bInfinito       ?? item.producto.bInfinito;
                const maxAlcanzado = !esMedida && !bInf && item.cantidad >= stock;

                return (
                  <div key={key} className={styles.item}>
                    <div className={styles.itemImg}>
                      {item.producto.ImgProduct ? (
                        <img src={item.producto.ImgProduct} alt={item.producto.tNameProduct} />
                      ) : (
                        <div className={styles.itemImgPlaceholder} />
                      )}
                    </div>
                    <div className={styles.itemInfo}>
                      <p className={styles.itemNombre}>
                        {item.producto.tNameProduct}
                        {item.presentacion && (
                          <span className={styles.itemPresentacion}> ({item.presentacion.tNombre})</span>
                        )}
                      </p>
                      {esMedida ? (
                        <span className={styles.itemPresentacion} style={{ color: "var(--gray)", fontSize: 11 }}>
                          {item.anchoCm}m × {item.largoCm}m · {item.materialNombre}
                        </span>
                      ) : null}
                      <span className={styles.itemPrecioUnit}>${precio.toFixed(2)}</span>
                    </div>
                    <div className={styles.itemControles}>
                      <button className={styles.btnCantidad} onClick={() => onCambiarCantidad(key, -1)}>
                        <Minus size={11} strokeWidth={2.5} />
                      </button>
                      <span className={styles.cantidad}>{item.cantidad}</span>
                      {!esMedida && (
                        <button
                          className={`${styles.btnCantidad} ${maxAlcanzado ? styles.btnCantidadMax : ""}`}
                          onClick={() => !maxAlcanzado && onCambiarCantidad(key, 1)}
                          disabled={maxAlcanzado}
                        >
                          <Plus size={11} strokeWidth={2.5} />
                        </button>
                      )}
                      {esMedida && (
                        <div style={{ width: 22 }} /> 
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Totales */}
          {items.length > 0 && (
            <div className={styles.totales}>
              <div className={styles.lineaTotal}>
                <span className={styles.totalLabel}>Sub Total</span>
                <span className={styles.totalValor}>${subtotal.toFixed(2)}</span>
              </div>
              {aplicarIva ? (
                <div className={styles.lineaTotal}>
                  <span className={styles.totalLabel}>IVA (16%)</span>
                  <span className={styles.totalValor}>${iva.toFixed(2)}</span>
                </div>
              ) : (
                <div className={styles.lineaTotal}>
                  <span style={{ fontSize: 11, color: "var(--gray)", fontStyle: "italic" }}>Sin IVA</span>
                </div>
              )}
              <div className={styles.separador} />
              <div className={styles.lineaTotal}>
                <span className={styles.totalFinalLabel}>Monto Total</span>
                <span className={styles.totalFinalValor}>${total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Métodos de pago */}
          {items.length > 0 && (
            <div className={styles.metodos}>
              {metodosPago.length === 0 ? (
                <p style={{ fontSize: 11, color: "var(--gray)", textAlign: "center", padding: "var(--space-2) 0" }}>
                  Sin métodos configurados
                </p>
              ) : (
                metodosPago.map((m) => (
                  <button
                    key={m.eCodPay}
                    className={`${styles.metodoBtn} ${metodoPago === m.eCodPay ? styles.metodoBtnActivo : ""}`}
                    onClick={() => setMetodoPago(m.eCodPay)}
                    title={m.tNamePay}
                  >
                    <span className={styles.metodoIcono}><IconoMetodo nombre={m.tIconPay} /></span>
                    <span className={styles.metodoLabel}>{m.tNamePay}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {error && items.length > 0 && (
            <div className={styles.error}>⚠ {error}</div>
          )}

          <div className={styles.footerAccion}>
            <button
              className={styles.btnFinalizar}
              disabled={items.length === 0 || cargando || !metodoPago || bloqueado}
              onClick={handleClickCobrar}
            >
              {cargando
                ? "Procesando..."
                : items.length === 0
                ? "Finalizar"
                : `Cobrar $${total.toFixed(2)}`}
            </button>
          </div>

        </div>{/* /panelContent */}
      </aside>

      {modalEfectivo && (
        <ModalEfectivo
          total={total}
          onConfirmar={handleConfirmarEfectivo}
          onCancelar={() => setModalEfectivo(false)}
        />
      )}
    </>
  );
}
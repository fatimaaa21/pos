"use client";
// src/app/ticket/[eCodVenta]/TicketClient.tsx
//
// Client Component que:
//  1. Dispara window.print() automáticamente al montar
//  2. Renderiza el ticket tanto en pantalla (preview) como en impresión
//
// Diseño deliberadamente monoespaciado: las térmicas interpretan
// texto de ancho fijo perfectamente y sin artifacts de renderizado.

import { useEffect } from "react";
import styles from "./ticket.module.css";

const IVA_RATE = 0.16;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Detalle {
  eCodDetalle:       string;
  eCantidad:         number;
  ePrecioUnitario:   number;
  eSubtotal:         number;
  producto:          { tNameProduct: string } | null;
  presentacion:      { tNombre: string }      | null;
}

interface Props {
  venta: {
    eCodVenta:     string;
    eTotal:        number;
    fhCreateVenta: string;
  };
  detalles:       Detalle[];
  negocio: {
    tNameCompany: string;
    imgCompany:   string | null;
    aplicarIva:   boolean;
  };
  metodoPago:     string;
  empleadoNombre: string;
}

// ── Helper: genera una línea de separador ─────────────────────────────────────
// 32 caracteres ≈ ancho cómodo para 72mm en Courier New 10.5px

function Sep({ doble = false }: { doble?: boolean }) {
  const char = doble ? "═" : "─";
  return <span className={styles.sep}>{char.repeat(32)}</span>;
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TicketClient({
  venta,
  detalles,
  negocio,
  metodoPago,
  empleadoNombre,
}: Props) {
  const { aplicarIva } = negocio;
  const total    = venta.eTotal;
  const subtotal = aplicarIva ? total / (1 + IVA_RATE) : total;
  const iva      = aplicarIva ? total - subtotal : 0;

  // ── Formato de fecha/hora ──────────────────────────────────────────────────
  const fecha   = new Date(venta.fhCreateVenta);
  const fechaStr = fecha.toLocaleDateString("es-MX", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  });
  const horaStr = fecha.toLocaleTimeString("es-MX", {
    hour:   "2-digit",
    minute: "2-digit",
  });

  const folio = venta.eCodVenta.slice(-8).toUpperCase();

  const fmt = (n: number) =>
    n.toLocaleString("es-MX", {
      style:                 "currency",
      currency:              "MXN",
      minimumFractionDigits: 2,
    });

  // ── Auto-print al montar ───────────────────────────────────────────────────
  // El delay de 600ms da tiempo a que el browser termine de renderizar
  // el ticket antes de abrir el diálogo de impresión.
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>

      {/* ── Barra de herramientas (solo pantalla, oculta al imprimir) ── */}
      <div className={styles.acciones}>
        {/* Anchor en lugar de window.open() → evita bloqueadores de popups */}
        <button
          className={styles.btnPrint}
          onClick={() => window.print()}
          aria-label="Imprimir ticket"
        >
          🖨 Imprimir
        </button>
        <button
          className={styles.btnClose}
          onClick={() => window.close()}
          aria-label="Cerrar ventana"
        >
          Cerrar
        </button>
      </div>

      <span className={styles.label}>
        Vista previa · 72mm térmica
      </span>

      {/* ══════════════════════════════
          TICKET
          ══════════════════════════════ */}
      <div className={styles.ticket}>

        {/* ── Cabecera: logo + nombre ── */}
        {negocio.imgCompany && (
          <img
            src={negocio.imgCompany}
            alt={negocio.tNameCompany}
            className={styles.logo}
          />
        )}

        <div className={styles.nombreNegocio}>
          {negocio.tNameCompany}
        </div>
        <div className={styles.sistemaNombre}>
          Sistema Kivi POS
        </div>

        <Sep doble />

        {/* ── Folio ── */}
        <div className={styles.folio}>
          Folio: #{folio}
        </div>

        <Sep />

        {/* ── Metadatos ── */}
        <div className={styles.fila}>
          <span className={styles.filaLabel}>Fecha:</span>
          <span className={styles.filaValor}>{fechaStr}</span>
        </div>
        <div className={styles.fila}>
          <span className={styles.filaLabel}>Hora:</span>
          <span className={styles.filaValor}>{horaStr}</span>
        </div>
        <div className={styles.fila}>
          <span className={styles.filaLabel}>Atendió:</span>
          <span className={styles.filaValor}>{empleadoNombre}</span>
        </div>

        <Sep />

        {/* ── Header de columnas ── */}
        <div className={styles.itemsHeader}>
          <span>Producto</span>
          <span>Cant</span>
          <span>Total</span>
        </div>

        <Sep />

        {/* ── Ítems ── */}
        {detalles.map((d) => {
          const nombre = d.producto?.tNameProduct ?? "Producto";
          const pres   = d.presentacion?.tNombre;

          return (
            <div key={d.eCodDetalle} className={styles.item}>
              <div className={styles.itemNombreFila}>
                <div>
                  <div className={styles.itemNombre}>{nombre}</div>
                  {pres && (
                    <div className={styles.itemPresentacion}>  ({pres})</div>
                  )}
                  <div className={styles.itemUnitario}>
                    c/u {fmt(d.ePrecioUnitario)}
                  </div>
                </div>
                <span className={styles.itemCantidad}>×{d.eCantidad}</span>
                <span className={styles.itemSubtotal}>{fmt(d.eSubtotal)}</span>
              </div>
            </div>
          );
        })}

        <Sep />

        {/* ── Totales ── */}
        <div className={styles.totales}>
          {aplicarIva ? (
            <>
              <div className={styles.totalLinea}>
                <span>Subtotal:</span>
                <span>{fmt(subtotal)}</span>
              </div>
              <div className={styles.totalLinea}>
                <span>IVA (16%):</span>
                <span>{fmt(iva)}</span>
              </div>
            </>
          ) : (
            <div className={styles.totalLinea}>
              <span style={{ fontSize: 8, opacity: 0.6 }}>Precio incluye impuestos</span>
            </div>
          )}

          <div className={styles.totalLineaDestacada}>
            <span>TOTAL:</span>
            <span>{fmt(total)}</span>
          </div>
        </div>

        <Sep />

        {/* ── Método de pago ── */}
        <div className={styles.fila}>
          <span className={styles.filaLabel}>Pago con:</span>
          <span className={styles.filaValor}>{metodoPago}</span>
        </div>

        <Sep doble />

        {/* ── Pie ── */}
        <div className={styles.gracias}>¡Gracias por su compra!</div>
        <div className={styles.pieInfo}>
          Conserve este comprobante
        </div>

        <Sep doble />
      </div>
    </div>
  );
}
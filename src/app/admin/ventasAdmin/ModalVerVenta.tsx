// src/app/admin/ventas/ModalVerVenta.tsx
"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora } from "@/lib/utils/fecha";
import type { VentaAdmin } from "./ventasAdminClient";
import styles from "./ventasAdmin.module.css";
import { Banknote, CreditCard, Smartphone } from "lucide-react";

interface Props {
  venta:   VentaAdmin;
  onClose: () => void;
}

const METODO_CONFIG = {
  efectivo:      { label: "Efectivo",      icon: <Banknote   size={14} /> },
  tarjeta:       { label: "Tarjeta",       icon: <CreditCard size={14} /> },
  transferencia: { label: "QR / Transfer", icon: <Smartphone size={14} /> },
} as const;

export function ModalVerVenta({ venta, onClose }: Props) {
  const folio  = venta.eCodVenta.slice(-8).toUpperCase();
  const metodo = METODO_CONFIG[venta.eMetodoPago] ?? METODO_CONFIG.efectivo;
  const subtotal = venta.detalle_venta.reduce((acc, d) => acc + d.eSubtotal, 0);
  const iva      = venta.eTotal - subtotal > 0.01 ? venta.eTotal - subtotal : null;

  return (
    <Modal
      titulo={`Venta #${folio}`}
      onCerrar={onClose}
      labelCancelar="Cerrar"
      ancho="sm"
    >
      {/* Encabezado de la venta */}
      <div className={styles.modalHeader}>
        <div className={styles.modalHeaderInfo}>
          <div className={styles.modalFecha}>{formatFechaHora(venta.fhCreateVenta)}</div>
          <div className={styles.modalEmpleado}>
            <div className={styles.avatarEmpleado}>
              {(venta.empleado?.tNameUser ?? "?")[0].toUpperCase()}
            </div>
            <span>{venta.empleado?.tNameUser ?? "Empleado desconocido"}</span>
          </div>
        </div>
        <span className={`${styles.metodoBadge} ${styles[`metodo_${venta.eMetodoPago}`]}`}>
          {metodo.icon}
          {metodo.label}
        </span>
      </div>

      {/* Detalle de productos */}
      <div className={styles.modalDetalle}>
        <div className={styles.modalDetalleHeader}>
          <span>Pzas</span>
          <span>Producto</span>
          <span>Precio</span>
          <span>Subtotal</span>
        </div>

        {venta.detalle_venta.map((d) => (
          <div key={d.eCodDetalle} className={styles.modalDetalleRow}>
            <span className={styles.modalCantidad}>{d.eCantidad}</span>
            <span className={styles.modalNombre}>
              {d.producto?.tNameProduct ?? "—"}
            </span>
            <span className={styles.modalPrecio}>
              ${d.ePrecioUnitario.toFixed(2)}
            </span>
            <span className={styles.modalSubtotal}>
              ${d.eSubtotal.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div className={styles.modalTotales}>
        <div className={styles.modalLineaTotal}>
          <span className={styles.modalTotalLabel}>Subtotal</span>
          <span className={styles.modalTotalValor}>${subtotal.toFixed(2)}</span>
        </div>
        {iva !== null && (
          <div className={styles.modalLineaTotal}>
            <span className={styles.modalTotalLabel}>IVA (16%)</span>
            <span className={styles.modalTotalValor}>${iva.toFixed(2)}</span>
          </div>
        )}
        <div className={styles.modalSeparador} />
        <div className={styles.modalLineaTotal}>
          <span className={styles.modalTotalFinalLabel}>Total</span>
          <span className={styles.modalTotalFinalValor}>${venta.eTotal.toFixed(2)}</span>
        </div>
      </div>
    </Modal>
  );
}
"use client";

import * as Icons from "lucide-react";
import { Modal }  from "@/components/ui/Modal";
import { formatFechaHora } from "@/lib/utils/fecha";
import type { VentaAdmin }       from "./ventasAdminClient";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import styles from "./ventasAdmin.module.css";

const IVA_RATE = 0.16;

interface Props {
  venta:       VentaAdmin;
  metodosPago: MetodoPagoGlobal[];
  aplicarIva:  boolean;
  onClose:     () => void;
}

export function ModalVerVenta({ venta, metodosPago, aplicarIva, onClose }: Props) {
  const folio = venta.eCodVenta.slice(-8).toUpperCase();

  // El total guardado siempre incluye el IVA (si aplica) — los precios ya lo llevan.
  // Para el desglose extraemos: subtotal = total / (1 + IVA), iva = total - subtotal.
  const total    = venta.eTotal;
  const subtotal = aplicarIva ? total / (1 + IVA_RATE) : total;
  const iva      = aplicarIva ? total - subtotal : null;

  const metodo       = metodosPago.find((m) => m.eCodPay === venta.fkeMetodoPago);
  const Icono        = metodo ? ((Icons as any)[metodo.tIconPay] ?? Icons.CreditCard) : Icons.CreditCard;
  const nombreMetodo = metodo?.tNamePay ?? "Método eliminado";

  return (
    <Modal
      titulo={`Venta #${folio}`}
      onCerrar={onClose}
      labelCancelar="Cerrar"
      ancho="sm"
    >
      {/* Encabezado */}
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
        <span className={styles.metodoBadge}>
          <Icono size={13} />
          {nombreMetodo}
        </span>
      </div>

      {/* Detalle */}
      <div className={styles.modalDetalle}>
        <div className={styles.modalDetalleHeader}>
          <span>Pzas</span>
          <span>Producto</span>
          <span>Precio</span>
        </div>

        {venta.detalle_venta.map((d) => (
          <div key={d.eCodDetalle} className={styles.modalDetalleRow}>
            <span className={styles.modalCantidad}>{d.eCantidad}</span>

            <span className={styles.modalNombre}>
              {d.producto?.tNameProduct ?? "—"}
              {d.presentacion?.tNombre && (
                <span>
                  {" " + d.presentacion.tNombre}
                </span>
              )}
            </span>

            <span className={styles.modalPrecio}>${d.ePrecioUnitario.toFixed(2)}</span>
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
          <span className={styles.modalTotalFinalValor}>${total.toFixed(2)}</span>
        </div>
      </div>
    </Modal>
  );
}
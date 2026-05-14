"use client";

import { CheckCircle } from "lucide-react";
import styles from "./Modalventaexitosa.module.css";

interface Props {
  eCodVenta: string;
  onNuevoPedido: () => void;
}

export function ModalVentaExitosa({ eCodVenta, onNuevoPedido }: Props) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.iconoWrap}>
          <CheckCircle size={48} strokeWidth={1.5} className={styles.icono} />
        </div>
        <h2 className={styles.titulo}>¡Venta registrada!</h2>
        <p className={styles.subtitulo}>
          El pedido se procesó correctamente.
        </p>
        <p className={styles.codigo}>
          Folio: <strong>#{eCodVenta.slice(-8).toUpperCase()}</strong>
        </p>
        <button className={styles.btnNuevo} onClick={onNuevoPedido}>
          Nuevo pedido
        </button>
      </div>
    </div>
  );
}
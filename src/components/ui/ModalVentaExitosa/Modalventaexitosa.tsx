"use client";
// src/components/ui/ModalVentaExitosa/Modalventaexitosa.tsx

import { CheckCircle, Printer } from "lucide-react";
import styles from "./Modalventaexitosa.module.css";

interface Props {
  eCodVenta:     string;
  onNuevoPedido: () => void;
}

export function ModalVentaExitosa({ eCodVenta, onNuevoPedido }: Props) {
  const folio = eCodVenta.slice(-8).toUpperCase();

  // Abre el ticket en una ventana pequeña al lado
  // — window.open con gesto de usuario (click) no es bloqueado por browsers
  function handleImprimir() {
    window.open(
      `/ticket/${eCodVenta}`,
      `ticket_${folio}`,
      "width=420,height=680,resizable=yes,scrollbars=yes"
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* Ícono de éxito */}
        <div className={styles.iconoWrap}>
          <CheckCircle size={48} strokeWidth={1.5} className={styles.icono} />
        </div>

        <h2 className={styles.titulo}>¡Venta registrada!</h2>
        <p className={styles.subtitulo}>
          El pedido se procesó correctamente.
        </p>
        <p className={styles.codigo}>
          Folio: <strong>#{folio}</strong>
        </p>

        {/* Imprimir ticket */}
        <button className={styles.btnImprimir} onClick={handleImprimir}>
          <Printer size={16} />
          Imprimir ticket
        </button>

        {/* Nuevo pedido */}
        <button className={styles.btnNuevo} onClick={onNuevoPedido}>
          Nuevo pedido
        </button>

      </div>
    </div>
  );
}
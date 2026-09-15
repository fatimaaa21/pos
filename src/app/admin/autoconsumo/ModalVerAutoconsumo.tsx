"use client";

import { Modal } from "@/components/ui/Modal";
import { formatFechaHora } from "@/lib/utils/fecha";
import type { AutoconsumoAdminRow } from "@/types/autoconsumo";
import styles from "./autoconsumoAdmin.module.css";

interface Props {
  registro: AutoconsumoAdminRow;
  onClose:  () => void;
}

export function ModalVerAutoconsumo({ registro, onClose }: Props) {
  const valorReferencia = registro.items.reduce(
    (acc, i) => acc + i.ePrecioReferenciaSnapshot * i.eCantidad, 0
  );

  return (
    <Modal
      titulo="Detalle de autoconsumo"
      onCerrar={onClose}
      labelCancelar="Cerrar"
      ancho="sm"
    >
      <div className={styles.modalHeader}>
        <div className={styles.modalHeaderInfo}>
          <div className={styles.modalFecha}>{formatFechaHora(registro.fhCreateAutoconsumo)}</div>
          <div className={styles.modalEmpleado}>
            <div className={styles.avatarEmpleado}>
              {(registro.empleado?.tNameUser ?? "?")[0].toUpperCase()}
            </div>
            <span>{registro.empleado?.tNameUser ?? "Empleado desconocido"}</span>
          </div>
        </div>
      </div>

      <div className={styles.modalDetalle}>
        <div className={styles.modalDetalleHeader}>
          <span>Pzas</span>
          <span>Producto</span>
          <span>Referencia</span>
        </div>

        {registro.items.map((i, idx) => (
          <div key={idx} className={styles.modalDetalleRow}>
            <span className={styles.modalCantidad}>{i.eCantidad}</span>
            <span className={styles.modalNombre}>
              {i.tNombreProductoSnapshot}
              {i.tNombrePresentacionSnapshot && <span>{" " + i.tNombrePresentacionSnapshot}</span>}
              {i.extras.length > 0 && (
                <span className={styles.modalExtras}>
                  {i.extras.map((e, eIdx) => (
                    <span key={eIdx} className={styles.modalExtraLinea}>
                      {e.eCantidadSeleccionada > 1 ? `${e.eCantidadSeleccionada}× ` : ""}{e.tNombreSnapshot}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className={styles.modalPrecio}>${i.ePrecioReferenciaSnapshot.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className={styles.modalTotales}>
        <div className={styles.modalLineaTotal}>
          <span className={styles.modalTotalFinalLabel}>Valor de referencia</span>
          <span className={styles.modalTotalFinalValor}>${valorReferencia.toFixed(2)}</span>
        </div>
        <p className={styles.modalNotaAclaracion}>
          Este valor es solo de referencia — el autoconsumo no se cobra.
        </p>
      </div>

      {registro.insumosConsumidos.length > 0 && (
        <div className={styles.modalDetalle}>
          <div className={styles.modalDetalleHeader}>
            <span style={{ gridColumn: "1 / span 2" }}>Insumo descontado</span>
            <span>Cantidad</span>
          </div>
          {registro.insumosConsumidos.map((c, idx) => (
            <div key={idx} className={styles.modalDetalleRow}>
              <span className={styles.modalNombre} style={{ gridColumn: "1 / span 2" }}>
                {c.tNombreInsumoSnapshot}
              </span>
              <span className={styles.modalPrecio}>{c.eCantidadDescontada} {c.tUnidadSnapshot}</span>
            </div>
          ))}
        </div>
      )}

      {registro.tNota && (
        <p className={styles.modalNota}>&quot;{registro.tNota}&quot;</p>
      )}
    </Modal>
  );
}

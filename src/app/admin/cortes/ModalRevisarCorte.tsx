"use client";

import { useState }       from "react";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { Modal, ModalField } from "@/components/ui/Modal";
import { formatFechaHora }   from "@/lib/utils/fecha";
import { revisarCorte }      from "@/lib/actions/cortes";
import type { CorteCaja }    from "@/types";
import type { CorteConEmpleado } from "./CortesAdminClient";
import styles from "./cortes.module.css";

interface Props {
  corte:      CorteConEmpleado;
  onClose:    () => void;
  onRevisado: (corte: CorteCaja) => void;
}

export function ModalRevisarCorte({ corte, onClose, onRevisado }: Props) {
  const [nota, setNota]       = useState(corte.tNotaAdmin ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const esPendiente = corte.bStateCorte === "pendiente";
  const diferencia  = corte.eDiferencia ?? 0;

  async function handleAccion(estado: "aprobado" | "diferencia") {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("eCodCorte",    corte.eCodCorte);
    fd.append("bStateCorte", estado);
    fd.append("tNotaAdmin",   nota);

    const result = await revisarCorte(fd);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else if (result.corte) {
      onRevisado(result.corte);
    }
  }

  return (
    <Modal
      titulo={`Corte · ${corte.empleado?.tNameUser ?? "Empleado"}`}
      onCerrar={onClose}
      labelCancelar="Cerrar"
      ancho="sm"
    >
      {/* Fechas del turno */}
      <div className={styles.modalMeta}>
        <span>{formatFechaHora(corte.fhInicioTurno)}</span>
        {corte.fhCierreTurno && (
          <>
            <span className={styles.modalMetaSep}>→</span>
            <span>{formatFechaHora(corte.fhCierreTurno)}</span>
          </>
        )}
        {corte.tNombreTurno && (
          <span className={styles.modalTurnoNombre}>{corte.tNombreTurno}</span>
        )}
      </div>

      {/* Desglose por método */}
      <div className={styles.modalDesglose}>
        <div className={styles.modalDesgloseRow}>
          <Banknote size={14} className={styles.modalDesgloseIcon} />
          <span>Efectivo</span>
          <span className={styles.modalDesgloseValor}>
            {(corte.eTotalEfectivo ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
          </span>
        </div>
        <div className={styles.modalDesgloseRow}>
          <CreditCard size={14} className={styles.modalDesgloseIcon} />
          <span>Tarjeta</span>
          <span className={styles.modalDesgloseValor}>
            {(corte.eTotalTarjeta ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
          </span>
        </div>
        <div className={styles.modalDesgloseRow}>
          <Smartphone size={14} className={styles.modalDesgloseIcon} />
          <span>QR / Transferencia</span>
          <span className={styles.modalDesgloseValor}>
            {(corte.eTotalTransferencia ?? 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
          </span>
        </div>
      </div>

      {/* Resumen numérico */}
      <div className={styles.modalResumen}>
        {[
          { label: "Fondo inicial",      valor: corte.eFondoInicial ?? 0 },
          { label: "Efectivo esperado",  valor: corte.eEfectivoEsperado ?? 0 },
          { label: "Efectivo contado",   valor: corte.eEfectivoContado ?? 0 },
        ].map(({ label, valor }) => (
          <div key={label} className={styles.modalResumenRow}>
            <span className={styles.modalResumenLabel}>{label}</span>
            <span className={styles.modalResumenValor}>
              {valor.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
            </span>
          </div>
        ))}

        {/* Diferencia destacada */}
        <div className={`${styles.modalResumenRow} ${styles.modalDiferencia}`}
          data-tipo={diferencia < 0 ? "faltante" : diferencia > 0 ? "sobrante" : "ok"}
        >
          <span className={styles.modalResumenLabel}>
            {diferencia < 0 ? "Faltante" : diferencia > 0 ? "Sobrante" : "Sin diferencia"}
          </span>
          <span className={styles.modalResumenValor}>
            {diferencia.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
          </span>
        </div>
      </div>

      {/* Nota del admin — solo si está pendiente */}
      {esPendiente && (
        <ModalField label="Nota para el empleado (opcional)">
          <textarea
            className={styles.notaTextarea}
            placeholder="Ej. Verificar tickets del turno..."
            value={nota}
            onChange={e => setNota(e.target.value)}
            rows={3}
          />
        </ModalField>
      )}

      {/* Nota existente — si ya fue revisado */}
      {!esPendiente && corte.tNotaAdmin && (
        <div className={styles.notaExistente}>
          <span className={styles.notaExistenteTitulo}>Nota del admin</span>
          <span>{corte.tNotaAdmin}</span>
        </div>
      )}

      {error && <p className={styles.modalError}>{error}</p>}

      {/* Botones de acción — solo si está pendiente */}
      {esPendiente && (
        <div className={styles.modalBtnRow}>
          <button
            className={styles.btnDanger}
            onClick={() => handleAccion("diferencia")}
            disabled={loading}
          >
            Marcar diferencia
          </button>
          <button
            className={styles.btnSuccess}
            onClick={() => handleAccion("aprobado")}
            disabled={loading}
          >
            {loading ? "Guardando..." : "Aprobar"}
          </button>
        </div>
      )}
    </Modal>
  );
}
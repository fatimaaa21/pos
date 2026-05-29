"use client";

import { useState, useTransition }       from "react";
import { AlertTriangle, CheckCircle, Banknote, CreditCard, Smartphone, TrendingUp } from "lucide-react";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { cerrarTurno }                   from "@/lib/actions/cortes";
import type { CorteCaja, VentasDelTurno } from "@/types";
import styles from "./modalCerrarCaja.module.css";

interface Props {
  corte:          CorteCaja;
  ventasDelTurno: VentasDelTurno;
  onClose:        () => void;
  onCerrado:      () => void;
}

export function ModalCerrarCaja({ corte, ventasDelTurno, onClose, onCerrado }: Props) {
  const [isPending, startTransition] = useTransition();
  const [efectivoContado, setEfectivoContado] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fondoNum           = corte.eFondoInicial;
  const efectivoEsperado   = fondoNum + ventasDelTurno.eTotalEfectivo;
  const efectivoContadoNum = parseFloat(efectivoContado) || 0;
  const diferencia         = efectivoContadoNum - efectivoEsperado;
  const hayDiferencia      = efectivoContado !== "" && Math.abs(diferencia) > 0.01;

  async function handleConfirmar() {
    setError(null);
    const fd = new FormData();
    fd.append("eEfectivoContado", efectivoContado);

    startTransition(async () => {
      const result = await cerrarTurno(fd);
      if (result.error) {
        setError(result.error);
      } else {
        onCerrado();
      }
    });
  }

  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  return (
    <Modal
      titulo="Cerrar caja"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Enviar corte"
      labelCancelar="Cancelar"
      cargando={isPending}
      deshabilitado={efectivoContado === ""}
      error={error}
    >
      {/* ── Fondo inicial ── */}
      <div className={styles.fila}>
        <span className={styles.filaLabel}>Fondo inicial</span>
        <span className={styles.filaValor}>{fmt(fondoNum)}</span>
      </div>

      {/* ── Desglose por método ── */}
      <div className={styles.desglose}>
        <p className={styles.desgloseTitle}>Desglose por método de pago</p>
        <div className={styles.desgloseFila}>
          <Banknote size={14} className={styles.desgloseIcono} />
          <span className={styles.desgloseLabel}>Efectivo</span>
          <span className={styles.desgloseValor}>{fmt(ventasDelTurno.eTotalEfectivo)}</span>
        </div>
        <div className={styles.desgloseFila}>
          <CreditCard size={14} className={styles.desgloseIcono} />
          <span className={styles.desgloseLabel}>Tarjeta</span>
          <span className={styles.desgloseValor}>{fmt(ventasDelTurno.eTotalTarjeta)}</span>
        </div>
        <div className={styles.desgloseFila}>
          <Smartphone size={14} className={styles.desgloseIcono} />
          <span className={styles.desgloseLabel}>QR / Transferencia</span>
          <span className={styles.desgloseValor}>{fmt(ventasDelTurno.eTotalTransferencia)}</span>
        </div>
        <div className={`${styles.desgloseFila} ${styles.desgloseTotal}`}>
          <TrendingUp size={14} className={styles.desgloseIcono} />
          <span className={styles.desgloseLabel}>Efectivo esperado en caja</span>
          <span className={styles.desgloseValor}>{fmt(efectivoEsperado)}</span>
        </div>
      </div>

      {/* ── Conteo físico ── */}
      <ModalField label="Efectivo real en caja" required>
        <ModalInput
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={efectivoContado}
          onChange={e => setEfectivoContado(e.target.value)}
          autoFocus
        />
      </ModalField>

      {/* ── Preview diferencia ── */}
      {efectivoContado !== "" && (
        <div className={`${styles.diferencia} ${
          hayDiferencia
            ? diferencia < 0 ? styles.faltante : styles.sobrante
            : styles.ok
        }`}>
          {hayDiferencia ? (
            <>
              <AlertTriangle size={14} />
              <span>
                {diferencia < 0 ? "Faltante" : "Sobrante"}: {fmt(Math.abs(diferencia))}
              </span>
            </>
          ) : (
            <>
              <CheckCircle size={14} />
              <span>Sin diferencia</span>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
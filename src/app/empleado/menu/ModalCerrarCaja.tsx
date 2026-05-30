"use client";

import { useState }    from "react";
import {
  Timer, Banknote, CreditCard, Smartphone,
  TrendingUp, AlertTriangle, CheckCircle, ArrowRight, TriangleAlert,
} from "lucide-react";
import { Modal, ModalField } from "@/components/ui/Modal";
import { Badge }             from "@/components/ui/Badge";
import { formatFechaHora }   from "@/lib/utils/fecha";
import { cerrarTurno }       from "@/lib/actions/cortes";
import type { CorteCaja, VentasDelTurno } from "@/types";
import styles from "./modalCerrarCaja.module.css";

interface Props {
  corte:          CorteCaja;
  ventasDelTurno: VentasDelTurno;
  onClose:        () => void;
  onCerrado:      () => void;
}

export function ModalCerrarCaja({ corte, ventasDelTurno, onClose, onCerrado }: Props) {
  const [efectivoContado, setEfectivoContado] = useState("");
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);

  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  const efectivoEsperado = (corte.eFondoInicial ?? 0) + (ventasDelTurno.eTotalEfectivo ?? 0);

  const montoContado = efectivoContado !== "" ? parseFloat(efectivoContado) : null;
  const diferencia   = montoContado != null ? montoContado - efectivoEsperado : null;

  const difClase =
    diferencia == null ? styles.diferenciaEspera :
    diferencia < 0     ? styles.diferenciaFaltante :
    diferencia > 0     ? styles.diferenciaSobrante :
                         styles.diferenciaOk;

  const difIcono =
    diferencia == null ? <Timer size={13} /> :
    diferencia < 0     ? <AlertTriangle size={13} /> :
    diferencia > 0     ? <ArrowRight    size={13} /> :
                         <CheckCircle   size={13} />;

  const difLabel =
    diferencia == null ? "Ingresa el efectivo contado" :
    diferencia < 0     ? "Faltante" :
    diferencia > 0     ? "Sobrante" :
                         "Sin diferencia";

  async function handleConfirmar() {
    if (montoContado === null || isNaN(montoContado) || montoContado < 0) return;

    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("eEfectivoContado", String(montoContado));

    const result = await cerrarTurno(fd);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onCerrado();
    }
  }

  return (
    <Modal
      titulo="Cerrar caja"
      onCerrar={onClose}
      onConfirmar={handleConfirmar}
      labelConfirmar="Cerrar caja"
      labelCancelar="Cancelar"
      cargando={loading}
      deshabilitado={montoContado === null || isNaN(montoContado ?? NaN)}
      error={error}
      ancho="sm"
    >
      {/* ── Header del turno ── */}
      <div className={styles.turnoWrap}>
        <div className={styles.turnoIcono}>
          <Timer size={22} />
        </div>
        <span className={styles.turnoNombre}>
          {corte.tNombreTurno ?? "Turno sin nombre"}
        </span>
        <Badge variante="empleado">En turno</Badge>
        <div className={styles.fechas}>
          <span>{formatFechaHora(corte.fhInicioTurno)}</span>
          <span className={styles.fechaSep}>→</span>
          <span>Ahora</span>
        </div>
      </div>

      {/* ── Desglose de ventas ── */}
      <div>
        <p className={styles.secTitulo}>Ventas del turno</p>
        <div className={styles.desglose}>
          <div className={styles.desgloseRow}>
            <div className={styles.desgloseIcono}><Banknote size={14} /></div>
            <span className={styles.desgloseLabel}>Efectivo</span>
            <span className={styles.desgloseValor}>{fmt(ventasDelTurno.eTotalEfectivo)}</span>
          </div>
          <div className={styles.desgloseRow}>
            <div className={styles.desgloseIcono}><CreditCard size={14} /></div>
            <span className={styles.desgloseLabel}>Tarjeta</span>
            <span className={styles.desgloseValor}>{fmt(ventasDelTurno.eTotalTarjeta)}</span>
          </div>
          <div className={styles.desgloseRow}>
            <div className={styles.desgloseIcono}><Smartphone size={14} /></div>
            <span className={styles.desgloseLabel}>QR / Transferencia</span>
            <span className={styles.desgloseValor}>{fmt(ventasDelTurno.eTotalTransferencia)}</span>
          </div>
          <div className={`${styles.desgloseRow} ${styles.desgloseTotal}`}>
            <div className={styles.desgloseIcono}><TrendingUp size={14} /></div>
            <span className={styles.desgloseLabel}>Total de ventas</span>
            <span className={styles.desgloseValor}>{fmt(ventasDelTurno.eTotalVentas)}</span>
          </div>
        </div>
      </div>

      {/* ── Conteo de caja ── */}
      <div>
        <p className={styles.secTitulo}>Conteo de caja</p>
        <div className={styles.campos}>
          <div className={styles.campo}>
            <span className={styles.campoLabel}>Fondo inicial</span>
            <span className={styles.campoValor}>{fmt(corte.eFondoInicial ?? 0)}</span>
          </div>
          <div className={`${styles.campo} ${styles.campoEsperado}`}>
            <span className={styles.campoLabel}>Efectivo esperado en caja</span>
            <span className={styles.campoValor}>{fmt(efectivoEsperado)}</span>
          </div>
        </div>

        {/* Input */}
        <div style={{ marginTop: "var(--space-4)" }}>
          <label className={styles.inputLabel}>Efectivo contado en caja</label>
          <div className={styles.inputWrap}>
            <span className={styles.inputPrefix}>$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={efectivoContado}
              onChange={(e) => {
                setEfectivoContado(e.target.value);
                setError(null);
              }}
              className={styles.inputContado}
              autoFocus
            />
          </div>
        </div>

        {/* Diferencia live */}
        <div className={`${styles.diferencia} ${difClase}`}>
          <span className={styles.diferenciaLabel}>
            {difIcono}
            {difLabel}
          </span>
          <span className={styles.diferenciaValor}>
            {diferencia == null || diferencia === 0
              ? "—"
              : fmt(Math.abs(diferencia))}
          </span>
        </div>
      </div>

      {/* ── Aviso ── */}
      <div className={styles.aviso}>
        <TriangleAlert size={14} className={styles.avisoIcono} />
        <span>
          Al cerrar la caja tu turno pasará a revisión del administrador.
          Esta acción no se puede deshacer.
        </span>
      </div>
    </Modal>
  );
}
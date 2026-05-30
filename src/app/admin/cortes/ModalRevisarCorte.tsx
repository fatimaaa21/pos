"use client";

import { useState }          from "react";
import { Banknote, CreditCard, Smartphone, TrendingUp, AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import { Modal, ModalField } from "@/components/ui/Modal";
import { Badge }             from "@/components/ui/Badge";
import { formatFechaHora }   from "@/lib/utils/fecha";
import { revisarCorte }      from "@/lib/actions/cortes";
import type { CorteCaja }    from "@/types";
import type { CorteConEmpleado } from "./CortesAdminClient";
import styles from "./ModalRevisarCorte.module.css";

const ESTADO_BADGE: Record<string, { variante: "admin" | "pendiente" | "activo" | "error"; label: string }> = {
  abierto:    { variante: "admin",  label: "En turno"   },
  pendiente:  { variante: "pendiente", label: "Pendiente"  },
  aprobado:   { variante: "activo",    label: "Aprobado"   },
  diferencia: { variante: "error",     label: "Diferencia" },
};

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

  const nombre    = corte.empleado?.tNameUser ?? "Empleado";
  const iniciales = nombre.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const estadoBadge = ESTADO_BADGE[corte.bStateCorte] ?? { variante: "inactivo" as const, label: corte.bStateCorte };

  const difClase =
    diferencia < 0 ? styles.diferenciaFaltante :
    diferencia > 0 ? styles.diferenciaSobrante :
                     styles.diferenciaOk;

  const difIcono =
    diferencia < 0 ? <AlertTriangle size={13} /> :
    diferencia > 0 ? <ArrowRight   size={13} /> :
                     <CheckCircle  size={13} />;

  const difLabel =
    diferencia < 0 ? "Faltante" :
    diferencia > 0 ? "Sobrante" :
                     "Sin diferencia";

  const fmt = (n: number) =>
    n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  async function handleAccion(estado: "aprobado" | "diferencia") {
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append("eCodCorte",   corte.eCodCorte);
    fd.append("bStateCorte", estado);
    fd.append("tNotaAdmin",  nota);

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
      titulo="Corte de caja"
      onCerrar={onClose}
      // Pendiente → sin footer nativo (lo reemplazamos con accionesFooter abajo)
      // Cualquier otro estado → solo "Cerrar"
      sinFooter={esPendiente}
      labelCancelar={esPendiente ? undefined : "Cerrar"}
      ancho="sm"
    >
      {/* ── Empleado ── */}
      <div className={styles.empWrap}>
        <div className={styles.avatar}>{iniciales}</div>
        <span className={styles.empNombre}>{nombre}</span>
        <div className={styles.empBadges}>
          <Badge variante={estadoBadge.variante}>{estadoBadge.label}</Badge>
          {corte.tNombreTurno && (
            <span className={styles.turnoNombre}>{corte.tNombreTurno}</span>
          )}
        </div>
        <div className={styles.fechas}>
          <span>{formatFechaHora(corte.fhInicioTurno)}</span>
          {corte.fhCierreTurno && (
            <>
              <span className={styles.fechaSep}>→</span>
              <span>{formatFechaHora(corte.fhCierreTurno)}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Desglose por método ── */}
      <div>
        <p className={styles.secTitulo}>Desglose por método</p>
        <div className={styles.desglose}>
          <div className={styles.desgloseRow}>
            <div className={styles.desgloseIcono}><Banknote size={14} /></div>
            <span className={styles.desgloseLabel}>Efectivo</span>
            <span className={styles.desgloseValor}>{fmt(corte.eTotalEfectivo ?? 0)}</span>
          </div>
          <div className={styles.desgloseRow}>
            <div className={styles.desgloseIcono}><CreditCard size={14} /></div>
            <span className={styles.desgloseLabel}>Tarjeta</span>
            <span className={styles.desgloseValor}>{fmt(corte.eTotalTarjeta ?? 0)}</span>
          </div>
          <div className={styles.desgloseRow}>
            <div className={styles.desgloseIcono}><Smartphone size={14} /></div>
            <span className={styles.desgloseLabel}>QR / Transferencia</span>
            <span className={styles.desgloseValor}>{fmt(corte.eTotalTransferencia ?? 0)}</span>
          </div>
          <div className={`${styles.desgloseRow} ${styles.desgloseTotal}`}>
            <div className={styles.desgloseIcono}><TrendingUp size={14} /></div>
            <span className={styles.desgloseLabel}>Efectivo esperado en caja</span>
            <span className={styles.desgloseValor}>{fmt(corte.eEfectivoEsperado ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* ── Resumen numérico ── */}
      <div>
        <p className={styles.secTitulo}>Resumen de caja</p>
        <div className={styles.campos}>
          <div className={styles.campo}>
            <span className={styles.campoLabel}>Fondo inicial</span>
            <span className={styles.campoValor}>{fmt(corte.eFondoInicial ?? 0)}</span>
          </div>
          {corte.eEfectivoContado != null && (
            <div className={styles.campo}>
              <span className={styles.campoLabel}>Efectivo contado</span>
              <span className={styles.campoValor}>{fmt(corte.eEfectivoContado)}</span>
            </div>
          )}
          <div className={styles.campo}>
            <span className={styles.campoLabel}>Total ventas</span>
            <span className={styles.campoValor}>
              {corte.eTotalVentas != null ? fmt(corte.eTotalVentas) : "—"}
            </span>
          </div>
        </div>

        {corte.eEfectivoContado != null && (
          <div className={`${styles.diferencia} ${difClase}`}>
            <span className={styles.diferenciaLabel}>
              {difIcono}
              {difLabel}
            </span>
            <span className={styles.diferenciaValor}>
              {diferencia === 0 ? "—" : fmt(Math.abs(diferencia))}
            </span>
          </div>
        )}
      </div>

      {/* ── Nota editable (solo pendiente) ── */}
      {esPendiente && (
        <ModalField label="Nota para el empleado (opcional)">
          <textarea
            className={styles.notaTextarea}
            placeholder="Ej. Verificar tickets del turno..."
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
          />
        </ModalField>
      )}

      {/* ── Nota guardada (solo lectura) ── */}
      {!esPendiente && corte.tNotaAdmin && (
        <div className={styles.notaExistente}>
          <span className={styles.notaExistenteTitulo}>Nota del administrador</span>
          <span>{corte.tNotaAdmin}</span>
        </div>
      )}

      {/* ── Footer condicional ──
           • pendiente  → reemplaza el footer nativo con Marcar diferencia + Aprobar
           • otros      → el Modal renderiza su propio footer con "Cerrar"            */}
      {esPendiente && (
        <div className={styles.accionesFooter}>
          {error && <p className={styles.modalError}>{error}</p>}
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
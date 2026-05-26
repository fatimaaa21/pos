"use client";

import { useState, useEffect, useRef } from "react";
import { Banknote, Calculator, ArrowRight, X } from "lucide-react";
import styles from "./ModalEfectivo.module.css";

interface Props {
  total: number;
  onConfirmar: (montoPagado: number) => void;
  onCancelar: () => void;
}

// Billetes y monedas comunes en México
const DENOMINACIONES = [500, 200, 100, 50, 20, 10, 5];

export function ModalEfectivo({ total, onConfirmar, onCancelar }: Props) {
  const [montoPagado, setMontoPagado] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus al abrir
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelar();
      if (e.key === "Enter" && montoNumerico >= total) handleConfirmar();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [montoPagado]);

  // Bloquear scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const montoNumerico = parseFloat(montoPagado) || 0;
  const vuelto = montoNumerico - total;
  const esValido = montoNumerico >= total;
  const hayMonto = montoNumerico > 0;

  function handleConfirmar() {
    if (!esValido) return;
    onConfirmar(montoNumerico);
  }

  function seleccionarDenominacion(valor: number) {
    // Si ya hay un monto ingresado, suma el billete; si no, lo pone directo
    const actual = parseFloat(montoPagado) || 0;
    setMontoPagado((actual + valor).toString());
    inputRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    // Solo números y punto decimal
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      setMontoPagado(val);
    }
  }

  function limpiar() {
    setMontoPagado("");
    inputRef.current?.focus();
  }

  // Denominación mínima que cubre el total
  const denominacionSugerida = DENOMINACIONES.find((d) => d >= total) ?? null;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onCancelar()}
    >
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcono}>
              <Banknote size={18} />
            </div>
            <div>
              <h2 className={styles.titulo}>Cobro en efectivo</h2>
              <p className={styles.subtitulo}>Ingresa el monto recibido</p>
            </div>
          </div>
          <button className={styles.btnCerrar} onClick={onCancelar} aria-label="Cancelar">
            <X size={16} />
          </button>
        </div>

        {/* Total a cobrar */}
        <div className={styles.totalSection}>
          <span className={styles.totalLabel}>Total a cobrar</span>
          <span className={styles.totalValor}>${total.toFixed(2)}</span>
        </div>

        {/* Denominaciones rápidas */}
        <div className={styles.denominaciones}>
          <span className={styles.denominacionesLabel}>Billetes / monedas</span>
          <div className={styles.denominacionesGrid}>
            {DENOMINACIONES.map((d) => (
              <button
                key={d}
                className={`${styles.denom} ${d === denominacionSugerida && !hayMonto ? styles.denomSugerida : ""}`}
                onClick={() => seleccionarDenominacion(d)}
                title={`Agregar $${d}`}
              >
                ${d}
              </button>
            ))}
          </div>
        </div>

        {/* Input de monto */}
        <div className={styles.inputSection}>
          <label className={styles.inputLabel}>Monto recibido</label>
          <div className={`${styles.inputWrap} ${hayMonto && !esValido ? styles.inputError : ""} ${esValido ? styles.inputOk : ""}`}>
            <span className={styles.inputPrefix}>$</span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={montoPagado}
              onChange={handleInputChange}
              className={styles.input}
            />
            {hayMonto && (
              <button className={styles.btnLimpiarInput} onClick={limpiar} title="Limpiar">
                <X size={12} />
              </button>
            )}
          </div>
          {hayMonto && !esValido && (
            <p className={styles.inputHint}>
              Faltan ${(total - montoNumerico).toFixed(2)} para cubrir el total
            </p>
          )}
        </div>

        {/* Vuelto */}
        <div className={`${styles.vueltoSection} ${esValido ? styles.vueltoVisible : ""}`}>
          <div className={styles.vueltoRow}>
            <span className={styles.vueltoLabel}>
              <Calculator size={14} />
              Vuelto a entregar
            </span>
            <span className={`${styles.vueltoValor} ${vuelto === 0 ? styles.vueltoExacto : ""}`}>
              {vuelto === 0 ? "Pago exacto ✓" : `$${vuelto.toFixed(2)}`}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className={styles.acciones}>
          <button className={styles.btnCancelar} onClick={onCancelar}>
            Cancelar
          </button>
          <button
            className={styles.btnConfirmar}
            onClick={handleConfirmar}
            disabled={!esValido}
          >
            Confirmar cobro
            <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}
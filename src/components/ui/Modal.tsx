"use client";

import { useEffect } from "react";
import { Asterisk, ChevronDown, X } from "lucide-react";
import styles from "./Modal.module.css";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type VarianteConfirmar = "primario" | "peligro";

interface ModalProps {
  titulo: string;
  onCerrar: () => void;

  // Footer — si no se pasan, no se renderiza el footer
  onConfirmar?: () => void;
  labelConfirmar?: string;
  labelCancelar?: string;
  varianteConfirmar?: VarianteConfirmar;
  cargando?: boolean;
  deshabilitado?: boolean;

  sinFooter?: boolean;

  // Feedback
  error?: string | null;

  // Layout
  ancho?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function Modal({
  titulo,
  onCerrar,
  onConfirmar,
  labelConfirmar = "Confirmar",
  labelCancelar = "Cancelar",
  sinFooter = false,
  varianteConfirmar = "primario",
  cargando = false,
  deshabilitado = false,
  error,
  ancho = "md",
  children,
}: ModalProps) {

  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCerrar]);

  // Bloquear scroll del body
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const anchoClass = {
    sm: styles.anchoSm,
    md: styles.anchoMd,
    lg: styles.anchoLg,
  }[ancho];

  const btnConfirmarClass = varianteConfirmar === "peligro"
    ? styles.btnPeligro
    : styles.btnPrimario;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onCerrar()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-titulo"
    >
      <div className={`${styles.card} ${anchoClass}`}>

        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.titulo}>{titulo}</h2>
          <button
            className={styles.btnCerrar}
            onClick={onCerrar}
            aria-label="Cerrar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {children}

          {error && (
            <div className={styles.error} role="alert">
              <span className={styles.errorIcon}>⚠</span>
              {error}
            </div>
          )}
        </div>

        {/* Footer — solo si hay acción de confirmar O si se quiere solo el cancelar */}
        {!sinFooter && (onConfirmar !== undefined || labelCancelar) && (
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.btnCancelar}
              onClick={onCerrar}
              disabled={cargando}
            >
              {labelCancelar}
            </button>

            {onConfirmar !== undefined && (
              <button
                type="button"
                className={`${styles.btnAccion} ${btnConfirmarClass}`}
                onClick={onConfirmar}
                disabled={cargando || deshabilitado}
              >
                {cargando ? "Cargando..." : labelConfirmar}
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Sub-componentes para componer el body ───────────────────────────────────

interface FieldProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}

export function ModalField({ label, children, required }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.fieldRequired}><Asterisk size={14}/></span>}
      </label>
      {children}
    </div>
  );
}

export function ModalInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={styles.input} />;
}

export function ModalSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={styles.selectWrap}>
      <select {...props} className={styles.input} />
      <span className={styles.selectChevron}>
        <ChevronDown size={16} strokeWidth={2.5} />
      </span>
    </div>
  );
}

export function ModalInfo({ children }: { children: React.ReactNode }) {
  return <div className={styles.info}>{children}</div>;
}
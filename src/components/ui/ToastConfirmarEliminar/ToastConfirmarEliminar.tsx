// src/components/ui/ModalConfirmarEliminar.tsx
"use client";

import { useEffect } from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";
import styles from "./ToastConfirmarEliminar.module.css";
import { Spinner } from "../Spinner/Spinner";

interface Props {
  tipo: string;
  nombre: string;
  advertencia?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
  cargando?: boolean;
}

export function ToastConfirmarEliminar({
  tipo,
  nombre,
  advertencia,
  onConfirmar,
  onCancelar,
  cargando = false,
}: Props) {
  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelar();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancelar]);

  return (
    <div className={styles.toast} role="alertdialog" aria-modal="true">
      <div className={styles.icono}>
        <AlertTriangle size={16} strokeWidth={2.5} />
      </div>

      <div className={styles.cuerpo}>
        <span className={styles.pregunta}>
          ¿Eliminar <strong>"{nombre}"</strong>?
        </span>
        {advertencia && (
          <span className={styles.advertencia}>{advertencia}</span>
        )}
      </div>

      <div className={styles.acciones}>
        <button
          className={styles.btnCancelar}
          onClick={onCancelar}
          disabled={cargando}
        >
          Cancelar
        </button>
        <button
          className={styles.btnEliminar}
          onClick={onConfirmar}
          disabled={cargando}
        >
          <Trash2 size={13} strokeWidth={2.5} />
          {cargando ? <Spinner /> : "Sí, eliminar"}
        </button>
      </div>

      <button
        className={styles.btnCerrar}
        onClick={onCancelar}
        disabled={cargando}
        aria-label="Cerrar"
      >
        <X size={14} />
      </button>
    </div>
  );
}
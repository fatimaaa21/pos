"use client";

import { X } from "lucide-react";
import { useState, useEffect } from "react";
import type { Categoria } from "@/types";
import styles from "./Modal.module.css";

const ICONOS = ["🥐", "🥖", "🎂", "🍪", "☕", "🍩", "🌀", "🍞", "🥧", "🍰", "🧁", "🥨", "🫓", "🥯", "🍫", "🧇"];

interface ModalCategoriaProps {
  categoria?: Categoria | null;
  onGuardar: (tNameCategory: string, ImgCategory: string) => Promise<{ error: unknown }>;
  onCerrar: () => void;
  cargando?: boolean;
}

export function ModalCategoria({ categoria, onGuardar, onCerrar, cargando }: ModalCategoriaProps) {
  const [nombre, setNombre] = useState("");
  const [icono, setIcono] = useState("🥐");

  useEffect(() => {
    if (categoria) {
      setNombre(categoria.tNameCategory);
      setIcono(categoria.ImgCategory ?? "🥐");
    }
  }, [categoria]);

  async function handleGuardar() {
    if (!nombre.trim()) return;
    await onGuardar(nombre.trim(), icono);
  }

  return (
    <div className={styles.overlay} onClick={onCerrar}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>

        <div className={styles.header}>
          <h2 className={styles.title}>
            {categoria ? "Editar categoría" : "Nueva categoría"}
          </h2>
          <button className={styles.closeBtn} onClick={onCerrar}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>Nombre</label>
            <input
              className={styles.input}
              type="text"
              placeholder="Ej. Pan Dulce"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Ícono</label>
            <div className={styles.iconGrid}>
              {ICONOS.map((ic) => (
                <button
                  key={ic}
                  className={`${styles.iconBtn} ${icono === ic ? styles.iconBtnActive : ""}`}
                  onClick={() => setIcono(ic)}
                  type="button"
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSecundario} onClick={onCerrar}>
            Cancelar
          </button>
          <button
            className={styles.btnPrimario}
            onClick={handleGuardar}
            disabled={!nombre.trim() || cargando}
          >
            {cargando ? "Guardando..." : "Guardar"}
          </button>
        </div>

      </div>
    </div>
  );
}
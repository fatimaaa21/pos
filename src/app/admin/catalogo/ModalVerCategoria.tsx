"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora, formatRelativo } from "@/lib/utils/fecha";
import type { Categoria } from "@/types";
import styles from "./ModalVerCategoria.module.css";

interface Props {
  categoria: Categoria;
  onClose: () => void;
}

export function ModalVerCategoria({ categoria, onClose }: Props) {
  const iniciales = categoria.tNameCategory
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Modal
      titulo="Detalle de categoría"
      onCerrar={onClose}
      labelCancelar="Cerrar"
      ancho="sm"
    >
      {/* Avatar */}
      <div className={styles.avatarWrap}>
        <div
          className={styles.avatar}
          style={{
            background: categoria.tNameCategory === "admin" ? "#FAEEDA" : "#E1F5EE",
            color: categoria.tNameCategory === "admin" ? "#633806" : "#085041",
          }}
        >
          {iniciales}
        </div>
        <div className={styles.avatarNombre}>{categoria.tNameCategory}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Badge activo={categoria.bStateCategory} />
        </div>
      </div>

      {/* Campos */}
      <div className={styles.campos}>
        {[
          { label: "Fecha de Creación",  valor: formatFechaHora(categoria.fhCreateCategory) },
          { label: "Ultima Actualización", valor: formatRelativo(categoria.fhUpdateCategory) },
        ].map(({ label, valor }) => (
          <div key={label} className={styles.campo}>
            <span className={styles.campoLabel}>{label}</span>
            <span className={styles.campoValor}>{valor}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
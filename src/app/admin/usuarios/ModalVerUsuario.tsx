"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora, formatRelativo } from "@/lib/utils/fecha";
import type { Perfil } from "@/types";
import styles from "./ModalVerUsuario.module.css";

interface Props {
  usuario: Perfil;
  onClose: () => void;
}

export function ModalVerUsuario({ usuario, onClose }: Props) {
  const iniciales = usuario.tNameUser
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const esAdmin = usuario.tRolUser === "admin";

  return (
    <Modal
      titulo="Detalle de usuario"
      onCerrar={onClose}
      labelCancelar="Cerrar"
      ancho="sm"
    >
      {/* Avatar */}
      <div className={styles.avatarWrap}>
        <div
          className={styles.avatar}
          style={{
            background: esAdmin ? "var(--color-accent-bg)"    : "var(--color-primary-50)",
            color:      esAdmin ? "var(--color-accent)"        : "var(--color-primary-dark)",
          }}
        >
          {iniciales}
        </div>
        <div className={styles.avatarNombre}>{usuario.tNameUser}</div>
        <div className={styles.badges}>
          <Badge variante={usuario.tRolUser} dot={false} />
          <Badge activo={usuario.bStateUser} />
        </div>
      </div>

      {/* Campos */}
      <div className={styles.campos}>
        {[
          { label: "Correo electrónico", valor: usuario.tEmailUser },
          { label: "Código de acceso",   valor: usuario.eCodeUser ?? "—" },
          { label: "Fecha de creación",  valor: formatFechaHora(usuario.fhCreateUser) },
          { label: "Última actualización", valor: formatRelativo(usuario.fhUpdateUser) },
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
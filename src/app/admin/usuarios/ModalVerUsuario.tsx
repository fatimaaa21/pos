"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora } from "@/lib/utils/fecha";
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
            background: usuario.tRolUser === "admin" ? "#FAEEDA" : "#E1F5EE",
            color: usuario.tRolUser === "admin" ? "#633806" : "#085041",
          }}
        >
          {iniciales}
        </div>
        <div className={styles.avatarNombre}>{usuario.tNameUser}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Badge variante={usuario.tRolUser} dot={false} />
          <Badge activo={usuario.bStateUser} />
        </div>
      </div>

      {/* Campos */}
      <div className={styles.campos}>
        {[
          { label: "Correo electrónico",    valor: usuario.tEmailUser },
          { label: "Código de acceso",    valor: usuario.eCodeUser ?? "—" },
          { label: "Fecha de Creación",  valor: formatFechaHora(usuario.fhCreateUser) },
          { label: "Ultima Actualización", valor: formatFechaHora(usuario.fhUpdateUser) },
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
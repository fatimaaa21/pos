"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora } from "@/lib/utils/fecha";
import type { NegocioConAdmin } from "./NegociosClient";
import styles from "./ModalVerNegocio.module.css";

interface Props {
  negocio: NegocioConAdmin;
  onClose: () => void;
}

export function ModalVerNegocio({ negocio, onClose }: Props) {
  const iniciales = negocio.tNameCompany
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Modal
      titulo="Detalle de negocio"
      onCerrar={onClose}
      labelCancelar="Cerrar"
      ancho="sm"
    >
      {/* Avatar / Logo */}
      <div className={styles.avatarWrap}>
        {negocio.imgCompany ? (
          <img
            src={negocio.imgCompany}
            alt={negocio.tNameCompany}
            className={styles.logoImg}
          />
        ) : (
          <div
            className={styles.avatar}
            style={{ background: "var(--color-accent-bg)", color: "var(--color-accent)" }}
          >
            {iniciales}
          </div>
        )}
        <div className={styles.avatarNombre}>{negocio.tNameCompany}</div>
        <div className={styles.badges}>
          <Badge activo={negocio.bStateCompany === "activo"} />
        </div>
      </div>

      {/* Campos del negocio */}
      <div className={styles.campos}>
        {[
          { label: "Fecha de creación",   valor: formatFechaHora(negocio.fhCreateCompany) },
          { label: "Cantidad de usuarios", valor: String(negocio.totalUsuarios) },
        ].map(({ label, valor }) => (
          <div key={label} className={styles.campo}>
            <span className={styles.campoLabel}>{label}</span>
            <span className={styles.campoValor}>{valor}</span>
          </div>
        ))}
      </div>

      {/* Admin */}
      {negocio.admin ? (
        <>
          <div className={styles.seccionTitulo}>Administrador</div>
          <div className={styles.campos}>
            {[
              { label: "Nombre",            valor: negocio.admin.tNameUser  },
              { label: "Correo electrónico", valor: negocio.admin.tEmailUser },
              { label: "Código de acceso",  valor: negocio.admin.eCodeUser ?? "—" },
            ].map(({ label, valor }) => (
              <div key={label} className={styles.campo}>
                <span className={styles.campoLabel}>{label}</span>
                <span className={styles.campoValor}>{valor}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.seccionTitulo} style={{ color: "var(--gray)" }}>
          Sin administrador asignado
        </div>
      )}
    </Modal>
  );
}
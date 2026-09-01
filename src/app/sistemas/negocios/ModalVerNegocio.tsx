"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Copy, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora } from "@/lib/utils/fecha";
import type { NegocioConAdmin } from "./NegociosClient";
import styles from "./ModalVerNegocio.module.css";

interface Props {
  negocio: NegocioConAdmin;
  onClose: () => void;
}

// ── Botón copiar URL de acceso del negocio ─────────────────────────────────
// Mismo patrón que BtnCopiarUrl de la pantalla de cocina (SucursalesAdminClient).

function BtnCopiarUrlNegocio({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false);

  const url = typeof window !== "undefined"
    ? `${window.location.origin}/auth/login/${slug}`
    : `/auth/login/${slug}`;

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopiar}
      title="Copiar URL de acceso del negocio"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 10px",
        border: copiado
          ? "1px solid var(--color-primary)"
          : "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        background: copiado ? "var(--color-primary-50)" : "var(--white)",
        color: copiado ? "var(--color-primary)" : "var(--gray)",
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "var(--font-family)",
        cursor: "pointer",
        transition: "all 0.15s",
        whiteSpace: "nowrap",
      }}
    >
      {copiado ? <Check size={12} /> : <Copy size={12} />}
      {copiado ? "¡Copiada!" : "URL de acceso"}
    </button>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

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

      {/* URL de acceso fija del negocio */}
      <div className={styles.campo} style={{ justifyContent: "space-between" }}>
        <span className={styles.campoLabel}>URL de acceso</span>
        <BtnCopiarUrlNegocio slug={negocio.tSlugCompany} />
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
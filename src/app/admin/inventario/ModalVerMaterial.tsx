"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora, formatRelativo } from "@/lib/utils/fecha";
import type { Material } from "@/types";
import styles from "./ModalVerStock.module.css";

interface Props {
  material: Material;
  onClose:  () => void;
}

export function ModalVerMaterial({ material, onClose }: Props) {
  const unidad = material.tipo_material === "rollo" ? "m" : "hojas";
  const estado =
    material.eMetrosLineales <= 0                                                    ? "agotado"    :
    material.eStockMinimo > 0 && material.eMetrosLineales <= material.eStockMinimo   ? "bajo"       :
    "disponible";

  const badgeVariante =
    estado === "agotado" ? "agotado"    as const :
    estado === "bajo"    ? "bajo"        as const :
    "disponible"                          as const;

  const barraColor =
    estado === "agotado" ? "var(--color-error)"   :
    estado === "bajo"    ? "var(--color-warning)" :
    "var(--color-success)";

  const campos = [
    {
      label: "Tipo",
      valor: material.tipo_material === "rollo" ? "Rollo" : "Hojas",
    },
    ...(material.tipo_material === "rollo" ? [{
      label: "Ancho del rollo",
      valor: `${material.eAnchoCm} cm`,
    }] : []),
    {
      label: "Stock mínimo",
      valor: material.eStockMinimo > 0 ? `${material.eStockMinimo} ${unidad}` : "Sin mínimo",
    },
    {
      label: "Fecha de ingreso",
      valor: formatFechaHora(material.fhCreateMaterial),
    },
    {
      label: "Última actualización",
      valor: formatRelativo(material.fhUpdateMaterial),
    },
  ];

  return (
    <Modal titulo="Detalle de material" onCerrar={onClose} labelCancelar="Cerrar" ancho="sm">

      {/* ── Header ── */}
      <div className={styles.avatarWrap}>
        <div style={{
          width: 56, height: 56, borderRadius: "var(--radius-lg)",
          background: "var(--color-primary-50)",
          border: "1px solid var(--color-primary-light)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <IconoMaterial />
        </div>
        <div className={styles.avatarNombre}>{material.tNombre}</div>
        <div className={styles.badges}>
          <Badge activo={material.bStateMaterial} />
          <Badge variante={badgeVariante} dot={false}>
            {estado === "agotado" ? "Agotado" :
             estado === "bajo"    ? "Stock bajo" : "Disponible"}
          </Badge>
        </div>
      </div>

      {/* ── Existencia destacada ── */}
      <div className={styles.nums}>
        {[
          {
            label: "Existencia",
            valor: material.eMetrosLineales,
            color: barraColor,
          },
          {
            label: "Mínimo",
            valor: material.eStockMinimo || "—",
            color: "var(--gray)",
          },
          ...(material.tipo_material === "rollo" ? [{
            label: "Ancho (cm)",
            valor: material.eAnchoCm ?? "—",
            color: "var(--dark)",
          }] : []),
        ].map(({ label, valor, color }) => (
          <div key={label} className={styles.numCard}>
            <div className={styles.numValor} style={{ color }}>{valor}</div>
            <div className={styles.numLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Barra de existencia ── */}
      <div className={styles.barraWrap}>
        <div className={styles.barraHeader}>
          <span style={{ fontSize: 12, color: "var(--gray)", fontWeight: 600 }}>
            Existencia
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: barraColor }}>
            {material.eMetrosLineales} {unidad}
          </span>
        </div>
        <div className={styles.barra}>
          <div
            className={styles.barraFill}
            style={{
              width: material.eMetrosLineales <= 0 ? "0%" : "100%",
              background: barraColor,
            }}
          />
        </div>
      </div>

      {/* ── Campos ── */}
      <div className={styles.campos}>
        {campos.map(({ label, valor }) => (
          <div key={label} className={styles.campo}>
            <span className={styles.campoLabel}>{label}</span>
            <span className={styles.campoValor}>{valor}</span>
          </div>
        ))}
      </div>

    </Modal>
  );
}

function IconoMaterial() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="var(--color-primary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  );
}
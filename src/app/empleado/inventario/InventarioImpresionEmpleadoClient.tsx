"use client";

import { useState } from "react";
import { Buscador } from "@/components/ui/Buscador";
import { Badge }    from "@/components/ui/Badge";
import type { Material } from "@/types";
import styles from "./Inventario.module.css";

interface Props {
  materiales: Material[];
}

export function InventarioImpresionEmpleadoClient({ materiales }: Props) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = materiales.filter((m) =>
    m.tNombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className={styles.layout}>
      <div className={styles.buscadorWrap}>
        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar material..."
        />
      </div>

      {filtrados.length === 0 ? (
        <div className={styles.vacio}>
          <p>No hay materiales disponibles</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtrados.map((m) => {
            const unidad = m.tipo_material === "rollo" ? "m" : "hojas";
            const estado =
              m.eMetrosLineales <= 0                                    ? "agotado"    :
              m.eStockMinimo > 0 && m.eMetrosLineales <= m.eStockMinimo ? "bajo"       :
              "disponible";

            const badgeVariante =
              estado === "agotado"    ? "agotado"    as const :
              estado === "bajo"       ? "bajo"        as const :
              "disponible"                             as const;

            const barraColor =
              estado === "agotado" ? "var(--color-error)"   :
              estado === "bajo"    ? "var(--color-warning)" :
              "var(--color-primary)";

            const pct = m.eMetrosLineales <= 0 ? 0 : 100;

            return (
              <div key={m.eCodMaterial} className={styles.card}>
                <div className={styles.badgeWrap}>
                  <Badge variante={badgeVariante} dot={false}>
                    {estado === "agotado" ? "Agotado" :
                     estado === "bajo"    ? "Stock bajo" : "Disponible"}
                  </Badge>
                </div>

                <div className={styles.imgWrap}>
                  <div className={styles.placeholder}>
                    <IconoMaterial />
                  </div>
                </div>

                <div className={styles.info}>
                  <p className={styles.nombre}>{m.tNombre}</p>

                  {m.tipo_material === "rollo" && (
                    <div className={styles.stockRow}>
                      <span className={styles.stockLabel}>Ancho</span>
                      <span className={styles.stockValor}>
                        <strong>{m.eAnchoCm}</strong> cm
                      </span>
                    </div>
                  )}

                  <div className={styles.stockRow}>
                    <span className={styles.stockLabel}>Disponible</span>
                    <span className={styles.stockValor}>
                      <strong>{m.eMetrosLineales}</strong> {unidad}
                    </span>
                  </div>

                  <div className={styles.barra}>
                    <div
                      className={styles.barraFill}
                      style={{ width: `${pct}%`, background: barraColor }}
                    />
                  </div>

                  {m.eStockMinimo > 0 && (
                    <div className={styles.minimoRow}>
                      <span className={styles.minimoLabel}>
                        Mínimo: <strong>{m.eStockMinimo}</strong> {unidad}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconoMaterial() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </svg>
  );
}
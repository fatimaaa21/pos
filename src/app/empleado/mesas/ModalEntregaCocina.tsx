"use client";

// src/app/empleado/mesas/ModalEntregaCocina.tsx
// Modal que se abre al tocar el badge verde en el floor plan.
// Muestra los items con tEstadoCocina='listo' y permite marcarlos
// como entregados uno por uno.

import { useState, useEffect, useTransition } from "react";
import { CheckCircle2, Loader2, PackageCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { obtenerItemsListos, marcarItemEntregado } from "@/lib/actions/mesas";
import type { ItemListoCocina } from "@/types";
import styles from "./modalEntregaCocina.module.css";

interface Props {
  eCodOrden:   string;
  tNombreMesa: string;
  onCerrar:    () => void;
  /** Llamada al marcar el último item — para que el componente padre refresque */
  onEntregado: () => void;
}

export function ModalEntregaCocina({
  eCodOrden,
  tNombreMesa,
  onCerrar,
  onEntregado,
}: Props) {
  const [items,    setItems]    = useState<ItemListoCocina[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entregando, startTransition] = useTransition();
  const [entregandoId, setEntregandoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    obtenerItemsListos(eCodOrden).then((data) => {
      if (!cancelled) {
        setItems(data);
        setCargando(false);
      }
    });
    return () => { cancelled = true; };
  }, [eCodOrden]);

  function handleEntregar(eCodDetalle: string) {
    setEntregandoId(eCodDetalle);
    startTransition(async () => {
      const result = await marcarItemEntregado(eCodDetalle);
      if ("ok" in result) {
        const restantes = items.filter((i) => i.eCodDetalle !== eCodDetalle);
        setItems(restantes);
        if (restantes.length === 0) {
          onEntregado();
          onCerrar();
        }
      }
      setEntregandoId(null);
    });
  }

  return (
    <Modal
      titulo={`Listos para entregar — ${tNombreMesa}`}
      onCerrar={onCerrar}
      sinFooter
      ancho="sm"
    >
      <div className={styles.content}>
        {cargando ? (
          <div className={styles.estado}>
            <Loader2 size={24} className={styles.spinner} />
            <p>Cargando…</p>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.estado}>
            <PackageCheck size={32} strokeWidth={1.4} className={styles.doneIcon} />
            <p className={styles.doneText}>Todo entregado</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => {
              const ocupado = entregandoId === item.eCodDetalle;
              return (
                <li key={item.eCodDetalle} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemCantidad}>×{item.eCantidad}</span>
                    <div className={styles.itemNombres}>
                      <span className={styles.itemNombre}>{item.tNameProduct}</span>
                      {item.tNombrePresentacion && (
                        <span className={styles.itemPresentacion}>
                          {item.tNombrePresentacion}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className={styles.btnEntregar}
                    onClick={() => handleEntregar(item.eCodDetalle)}
                    disabled={ocupado || entregando}
                  >
                    {ocupado ? (
                      <Loader2 size={14} className={styles.spinnerBtn} />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Entregar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
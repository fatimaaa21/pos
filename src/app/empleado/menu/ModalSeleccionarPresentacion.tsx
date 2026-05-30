"use client";

import { useEffect } from "react";
import { X, Package, Infinity as InfinityIcon } from "lucide-react";
import type { ProductoConStock, PresentacionConStock } from "@/types";
import styles from "./ModalSeleccionarPresentacion.module.css";

interface Props {
  producto:      ProductoConStock;
  onSeleccionar: (presentacion: PresentacionConStock) => void;
  onCancelar:    () => void;
}

export function ModalSeleccionarPresentacion({ producto, onSeleccionar, onCancelar }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelar();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancelar]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const presentaciones = producto.presentaciones ?? [];

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onCancelar()}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {producto.ImgProduct ? (
              <img
                src={producto.ImgProduct}
                alt={producto.tNameProduct}
                className={styles.headerImg}
              />
            ) : (
              <div className={styles.headerImgPlaceholder}>
                <Package size={18} />
              </div>
            )}
            <div>
              <h2 className={styles.titulo}>{producto.tNameProduct}</h2>
              <p className={styles.subtitulo}>Elige una presentación</p>
            </div>
          </div>
          <button className={styles.btnCerrar} onClick={onCancelar} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {/* Lista de presentaciones */}
        <div className={styles.lista}>
          {presentaciones.map((p) => {
            const agotado = !p.bInfinito && p.stockDisponible === 0;
            return (
              <button
                key={p.eCodPresentacion}
                className={`${styles.item} ${agotado ? styles.itemAgotado : ""}`}
                onClick={() => !agotado && onSeleccionar(p)}
                disabled={agotado}
                type="button"
              >
                <div className={styles.itemLeft}>
                  <span className={styles.itemNombre}>{p.tNombre}</span>
                  {!agotado && (
                    <span className={styles.itemStock}>
                      {p.bInfinito ? (
                        <><InfinityIcon size={11} /> Ilimitado</>
                      ) : (
                        `${p.stockDisponible} disponibles`
                      )}
                    </span>
                  )}
                  {agotado && <span className={styles.itemStockAgotado}>Agotado</span>}
                </div>
                <span className={styles.itemPrecio}>
                  ${p.ePricePresentacion.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
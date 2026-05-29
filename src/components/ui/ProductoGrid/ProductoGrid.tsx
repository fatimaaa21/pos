"use client";

import { Plus } from "lucide-react";
import type { ProductoConStock } from "@/types";
import styles from "./ProductoGrid.module.css";

interface Props {
  productos: ProductoConStock[];
  onAgregar: (producto: ProductoConStock) => void;
  bloqueado?: boolean;
}

function IconoPlaceholder() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

export function ProductoGrid({ productos, onAgregar }: Props) {
  if (productos.length === 0) {
    return (
      <div className={styles.vacio}>
        <p>No hay productos disponibles en este momento</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {productos.map((producto) => {
        const stockBajo = producto.stockDisponible <= 5;

        return (
          <div key={producto.eCodProduct} className={styles.card}>

            {/* Imagen */}
            <div className={styles.imgWrap}>
              {producto.ImgProduct ? (
                <img
                  src={producto.ImgProduct}
                  alt={producto.tNameProduct}
                  className={styles.img}
                />
              ) : (
                <div className={styles.placeholder}>
                  <IconoPlaceholder />
                </div>
              )}

              {/* Badge de stock bajo */}
              {stockBajo && (
                <span className={styles.badgeStock}>
                  {producto.stockDisponible} restantes
                </span>
              )}
            </div>

            {/* Info */}
            <div className={styles.info}>
              <p className={styles.nombre}>{producto.tNameProduct}</p>
              <div className={styles.footer}>
                <span className={styles.precio}>
                  ${producto.ePriceProduct.toFixed(2)}
                </span>
                <button
                  className={styles.btnAgregar}
                  onClick={() => onAgregar(producto)}
                  aria-label={`Agregar ${producto.tNameProduct}`}
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>

          </div>
        );
      })}
    </div>
  );
}
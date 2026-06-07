"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { ProductoConStock, PresentacionConStock } from "@/types";
import styles from "./ProductoGrid.module.css";

interface Props {
  productos:   ProductoConStock[];
  onAgregar:   (producto: ProductoConStock, presentacion?: PresentacionConStock) => void;
  onAgregarPorMedida?: (producto: ProductoConStock) => void;
}

function IconoPlaceholder() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

// ── Tarjeta individual (necesita estado local para la presentación seleccionada)
function ProductoCard({
  producto,
  onAgregar,
  onAgregarPorMedida,
}: {
  producto:             ProductoConStock;
  onAgregar:            (producto: ProductoConStock, presentacion?: PresentacionConStock) => void;
  onAgregarPorMedida?:  (producto: ProductoConStock) => void;
}) {
  const tienePres = (producto.presentaciones?.length ?? 0) > 0;
  const [presSeleccionada, setPresSeleccionada] = useState<PresentacionConStock | null>(null);

  const agotado = !producto.bInfinito && producto.stockDisponible === 0;

  // Precio a mostrar
  const precioMostrado = presSeleccionada
    ? presSeleccionada.ePricePresentacion
    : tienePres
      ? Math.min(...producto.presentaciones!.map((p) => p.ePricePresentacion))
      : producto.ePriceProduct;

  const prefijoP = !presSeleccionada && tienePres ? "Desde " : "";

  // El botón + está habilitado si:
  // - Sin presentaciones: siempre (si no agotado)
  // - Con presentaciones: solo cuando se seleccionó una con stock
  const puedeAgregar =
    !agotado &&
    (!tienePres || (presSeleccionada !== null &&
      (presSeleccionada.bInfinito || presSeleccionada.stockDisponible > 0)));

  const stockBajo =
    !tienePres &&
    !producto.bInfinito &&
    producto.stockDisponible > 0 &&
    producto.stockDisponible <= 5;

  function handleAgregar() {
    if (producto.tipo_producto === "medida") {
      onAgregarPorMedida?.(producto);
      return;
    }
    if (!puedeAgregar) return;
    onAgregar(producto, presSeleccionada ?? undefined);
  }

  return (
    <div className={`${styles.card} ${agotado ? styles.cardAgotado : ""}`}>

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
        {stockBajo && (
          <span className={styles.badgeStock}>
            {producto.stockDisponible} restantes
          </span>
        )}
        {agotado && (
          <span className={styles.badgeAgotado}>Agotado</span>
        )}
      </div>

      {/* Info */}
      <div className={styles.info}>
        <p className={styles.nombre}>{producto.tNameProduct}</p>

        {/* Presentaciones — solo si el producto las tiene */}
        {tienePres && (
          <div className={styles.presentaciones}>
            {producto.presentaciones!.map((p) => {
              const sinStock = !p.bInfinito && p.stockDisponible === 0;
              const activa   = presSeleccionada?.eCodPresentacion === p.eCodPresentacion;
              return (
                <button
                  key={p.eCodPresentacion}
                  type="button"
                  disabled={sinStock}
                  onClick={() => setPresSeleccionada(activa ? null : p)}
                  className={`${styles.chipPres} ${activa ? styles.chipPresActivo : ""} ${sinStock ? styles.chipPresAgotado : ""}`}
                >
                  <span className={styles.chipNombre}>{p.tNombre}</span>
                  {sinStock && <span className={styles.chipAgotadoTag}>Agotado</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer: precio + botón */}
        <div className={styles.footer}>
          <span className={styles.precio}>
            <span className={styles.precioPrefix}>{prefijoP}</span>
            ${precioMostrado.toFixed(2)}
          </span>
          <button
            className={`${styles.btnAgregar} ${
              producto.tipo_producto !== "medida" && !puedeAgregar
                ? styles.btnAgregarDisabled
                : ""
            }`}
            onClick={handleAgregar}
            disabled={producto.tipo_producto !== "medida" && !puedeAgregar}
            aria-label={`Agregar ${producto.tNameProduct}`}
            style={producto.tipo_producto === "medida" ? { width: "auto", padding: "0 10px", fontSize: 11, fontWeight: 700 } : {}}
          >
            {producto.tipo_producto === "medida"
              ? "Medidas"
              : <Plus size={16} strokeWidth={2.5} />
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grid principal
export function ProductoGrid({ productos, onAgregar, onAgregarPorMedida }: Props) {
  if (productos.length === 0) {
    return (
      <div className={styles.vacio}>
        <p>No hay productos disponibles en este momento</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {productos.map((producto) => (
        <ProductoCard
          key={producto.eCodProduct}
          producto={producto}
          onAgregar={onAgregar}
          onAgregarPorMedida={onAgregarPorMedida}
        />
      ))}
    </div>
  );
}
"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora, formatRelativo } from "@/lib/utils/fecha";
import type { Categoria } from "@/types";
import styles from "./ModalVerCategoria.module.css";

interface Props {
  categoria: Categoria;
  onClose: () => void;
}

export function ModalVerCategoria({ categoria, onClose }: Props) {

  const productos  = categoria.productos ?? [];
  const totalProductos = productos.length;
  const activos    = productos.filter((p) => p.bStateProduct);
  const inactivos  = productos.filter((p) => !p.bStateProduct);

  // Cache-buster para que el browser no sirva una versión anterior
  const imgSrc = categoria.ImgCategory?.split("?")[0] ?? null;

    
  return (
    <Modal
      titulo="Detalle de categoría"
      onCerrar={onClose}
      labelCancelar="Cerrar"
      ancho="sm"
    >
      {/* ── Imagen ── */}
      <div className={styles.avatarWrap}>
        {imgSrc ? (
          <div className={styles.avatar}>
            <img
              src={imgSrc}
              alt={categoria.tNameCategory}
            />
          </div>
        ) : null}
        <div className={styles.avatarNombre}>{categoria.tNameCategory}</div>
        <div className={styles.badges}>
          <Badge activo={categoria.bStateCategory} />
          <Badge variante={totalProductos > 0 ? "disponible" : "agotado"}>
            {totalProductos > 0
              ? `${totalProductos} producto${totalProductos !== 1 ? "s" : ""}`
              : "Sin productos"}
          </Badge>
        </div>
      </div>

      {/* ── Metadatos ── */}
      <div className={styles.campos}>
        {[
          { label: "Fecha de creación",    valor: formatFechaHora(categoria.fhCreateCategory) },
          { label: "Última actualización", valor: formatRelativo(categoria.fhUpdateCategory) },
        ].map(({ label, valor }) => (
          <div key={label} className={styles.campo}>
            <span className={styles.campoLabel}>{label}</span>
            <span className={styles.campoValor}>{valor}</span>
          </div>
        ))}
      </div>

      {/* ── Lista de productos ── */}
      <div className={styles.productosSection}>
        <div className={styles.productosSectionHeader}>
          <span className={styles.productosSectionTitulo}>Productos</span>
          <span className={styles.productosSectionConteo}>
            {totalProductos} en total · {activos.length} activo{activos.length !== 1 ? "s" : ""}
          </span>
        </div>

        {totalProductos === 0 ? (
          <div className={styles.productosVacio}>Sin productos asignados</div>
        ) : (
          <div className={styles.productosList}>
            {/* Activos primero */}
            {activos.map((p) => (
              <div key={p.eCodProduct} className={styles.productoItem}>
                <span className={styles.productoIndicadorActivo} />
                <span className={styles.productoNombre}>{p.tNameProduct}</span>
                <span className={styles.productoPrecio}>
                  {p.ePriceProduct.toLocaleString("es-AR", {
                    style: "currency",
                    currency: "ARS",
                  })}
                </span>
              </div>
            ))}
            {/* Inactivos al final, atenuados */}
            {inactivos.map((p) => (
              <div key={p.eCodProduct} className={`${styles.productoItem} ${styles.productoItemInactivo}`}>
                <span className={styles.productoIndicadorInactivo} />
                <span className={styles.productoNombreInactivo}>{p.tNameProduct}</span>
                <span className={styles.productoPrecioInactivo}>
                  {p.ePriceProduct.toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                    minimumFractionDigits: 0,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
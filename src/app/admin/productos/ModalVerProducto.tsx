"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora, formatRelativo } from "@/lib/utils/fecha";
import type { Producto, Categoria } from "@/types";
import styles from "./ModalVerProducto.module.css";

interface Props {
producto: Producto;
categorias: Categoria[];
onClose: () => void;
}

export function ModalVerProducto({ producto, categorias, onClose }: Props) {
const iniciales = producto.tNameProduct   
.split(" ")
.map((n) => n[0])
.slice(0, 2)
.join("")
.toUpperCase();

// Cache-buster para que el browser no sirva una versión anterior
  const imgSrc = producto.ImgProduct?.split("?")[0] ?? null;

    
  // Mapa de categorías para acceso rápido por ID
  const categoriasMap = new Map(categorias.map(c => [c.eCodCategory, c.tNameCategory]));
  const nombreCategoria = producto.fkeCodCategory ? categoriasMap.get(producto.fkeCodCategory) || "Categoría no encontrada" : "Sin categoría";

return (
<Modal
    titulo="Detalle de producto"
    onCerrar={onClose}
    labelCancelar="Cerrar"
    ancho="sm"
>
    {/* Imagen */}
    <div className={styles.avatarWrap}>
    {imgSrc ? (
        <div className={styles.avatar}>
            <img
              src={imgSrc}
              alt={producto.tNameProduct}
            />
          </div>
    ) : null}
    <div className={styles.avatarNombre}>{producto.tNameProduct}</div>
    <div style={{ display: "flex", gap: 10 }}>
        <Badge activo={producto.bStateProduct} />
        <Badge variante="categoria">
            {nombreCategoria}
        </Badge>
    </div>
    </div>

    {/* Campos */}
    <div className={styles.campos}>
    {[
        { label: "Costo de producción", valor: producto.eCostProduct. toLocaleString("es-AR", { style: "currency", currency: "ARS" }) },
        { label: "Precio al público",  valor: producto.ePriceProduct.toLocaleString("es-AR", { style: "currency", currency: "ARS" }) },
        { label: "Fecha de Creación",  valor: formatFechaHora(producto.fhCreateProduct) },
        { label: "Ultima Actualización", valor: formatRelativo(producto.fhUpdateProduct) },
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
"use client";

import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora, formatRelativo } from "@/lib/utils/fecha";
import type { Producto } from "@/types";
import styles from "./ModalVerProducto.module.css";

interface Props {
producto: Producto;
onClose: () => void;
}

export function ModalVerProducto({ producto, onClose }: Props) {
const iniciales = producto.tNameProduct   
.split(" ")
.map((n) => n[0])
.slice(0, 2)
.join("")
.toUpperCase();

return (
<Modal
    titulo="Detalle de producto"
    onCerrar={onClose}
    labelCancelar="Cerrar"
    ancho="sm"
>
    {/* Avatar */}
    <div className={styles.avatarWrap}>
    <div
        className={styles.avatar}
        style={{
        background: producto.tNameProduct === "admin" ? "#FAEEDA" : "#E1F5EE",
        color: producto.tNameProduct === "admin" ? "#633806" : "#085041",
        }}
    >
        {iniciales}
    </div>
    <div className={styles.avatarNombre}>{producto.tNameProduct}</div>
    <div style={{ display: "flex", gap: 10 }}>
        <Badge activo={producto.bStateProduct} />
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
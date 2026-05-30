"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora, formatRelativo } from "@/lib/utils/fecha";
import { obtenerPresentaciones } from "@/lib/actions/presentaciones";
import type { Producto, Categoria, Presentacion } from "@/types";
import styles from "./ModalVerProducto.module.css";

interface Props {
  producto:   Producto;
  categorias: Categoria[];
  onClose:    () => void;
}

export function ModalVerProducto({ producto, categorias, onClose }: Props) {
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [cargando, setCargando]             = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function cargar() {
      const result = await obtenerPresentaciones(producto.eCodProduct);
      if (cancelled) return;
      setPresentaciones(result.presentaciones ?? []);
      setCargando(false);
    }
    cargar();
    return () => { cancelled = true; };
  }, [producto.eCodProduct]);

  const iniciales = producto.tNameProduct
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const imgSrc = producto.ImgProduct?.split("?")[0] ?? null;

  const categoriasMap  = new Map(categorias.map((c) => [c.eCodCategory, c.tNameCategory]));
  const nombreCategoria = producto.fkeCodCategory
    ? categoriasMap.get(producto.fkeCodCategory) ?? "Categoría no encontrada"
    : "Sin categoría";

  const tienePresentaciones = presentaciones.length > 0;

  const campos = [
    {
      label: "Costo de producción",
      valor: producto.eCostProduct.toLocaleString("es-MX", { style: "currency", currency: "MXN" }),
    },
    {
      label: "Precio al público",
      valor: producto.ePriceProduct.toLocaleString("es-MX", { style: "currency", currency: "MXN" }),
    },
    { label: "Fecha de Creación",      valor: formatFechaHora(producto.fhCreateProduct)  },
    { label: "Última Actualización",   valor: formatRelativo(producto.fhUpdateProduct)    },
  ];

  const headerCellStyle: React.CSSProperties = {
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--gray)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    fontFamily: "var(--font-family)",
  };

  const cellStyle: React.CSSProperties = {
    padding: "9px 12px",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--dark)",
    fontFamily: "var(--font-family)",
  };

  return (
    <Modal
      titulo="Detalle de producto"
      onCerrar={onClose}
      labelCancelar="Cerrar"
      ancho="sm"
    >
      {/* Avatar */}
      <div className={styles.avatarWrap}>
        {imgSrc ? (
          <div className={styles.avatar}>
            <img src={imgSrc} alt={producto.tNameProduct} />
          </div>
        ) : null}
        <div className={styles.avatarNombre}>{producto.tNameProduct}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <Badge activo={producto.bStateProduct} />
          <Badge variante="categoria">{nombreCategoria}</Badge>
        </div>
      </div>

      {/* Campos generales */}
      <div className={styles.campos}>
        {campos.map(({ label, valor }) => (
          <div key={label} className={styles.campo}>
            <span className={styles.campoLabel}>{label}</span>
            <span className={styles.campoValor}>{valor}</span>
          </div>
        ))}
      </div>

      {/* Sección presentaciones */}
      <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--space-4)" }}>
        <p style={{
          margin: "0 0 var(--space-3)",
          fontSize: 13, fontWeight: 700, color: "var(--dark)",
        }}>
          Presentaciones
        </p>

        {cargando ? (
          <p style={{ fontSize: 12, color: "var(--gray)" }}>Cargando…</p>
        ) : !tienePresentaciones ? (
          <p style={{ fontSize: 12, color: "var(--gray)", fontStyle: "italic" }}>
            Este producto no tiene presentaciones — usa el precio al público directamente.
          </p>
        ) : (
          <div style={{
            border: "1px solid var(--border-light)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 100px 100px",
              background: "var(--background)",
              borderBottom: "1px solid var(--border-light)",
            }}>
              <span style={headerCellStyle}>Nombre</span>
              <span style={headerCellStyle}>Precio</span>
              <span style={headerCellStyle}>Costo</span>
            </div>

            {/* Filas */}
            {presentaciones.map((p, idx) => (
              <div
                key={p.eCodPresentacion}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 100px",
                  alignItems: "center",
                  borderBottom: idx < presentaciones.length - 1
                    ? "1px solid var(--border-light)"
                    : "none",
                  background: "white",
                  opacity: p.bStatePresentacion ? 1 : 0.45,
                }}
              >
                <span style={cellStyle}>
                  {p.tNombre}
                  {!p.bStatePresentacion && (
                    <span style={{
                      marginLeft: 6, fontSize: 10, fontWeight: 700,
                      color: "var(--gray)", textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}>
                      Inactiva
                    </span>
                  )}
                </span>
                <span style={cellStyle}>
                  ${p.ePricePresentacion.toFixed(2)}
                </span>
                <span style={{ ...cellStyle, color: "var(--gray)" }}>
                  ${p.eCostPresentacion.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
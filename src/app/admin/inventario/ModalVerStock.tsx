"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora, formatRelativo } from "@/lib/utils/fecha";
import { getEstadoStock } from "@/types";
import type { InventarioConProducto } from "./InventarioClient";
import styles from "./ModalVerStock.module.css";

interface Props {
  inventario: InventarioConProducto;
  onClose: () => void;
}

export function ModalVerStock({ inventario, onClose }: Props) {
  const [ts] = useState(() => Date.now());

  const esIlimitado = inventario.bUnlimitedInventory;
  const estado     = getEstadoStock(inventario.eCantRestante, inventario.eStockMinimo, esIlimitado);

  const pctVendido =
    !esIlimitado && inventario.eCantIngresada && inventario.eCantIngresada > 0
      ? Math.round(((inventario.eCantVendida ?? 0) / inventario.eCantIngresada) * 100)
      : 0;

  const barraColor = esIlimitado
    ? "var(--color-primary)"
    : { disponible: "var(--color-success)", bajo: "var(--color-warning)", agotado: "var(--color-error)", ilimitado: "var(--color-primary)" }[estado];

  const imgSrc = inventario.productos?.ImgProduct
    ? `${inventario.productos.ImgProduct.split("?")[0]}?t=${ts}`
    : null;

  const campos = [
    { label: "Categoría",            valor: inventario.productos?.categorias?.tNameCategory ?? "—" },
    { label: "Precio unitario",      valor: `$${inventario.productos?.ePriceProduct?.toFixed(2) ?? "—"}` },
    { label: "Stock mínimo",         valor: esIlimitado ? "—" : `${inventario.eStockMinimo} unidades` },
    { label: "Fecha de ingreso",     valor: formatFechaHora(inventario.fhCreateInventory) },
    { label: "Última actualización", valor: formatRelativo(inventario.fhUpdateInventory) },
    { label: "Ingresos estimados",   valor: `$${((inventario.eCantVendida ?? 0) * (inventario.productos?.ePriceProduct ?? 0)).toFixed(2)}` },
  ];

  return (
    <Modal titulo="Detalle de stock" onCerrar={onClose} labelCancelar="Cerrar" ancho="sm">

      <div className={styles.avatarWrap}>
        <div className={styles.avatar}>
          {imgSrc ? (
            <img src={imgSrc} alt={inventario.productos?.tNameProduct} className={styles.avatarImg} />
          ) : (
            <span style={{ fontSize: 28 }}>📦</span>
          )}
        </div>
        <div className={styles.avatarNombre}>{inventario.productos?.tNameProduct ?? "—"}</div>
        <div className={styles.badges}>
          <Badge activo={inventario.bStateInventory} />
          {esIlimitado ? (
            <Badge variante="ilimitado">Ilimitado</Badge>
          ) : (
            <Badge variante={estado === "disponible" ? "disponible" : estado === "bajo" ? "bajo" : "agotado"} />
          )}
        </div>
      </div>

      {/* Para ilimitados: solo mostrar vendidas */}
      {esIlimitado ? (
        <div style={{
          background: "var(--color-primary-50)",
          border: "1px solid var(--color-primary-light)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-4)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: "var(--color-primary)" }}>
            {inventario.eCantVendida ?? 0}
          </div>
          <div style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 4 }}>
            Unidades vendidas
          </div>
        </div>
      ) : (
        <>
          <div className={styles.nums}>
            {[
              { label: "Ingresadas", valor: inventario.eCantIngresada ?? 0, color: "var(--dark)" },
              { label: "Vendidas",   valor: inventario.eCantVendida ?? 0,   color: "var(--gray)" },
              { label: "Restantes",  valor: inventario.eCantRestante ?? 0,  color: barraColor    },
            ].map(({ label, valor, color }) => (
              <div key={label} className={styles.numCard}>
                <div className={styles.numValor} style={{ color }}>{valor}</div>
                <div className={styles.numLabel}>{label}</div>
              </div>
            ))}
          </div>
          <div className={styles.barraWrap}>
            <div className={styles.barraHeader}>
              <span style={{ fontSize: 12, color: "var(--gray)", fontWeight: 600 }}>Vendido</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: barraColor }}>{pctVendido}%</span>
            </div>
            <div className={styles.barra}>
              <div className={styles.barraFill} style={{ width: `${pctVendido}%`, background: barraColor }} />
            </div>
          </div>
        </>
      )}

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
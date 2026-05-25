"use client";

import { useState } from "react";
import type { ProductoConStock, Categoria } from "@/types";
import { Buscador } from "@/components/ui/Buscador";
import { CategoriaCarrusel } from "@/components/ui/CategoriaCarrusel/CategoriaCarrusel";
import { Badge } from "@/components/ui/Badge";
import { getEstadoStock } from "@/types";
import styles from "./Inventario.module.css";

type ProductoConStockExtendido = ProductoConStock & {
  stockMinimo:    number;
  stockIngresado: number;
};

interface Props {
  categorias: Categoria[];
  productos: ProductoConStockExtendido[];
}

export function InventarioEmpleadoClient({ categorias, productos }: Props) {
  const [categoriaActiva, setCategoriaActiva] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");

  const productosFiltrados = productos.filter((p) => {
    const coincideCategoria =
      categoriaActiva === "todas" || p.fkeCodCategory === categoriaActiva;
    const coincideBusqueda = p.tNameProduct
      .toLowerCase()
      .includes(busqueda.toLowerCase());
    return coincideCategoria && coincideBusqueda;
  });

  const conteoPorCategoria: Record<string, number> = {
    todas: productos.length,
    ...Object.fromEntries(
      categorias.map((c) => [
        c.eCodCategory,
        productos.filter((p) => p.fkeCodCategory === c.eCodCategory).length,
      ])
    ),
  };

  return (
    <div className={styles.layout}>
      <div className={styles.buscadorWrap}>
        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Busca el producto aquí"
        />
      </div>

      <CategoriaCarrusel
        categorias={categorias}
        categoriaActiva={categoriaActiva}
        conteoPorCategoria={conteoPorCategoria}
        onSeleccionar={setCategoriaActiva}
      />

      {productosFiltrados.length === 0 ? (
        <div className={styles.vacio}>
          <p>No hay productos en inventario</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {productosFiltrados.map((producto) => {
            const estado = getEstadoStock(
              producto.stockDisponible,
              producto.stockMinimo
            );

            const esIlimitado = estado === "ilimitado";

            const barraColor =
              esIlimitado          ? "var(--color-primary)"
              : estado === "bajo"  ? "var(--color-warning)"
              : estado === "agotado" ? "var(--color-error)"
              : "var(--color-primary)";

            const pct = esIlimitado
              ? 100
              : producto.stockIngresado > 0
              ? Math.min((producto.stockDisponible / producto.stockIngresado) * 100, 100)
              : 100;

            const badgeLabel =
              esIlimitado            ? "Ilimitado"
              : estado === "bajo"    ? "Stock bajo"
              : estado === "agotado" ? "Agotado"
              : "Disponible";

            const badgeVariante =
              esIlimitado            ? "ilimitado"  as const
              : estado === "bajo"    ? "bajo"        as const
              : estado === "agotado" ? "agotado"     as const
              : "disponible"                          as const;

            return (
              <div key={producto.eCodProduct} className={styles.card}>
                {/* Badge estado */}
                <div className={styles.badgeWrap}>
                  <Badge variante={badgeVariante} dot={false}>
                    {badgeLabel}
                  </Badge>
                </div>

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
                      <IconoCaja />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className={styles.info}>
                  <p className={styles.nombre}>{producto.tNameProduct}</p>

                  <div className={styles.stockRow}>
                    <span className={styles.stockLabel}>Existencia</span>
                    <span className={styles.stockValor}>
                      <strong>{producto.stockDisponible}</strong> piezas
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <div className={styles.barra}>
                    <div
                      className={styles.barraFill}
                      style={{ width: `${pct}%`, background: barraColor }}
                    />
                  </div>

                  <div className={styles.minimoRow}>
                    <span className={styles.minimoLabel}>
                      {esIlimitado
                        ? "Sin stock mínimo"
                        : <>Mínimo: <strong>{producto.stockMinimo}</strong> piezas</>
                      }
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconoCaja() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}
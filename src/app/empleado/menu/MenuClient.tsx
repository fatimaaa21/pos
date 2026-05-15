"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Categoria, ProductoConStock, MetodoPago } from "@/types";
import { Buscador } from "@/components/ui/Buscador";
import { CategoriaCarrusel } from "@/components/ui/CategoriaCarrusel/CategoriaCarrusel";
import { ProductoGrid } from "@/components/ui/ProductoGrid/ProductoGrid";
import { PedidoPanel } from "@/components/ui/PedidoPanel/PedidoPanel";
import { ModalVentaExitosa } from "@/components/ui/ModalVentaExitosa/Modalventaexitosa";
import { crearVenta } from "@/lib/actions/ventas";
import styles from "./menu.module.css";

export interface ItemCarritoMenu {
  producto: ProductoConStock;
  cantidad: number;
}

interface Props {
  categorias: Categoria[];
  productos: ProductoConStock[];   // ← solo los que tienen stock
}

export function MenuClient({ categorias, productos }: Props) {
  const [categoriaActiva, setCategoriaActiva] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState("");
  const router = useRouter();
  const [carrito, setCarrito] = useState<ItemCarritoMenu[]>([]);
  const [errorVenta, setErrorVenta] = useState<string | null>(null);
  const [ventaExitosa, setVentaExitosa] = useState<string | null>(null);

  // ── Filtrado ──────────────────────────────────────────────────────────────
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

  // ── Carrito ───────────────────────────────────────────────────────────────
  function agregarProducto(producto: ProductoConStock) {
    setErrorVenta(null);
    setCarrito((prev) => {
      const existe = prev.find((i) => i.producto.eCodProduct === producto.eCodProduct);
      // No agregar más de lo que hay en stock
      if (existe) {
        if (existe.cantidad >= producto.stockDisponible) return prev;
        return prev.map((i) =>
          i.producto.eCodProduct === producto.eCodProduct
            ? { ...i, cantidad: i.cantidad + 1 }
            : i
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  }

  function cambiarCantidad(eCodProduct: string, delta: number) {
    setErrorVenta(null);
    setCarrito((prev) =>
      prev
        .map((i) => {
          if (i.producto.eCodProduct !== eCodProduct) return i;
          const nuevaCantidad = i.cantidad + delta;
          // No superar el stock disponible
          if (nuevaCantidad > i.producto.stockDisponible) return i;
          return { ...i, cantidad: nuevaCantidad };
        })
        .filter((i) => i.cantidad > 0)
    );
  }

  function limpiarCarrito() {
    setCarrito([]);
    setErrorVenta(null);
  }

  // ── Finalizar venta ───────────────────────────────────────────────────────
  async function handleFinalizar(metodoPago: MetodoPago) {
    setErrorVenta(null);

    const result = await crearVenta(
      carrito.map((i) => ({
        eCodProduct:    i.producto.eCodProduct,
        cantidad:       i.cantidad,
        precioUnitario: i.producto.ePriceProduct,
      })),
      metodoPago
    );

    if (result.error) {
      setErrorVenta(result.error);
      return;
    }

    setVentaExitosa(result.eCodVenta!);
  }

  function handleNuevoPedido() {
    setVentaExitosa(null);
    limpiarCarrito();
    router.refresh();
  }

  return (
    <>
      {/* ── Catálogo ── */}
      <div className={styles.layout}>
        <Buscador valor={busqueda} onChange={setBusqueda} />

        <CategoriaCarrusel
          categorias={categorias}
          categoriaActiva={categoriaActiva}
          conteoPorCategoria={conteoPorCategoria}
          onSeleccionar={setCategoriaActiva}
        />

        <ProductoGrid
          productos={productosFiltrados}
          onAgregar={agregarProducto}
        />
      </div>

      {/* ── Panel de pedido fijo ── */}
      <PedidoPanel
        items={carrito}
        onCambiarCantidad={cambiarCantidad}
        onLimpiar={limpiarCarrito}
        onFinalizar={handleFinalizar}
        error={errorVenta}
      />

      {/* ── Modal éxito ── */}
      {ventaExitosa && (
        <ModalVentaExitosa
          eCodVenta={ventaExitosa}
          onNuevoPedido={handleNuevoPedido}
        />
      )}
    </>
  );
}
"use client";

import { useState, useTransition }  from "react";
import toast                         from "react-hot-toast";
import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import { Buscador }          from "@/components/ui/Buscador";
import { CategoriaCarrusel } from "@/components/ui/CategoriaCarrusel/CategoriaCarrusel";
import { ProductoGrid }      from "@/components/ui/ProductoGrid/ProductoGrid";
import { PedidoPanel }       from "@/components/ui/PedidoPanel/PedidoPanel";
import { ModalVentaExitosa } from "@/components/ui/ModalVentaExitosa/Modalventaexitosa";
import {
  obtenerMesasConEstado,
  obtenerOrdenAbierta,
  abrirOrdenMesa,
  agregarItemOrden,
  actualizarCantidadItem,
  eliminarItemOrden,
  cobrarOrdenMesa,
  limpiarOrdenMesa,
} from "@/lib/actions/mesas";
import type {
  MesaConEstado,
  Categoria,
  ProductoConStock,
  PresentacionConStock,
  OrdenMesaDetalleConProducto,
  ItemCarritoMenu,
  MetodoPago,
} from "@/types";
import type { MetodoPagoGlobal } from "@/lib/actions/metodos-pago";
import styles from "./mesas.module.css";

type Vista = "mesas" | "orden";

interface Props {
  mesasIniciales: MesaConEstado[];
  categorias:     Categoria[];
  productos:      ProductoConStock[];
  metodosPago:    MetodoPagoGlobal[];
  tieneTurno:     boolean;
  aplicarIva:     boolean;
}

// Convierte los items de la orden al formato que espera PedidoPanel
function itemsACarrito(items: OrdenMesaDetalleConProducto[]): ItemCarritoMenu[] {
  return items.map((item) => ({
    key:      item.eCodDetalle,
    producto: {
      eCodProduct:     item.fkeCodProduct,
      tNameProduct:    item.producto?.tNameProduct ?? "Producto",
      ePriceProduct:   item.ePrecio,
      ImgProduct:      item.producto?.ImgProduct,
      stockDisponible: Number.MAX_SAFE_INTEGER,
      bInfinito:       true,
    },
    cantidad: item.eCantidad,
    presentacion: item.fkeCodPresentacion
      ? {
          eCodPresentacion:   item.fkeCodPresentacion,
          tNombre:            item.presentacion?.tNombre ?? "",
          ePricePresentacion: item.ePrecio,
          eCostPresentacion:  0,
          eCantidadUnidades:  1,
          stockDisponible:    Number.MAX_SAFE_INTEGER,
          bInfinito:          true,
        }
      : undefined,
  }));
}

export function MesasClient({
  mesasIniciales,
  categorias,
  productos,
  metodosPago,
  tieneTurno,
  aplicarIva,
}: Props) {
  const [vista,           setVista]           = useState<Vista>("mesas");
  const [mesas,           setMesas]           = useState(mesasIniciales);
  const [mesaActiva,      setMesaActiva]      = useState<MesaConEstado | null>(null);
  const [eCodOrden,       setECodOrden]       = useState<string | null>(null);
  const [items,           setItems]           = useState<OrdenMesaDetalleConProducto[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState("todas");
  const [busqueda,        setBusqueda]        = useState("");
  const [ventaExitosa,    setVentaExitosa]    = useState<string | null>(null);
  const [errorVenta,      setErrorVenta]      = useState<string | null>(null);
  const [isPending,       startTransition]    = useTransition();

  // ── Filtros de catálogo ──────────────────────────────────────────────────
  const productosFiltrados = productos.filter((p) => {
    const cat = categoriaActiva === "todas" || p.fkeCodCategory === categoriaActiva;
    const nom = p.tNameProduct.toLowerCase().includes(busqueda.toLowerCase());
    return cat && nom;
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

  // ── Helpers ──────────────────────────────────────────────────────────────
  async function recargarMesas() {
    const actualizadas = await obtenerMesasConEstado();
    setMesas(actualizadas);
  }

  async function recargarOrden(codMesa: string) {
    const orden = await obtenerOrdenAbierta(codMesa);
    setItems(orden?.detalle ?? []);
  }

  // ── Entrar a una mesa ────────────────────────────────────────────────────
  async function handleClickMesa(mesa: MesaConEstado) {
    if (!tieneTurno) {
      toast.error("Debes abrir un turno antes de atender mesas");
      return;
    }

    setMesaActiva(mesa);
    setErrorVenta(null);

    if (mesa.ordenAbierta) {
      setECodOrden(mesa.ordenAbierta.eCodOrden);
      const orden = await obtenerOrdenAbierta(mesa.eCodMesa);
      setItems(orden?.detalle ?? []);
      setVista("orden");
      return;
    }

    startTransition(async () => {
      const result = await abrirOrdenMesa(mesa.eCodMesa);
      if ("error" in result) { toast.error(result.error); return; }
      setECodOrden(result.eCodOrden);
      setItems([]);
      setVista("orden");
      await recargarMesas();
    });
  }

  // ── Agregar producto ─────────────────────────────────────────────────────
  function handleAgregarProducto(
    producto: ProductoConStock,
    presentacion?: PresentacionConStock
  ) {
    if (!eCodOrden) return;
    setErrorVenta(null);

    const ePrecio = presentacion
      ? presentacion.ePricePresentacion
      : producto.ePriceProduct;

    startTransition(async () => {
      const result = await agregarItemOrden(eCodOrden, {
        eCodProduct:      producto.eCodProduct,
        eCodPresentacion: presentacion?.eCodPresentacion,
        eCantidad:        1,
        ePrecio,
      });
      if ("error" in result) { toast.error(result.error); return; }
      await recargarOrden(mesaActiva!.eCodMesa);
    });
  }

  // ── Cambiar cantidad (callback de PedidoPanel) ───────────────────────────
  function handleCambiarCantidad(key: string, delta: number) {
    // key = eCodDetalle
    const item = items.find((i) => i.eCodDetalle === key);
    if (!item) return;

    const nueva = item.eCantidad + delta;

    startTransition(async () => {
      if (nueva <= 0) {
        const result = await eliminarItemOrden(key);
        if ("error" in result) { toast.error(result.error); return; }
      } else {
        const result = await actualizarCantidadItem(key, nueva);
        if ("error" in result) { toast.error(result.error); return; }
      }
      await recargarOrden(mesaActiva!.eCodMesa);
    });
  }

  // ── Limpiar orden (callback de PedidoPanel) ──────────────────────────────
  function handleLimpiar() {
    if (!eCodOrden) return;
    startTransition(async () => {
      const result = await limpiarOrdenMesa(eCodOrden);
      if ("error" in result) { toast.error(result.error); return; }
      setItems([]);
    });
  }

  // ── Finalizar/cobrar (callback de PedidoPanel) ───────────────────────────
  async function handleFinalizar(metodoPago: MetodoPago): Promise<void> {
    if (!eCodOrden) return;
    setErrorVenta(null);

    const result = await cobrarOrdenMesa(eCodOrden, metodoPago);

    if ("error" in result) {
      setErrorVenta(result.error);
      return;
    }

    setVentaExitosa(result.eCodVenta);
    await recargarMesas();
  }

  // ── Volver al grid ───────────────────────────────────────────────────────
  function handleVolver() {
    setVista("mesas");
    setMesaActiva(null);
    setECodOrden(null);
    setItems([]);
    setBusqueda("");
    setCategoriaActiva("todas");
    setErrorVenta(null);
  }

  // ── Vista: grid de mesas ─────────────────────────────────────────────────
  if (vista === "mesas") {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.titulo}>Mesas</h1>
        </div>

        {mesas.length === 0 ? (
          <div className={styles.vacio}>
            <UtensilsCrossed size={32} strokeWidth={1.2} />
            <p>No hay mesas configuradas</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {mesas.map((mesa) => {
              const ocupada = !!mesa.ordenAbierta;
              return (
                <button
                  key={mesa.eCodMesa}
                  className={`${styles.mesaCard} ${ocupada ? styles.mesaOcupada : styles.mesaLibre}`}
                  onClick={() => handleClickMesa(mesa)}
                  disabled={isPending || !tieneTurno}
                >
                  <span className={styles.mesaNombre}>{mesa.tNombre}</span>
                  <span className={`${styles.mesaEstado} ${ocupada ? styles.estadoOcupada : styles.estadoLibre}`}>
                    {ocupada ? "Ocupada" : "Libre"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Vista: orden de mesa ─────────────────────────────────────────────────
  return (
    <>
      <div className={styles.ordenLayout}>
        <div className={styles.ordenHeader}>
          <button className={styles.btnVolver} onClick={handleVolver}>
            <ArrowLeft size={16} />
            <span>Mesas</span>
          </button>
          <h2 className={styles.mesaNombreHeader}>{mesaActiva?.tNombre}</h2>
        </div>

        <Buscador
          valor={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar producto..."
        />

        <CategoriaCarrusel
          categorias={categorias}
          categoriaActiva={categoriaActiva}
          onSeleccionar={setCategoriaActiva}
          conteoPorCategoria={conteoPorCategoria}
        />

        <ProductoGrid
          productos={productosFiltrados}
          onAgregar={handleAgregarProducto}
        />
      </div>

      <PedidoPanel
        items={itemsACarrito(items)}
        metodosPago={metodosPago}
        onCambiarCantidad={handleCambiarCantidad}
        onLimpiar={handleLimpiar}
        onFinalizar={handleFinalizar}
        error={errorVenta}
        aplicarIva={aplicarIva}
      />

      {ventaExitosa && (
        <ModalVentaExitosa
          eCodVenta={ventaExitosa}
          onNuevoPedido={() => { setVentaExitosa(null); handleVolver(); }}
        />
      )}
    </>
  );
}
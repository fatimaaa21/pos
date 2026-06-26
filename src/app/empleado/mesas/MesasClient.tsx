"use client";

import { useState, useTransition, useEffect, useCallback }  from "react";
import toast                         from "react-hot-toast";
import { ArrowLeft, UtensilsCrossed, ShoppingBag } from "lucide-react";
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
import { crearVenta } from "@/lib/actions/ventas";
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

type Vista = "mesas" | "orden" | "directo";

interface Props {
  mesasIniciales:   MesaConEstado[];
  categorias:       Categoria[];
  productos:        ProductoConStock[];
  metodosPago:      MetodoPagoGlobal[];
  tieneTurno:       boolean;
  aplicarIva:       boolean;
  tipo_negocio:     "general" | "impresion" | "billar";
  costo_hora_billar: number | null;
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

function carritoKey(item: Pick<ItemCarritoMenu, "producto" | "presentacion">): string {
  return `${item.producto.eCodProduct}_${item.presentacion?.eCodPresentacion ?? ""}`;
}

export function MesasClient({
  mesasIniciales,
  categorias,
  productos,
  metodosPago,
  tieneTurno,
  aplicarIva,
  tipo_negocio,
  costo_hora_billar,
}: Props) {
  const [vista,           setVista]           = useState<Vista>("mesas");
  const [mesas,           setMesas]           = useState(mesasIniciales);
  const [mesaActiva,      setMesaActiva]      = useState<MesaConEstado | null>(null);
  const [eCodOrden,       setECodOrden]       = useState<string | null>(null);
  const [fhOrdenActiva,   setFhOrdenActiva]   = useState<string | null>(null);
  const [items,           setItems]           = useState<OrdenMesaDetalleConProducto[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState("todas");
  const [busqueda,        setBusqueda]        = useState("");
  const [ventaExitosa,    setVentaExitosa]    = useState<string | null>(null);
  const [errorVenta,      setErrorVenta]      = useState<string | null>(null);
  const [isPending,       startTransition]    = useTransition();

  // ── Carrito para pedidos directos (sin mesa) ─────────────────────────────
  const [carritoDirecto,  setCarritoDirecto]  = useState<ItemCarritoMenu[]>([]);
  const [errorDirecto,    setErrorDirecto]    = useState<string | null>(null);
  const [ventaDirectaOk,  setVentaDirectaOk]  = useState<string | null>(null);

  // ── Timer para billar ────────────────────────────────────────────────────
  const esBillar = tipo_negocio === "billar";
  const [ahora, setAhora]               = useState<Date | null>(null);
  const [ahoraCongelado, setCongelado]  = useState<Date | null>(null);

  const ahoraEfectivo = ahoraCongelado ?? ahora;

  useEffect(() => {
    if (!esBillar) return;
    setAhora(new Date());
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, [esBillar]);

  const formatTiempo = useCallback((fhAbierta: string): string => {
    if (!ahoraEfectivo) return "00:00";
    const diff = Math.max(0, ahoraEfectivo.getTime() - new Date(fhAbierta).getTime());
    const totalSeg = Math.floor(diff / 1000);
    const h   = Math.floor(totalSeg / 3600);
    const min = Math.floor((totalSeg % 3600) / 60);
    const seg = totalSeg % 60;
    if (h > 0) {
      return `${h}:${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
    }
    return `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
  }, [ahoraEfectivo]);

  const calcCosto = useCallback((fhAbierta: string): number => {
    if (!costo_hora_billar || !ahoraEfectivo) return 0;
    const diff = Math.max(0, ahoraEfectivo.getTime() - new Date(fhAbierta).getTime());
    const horas = diff / (1000 * 60 * 60);
    return Math.round(horas * costo_hora_billar * 100) / 100;
  }, [ahoraEfectivo, costo_hora_billar]);

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

  function resetFiltros() {
    setBusqueda("");
    setCategoriaActiva("todas");
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
      setFhOrdenActiva(mesa.ordenAbierta.fhAbierta);
      const orden = await obtenerOrdenAbierta(mesa.eCodMesa);
      setItems(orden?.detalle ?? []);
      setVista("orden");
      return;
    }

    startTransition(async () => {
      const result = await abrirOrdenMesa(mesa.eCodMesa);
      if ("error" in result) { toast.error(result.error); return; }
      setECodOrden(result.eCodOrden);
      setFhOrdenActiva(new Date().toISOString());
      setItems([]);
      setVista("orden");
      await recargarMesas();
    });
  }

  // ── Pedido directo: agregar producto ─────────────────────────────────────
  function agregarProductoDirecto(
    producto: ProductoConStock,
    presentacion?: PresentacionConStock
  ) {
    if (!tieneTurno) return;
    setErrorDirecto(null);

    const key   = carritoKey({ producto, presentacion });
    const stock = presentacion?.stockDisponible ?? producto.stockDisponible;
    const bInf  = presentacion?.bInfinito       ?? producto.bInfinito;

    setCarritoDirecto((prev) => {
      const existe = prev.find((i) => carritoKey(i) === key);
      if (existe) {
        if (!bInf && existe.cantidad >= stock) return prev;
        return prev.map((i) =>
          carritoKey(i) === key ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { producto, cantidad: 1, presentacion }];
    });
  }

  function cambiarCantidadDirecto(key: string, delta: number) {
    setErrorDirecto(null);
    setCarritoDirecto((prev) =>
      prev
        .map((i) => {
          if (carritoKey(i) !== key) return i;
          const stock = i.presentacion?.stockDisponible ?? i.producto.stockDisponible;
          const bInf  = i.presentacion?.bInfinito       ?? i.producto.bInfinito;
          const nueva = i.cantidad + delta;
          if (!bInf && nueva > stock) return i;
          return { ...i, cantidad: nueva };
        })
        .filter((i) => i.cantidad > 0)
    );
  }

  function limpiarCarritoDirecto() {
    setCarritoDirecto([]);
    setErrorDirecto(null);
  }

  async function handleFinalizarDirecto(metodoPago: MetodoPago): Promise<void> {
    setErrorDirecto(null);

    const result = await crearVenta(
      carritoDirecto.map((i) => ({
        eCodProduct:      i.producto.eCodProduct,
        eCodPresentacion: i.presentacion?.eCodPresentacion,
        cantidad:         i.cantidad,
        precioUnitario:   i.presentacion?.ePricePresentacion ?? i.producto.ePriceProduct,
      })),
      metodoPago,
      aplicarIva,
    );

    if (result.error) { setErrorDirecto(result.error); return; }
    setVentaDirectaOk(result.eCodVenta!);
  }

  // ── Agregar producto (flujo de mesa) ────────────────────────────────────
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

  function handleCambiarCantidad(key: string, delta: number) {
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

  function handleLimpiar() {
    if (!eCodOrden) return;
    startTransition(async () => {
      const result = await limpiarOrdenMesa(eCodOrden);
      if ("error" in result) { toast.error(result.error); return; }
      setItems([]);
    });
  }

  async function handleFinalizar(metodoPago: MetodoPago): Promise<void> {
    if (!eCodOrden) return;
    setErrorVenta(null);

    const result = await cobrarOrdenMesa(eCodOrden, metodoPago);

    if ("error" in result) {
      setErrorVenta(result.error);
      setCongelado(null);
      return;
    }

    setVentaExitosa(result.eCodVenta);
    await recargarMesas();
  }

  // ── Volver al grid de mesas ──────────────────────────────────────────────
  function handleVolver() {
    setVista("mesas");
    setMesaActiva(null);
    setECodOrden(null);
    setFhOrdenActiva(null);
    setItems([]);
    resetFiltros();
    setErrorVenta(null);
    setCongelado(null);
  }

  // ── Volver desde pedido directo ──────────────────────────────────────────
  function handleVolverDeDirecto() {
    setVista("mesas");
    limpiarCarritoDirecto();
    resetFiltros();
  }

  // ── Vista: grid de mesas ─────────────────────────────────────────────────
  if (vista === "mesas") {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.titulo}>Mesas</h1>
          {tieneTurno && (
            <button
              className={styles.btnPedidoDirecto}
              onClick={() => { resetFiltros(); setVista("directo"); }}
            >
              <ShoppingBag size={14} />
              Pedido directo
            </button>
          )}
        </div>

        {mesas.length === 0 ? (
          <div className={styles.vacio}>
            <UtensilsCrossed size={32} strokeWidth={1.2} />
            <p>No hay mesas configuradas</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {mesas.map((mesa) => {
              const ocupada   = !!mesa.ordenAbierta;
              const fhAbierta = mesa.ordenAbierta?.fhAbierta;
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
                  {esBillar && ocupada && fhAbierta && ahora && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--color-primary)",
                      marginTop: 2,
                      fontVariantNumeric: "tabular-nums",
                      letterSpacing: "0.02em",
                    }}>
                      {formatTiempo(fhAbierta)}
                      {costo_hora_billar != null && (
                        <span style={{ marginLeft: 4, color: "var(--gray)", fontWeight: 500 }}>
                          · ${calcCosto(fhAbierta).toFixed(2)}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Vista: pedido directo (sin mesa) ─────────────────────────────────────
  if (vista === "directo") {
    return (
      <>
        <div className={styles.ordenLayout}>
          <div className={styles.ordenHeader}>
            <button className={styles.btnVolver} onClick={handleVolverDeDirecto}>
              <ArrowLeft size={16} />
              <span>Mesas</span>
            </button>
            <h2 className={styles.mesaNombreHeader}>Pedido directo</h2>
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
            onAgregar={agregarProductoDirecto}
          />
        </div>

        <PedidoPanel
          items={carritoDirecto}
          metodosPago={metodosPago}
          onCambiarCantidad={cambiarCantidadDirecto}
          onLimpiar={limpiarCarritoDirecto}
          onFinalizar={handleFinalizarDirecto}
          error={errorDirecto}
          aplicarIva={aplicarIva}
        />

        {ventaDirectaOk && (
          <ModalVentaExitosa
            eCodVenta={ventaDirectaOk}
            onNuevoPedido={() => {
              setVentaDirectaOk(null);
              limpiarCarritoDirecto();
              resetFiltros();
            }}
          />
        )}
      </>
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
        onIniciarCobro={esBillar ? () => setCongelado(new Date()) : undefined}
        error={errorVenta}
        aplicarIva={aplicarIva}
        cargoExtra={
          esBillar && fhOrdenActiva
            ? {
                label: `Tiempo de mesa (${formatTiempo(fhOrdenActiva)})`,
                monto: calcCosto(fhOrdenActiva),
              }
            : null
        }
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
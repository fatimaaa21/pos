"use client";

import { useState }   from "react";
import { useRouter }  from "next/navigation";
import type {
  Categoria, ProductoConStock, PresentacionConStock,
  ItemCarritoMenu, MetodoPago,
} from "@/types";
import type { MetodoPagoGlobal }  from "@/lib/actions/metodos-pago";
import { Modal, ModalField, ModalInput } from "@/components/ui/Modal";
import { iniciarTurno }           from "@/lib/actions/cortes";
import { Calculator }             from "lucide-react";
import { Buscador }               from "@/components/ui/Buscador";
import { CategoriaCarrusel }      from "@/components/ui/CategoriaCarrusel/CategoriaCarrusel";
import { ProductoGrid }           from "@/components/ui/ProductoGrid/ProductoGrid";
import { PedidoPanel }            from "@/components/ui/PedidoPanel/PedidoPanel";
import { ModalVentaExitosa }      from "@/components/ui/ModalVentaExitosa/Modalventaexitosa";
import { ModalCerrarCaja }        from "./ModalCerrarCaja";
import type { CorteCaja, VentasDelTurno } from "@/types";
import { crearVenta }             from "@/lib/actions/ventas";
import styles from "./menu.module.css";

const VENTAS_VACIO: VentasDelTurno = {
  eTotalEfectivo: 0, eTotalTarjeta: 0,
  eTotalTransferencia: 0, eTotalVentas: 0, eNumVentas: 0,
};

/** Clave única por ítem en el carrito (producto + presentación opcional) */
function carritoKey(item: Pick<ItemCarritoMenu, "producto" | "presentacion">): string {
  return `${item.producto.eCodProduct}_${item.presentacion?.eCodPresentacion ?? ""}`;
}

interface Props {
  categorias:     Categoria[];
  productos:      ProductoConStock[];
  tieneTurno:     boolean;
  metodosPago:    MetodoPagoGlobal[];
  corte:          CorteCaja | null;
  ventasDelTurno: VentasDelTurno;
}

export function MenuClient({
  categorias, productos, tieneTurno, metodosPago,
  corte, ventasDelTurno = VENTAS_VACIO,
}: Props) {
  const [categoriaActiva, setCategoriaActiva] = useState<string>("todas");
  const [busqueda, setBusqueda]               = useState("");
  const router                                = useRouter();
  const [carrito, setCarrito]                 = useState<ItemCarritoMenu[]>([]);
  const [errorVenta, setErrorVenta]           = useState<string | null>(null);
  const [ventaExitosa, setVentaExitosa]       = useState<string | null>(null);
  const [modalCerrarCaja, setModalCerrarCaja] = useState(false);

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const productosFiltrados = productos.filter((p) => {
    const coincideCategoria =
      categoriaActiva === "todas" || p.fkeCodCategory === categoriaActiva;
    const coincideBusqueda  = p.tNameProduct.toLowerCase().includes(busqueda.toLowerCase());
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

  // ── Agregar al carrito ────────────────────────────────────────────────────
  function agregarProducto(producto: ProductoConStock, presentacion?: PresentacionConStock) {
    if (!tieneTurno) return;
    setErrorVenta(null);

    const key    = carritoKey({ producto, presentacion });
    const stock  = presentacion?.stockDisponible ?? producto.stockDisponible;
    const bInf   = presentacion?.bInfinito       ?? producto.bInfinito;

    setCarrito((prev) => {
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

  // ── Cambiar cantidad ──────────────────────────────────────────────────────
  function cambiarCantidad(key: string, delta: number) {
    setErrorVenta(null);
    setCarrito((prev) =>
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

  function limpiarCarrito() {
    setCarrito([]);
    setErrorVenta(null);
  }

  // ── Finalizar venta ───────────────────────────────────────────────────────
  async function handleFinalizar(metodoPago: MetodoPago) {
    if (!tieneTurno) return;
    setErrorVenta(null);

    const result = await crearVenta(
      carrito.map((i) => ({
        eCodProduct:       i.producto.eCodProduct,
        eCodPresentacion:  i.presentacion?.eCodPresentacion,
        cantidad:          i.cantidad,
        precioUnitario:    i.presentacion?.ePricePresentacion ?? i.producto.ePriceProduct,
      })),
      metodoPago
    );

    if (result.error) { setErrorVenta(result.error); return; }
    setVentaExitosa(result.eCodVenta!);
  }

  function handleNuevoPedido() {
    setVentaExitosa(null);
    limpiarCarrito();
    router.refresh();
  }

  // ── Modal turno ───────────────────────────────────────────────────────────
  const [modalTurno,   setModalTurno]   = useState(false);
  const [fondoInicial, setFondoInicial] = useState("");
  const [nombreTurno,  setNombreTurno]  = useState("");
  const [errorTurno,   setErrorTurno]   = useState<string | null>(null);
  const [loadingTurno, setLoadingTurno] = useState(false);

  async function handleIniciarTurno() {
    setErrorTurno(null);
    setLoadingTurno(true);
    const fd = new FormData();
    fd.append("eFondoInicial", fondoInicial);
    fd.append("tNombreTurno",  nombreTurno);
    const result = await iniciarTurno(fd);
    setLoadingTurno(false);
    if (result.error) setErrorTurno(result.error);
    else { setModalTurno(false); router.refresh(); }
  }

  return (
    <>
      {/* Banner turno no iniciado */}
      {!tieneTurno && (
        <div className={styles.bannerTurno}>
          <div className={styles.bannerTexto}>
            <Calculator size={18} className={styles.bannerIcono} />
            <div>
              <p className={styles.bannerTitulo}>No tienes un turno activo</p>
              <p className={styles.bannerSub}>Inicia tu turno para poder registrar pedidos</p>
            </div>
          </div>
          <button className={styles.bannerBtn} onClick={() => setModalTurno(true)}>
            Iniciar turno
          </button>
        </div>
      )}

      {/* Catálogo */}
      <div className={`${styles.layout} ${!tieneTurno ? styles.layoutBloqueado : ""}`}>
        <div className={styles.buscadorRow}>
          <div className={styles.buscadorFlex}>
            <Buscador valor={busqueda} onChange={setBusqueda} />
          </div>
          {tieneTurno && (
            <button className={styles.btnCerrarCaja} onClick={() => setModalCerrarCaja(true)}>
              Cerrar caja
            </button>
          )}
        </div>

        <CategoriaCarrusel
          categorias={categorias}
          categoriaActiva={categoriaActiva}
          conteoPorCategoria={conteoPorCategoria}
          onSeleccionar={setCategoriaActiva}
        />

        <ProductoGrid
          productos={productosFiltrados}
          onAgregar={tieneTurno ? agregarProducto : () => {}}
        />
      </div>

      {/* Panel de pedido */}
      <PedidoPanel
        items={carrito}
        metodosPago={metodosPago}
        onCambiarCantidad={cambiarCantidad}
        onLimpiar={limpiarCarrito}
        onFinalizar={handleFinalizar}
        error={errorVenta}
        bloqueado={!tieneTurno}
      />

      {ventaExitosa && (
        <ModalVentaExitosa
          eCodVenta={ventaExitosa}
          onNuevoPedido={handleNuevoPedido}
        />
      )}

      {/* Modal iniciar turno */}
      {modalTurno && (
        <Modal
          titulo="Iniciar turno"
          onCerrar={() => { setModalTurno(false); setErrorTurno(null); }}
          onConfirmar={handleIniciarTurno}
          labelConfirmar="Iniciar turno"
          labelCancelar="Cancelar"
          cargando={loadingTurno}
          deshabilitado={fondoInicial === ""}
          error={errorTurno}
        >
          <ModalField label="Fondo inicial en efectivo" required>
            <ModalInput
              type="number" min="0" step="0.01" placeholder="0.00"
              value={fondoInicial}
              onChange={(e) => setFondoInicial(e.target.value)}
              autoFocus
            />
          </ModalField>
          <ModalField label="Nombre del turno (opcional)">
            <ModalInput
              type="text" placeholder="Ej. Turno matutino"
              value={nombreTurno}
              onChange={(e) => setNombreTurno(e.target.value)}
            />
          </ModalField>
        </Modal>
      )}

      {tieneTurno && corte && modalCerrarCaja && (
        <ModalCerrarCaja
          corte={corte}
          ventasDelTurno={ventasDelTurno}
          onClose={() => setModalCerrarCaja(false)}
          onCerrado={() => { setModalCerrarCaja(false); router.refresh(); }}
        />
      )}
    </>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { GlassWater, Minus, Plus, Trash2, Coffee } from "lucide-react";
import type { Categoria, ProductoConStock, PresentacionConStock, ExtraCarrito } from "@/types";
import { firmaExtras } from "@/lib/utils/extras";
import { formatFechaHora } from "@/lib/utils/fecha";
import { Buscador } from "@/components/ui/Buscador";
import { CategoriaCarrusel } from "@/components/ui/CategoriaCarrusel/CategoriaCarrusel";
import { ProductoGrid } from "@/components/ui/ProductoGrid/ProductoGrid";
import { crearAutoconsumo } from "@/lib/actions/autoconsumo";
import type { AutoconsumoHistorial } from "@/types/autoconsumo";
import styles from "./autoconsumo.module.css";

interface ItemCarrito {
  key: string;
  producto: ProductoConStock;
  presentacion?: PresentacionConStock;
  extrasSeleccionados?: ExtraCarrito[];
  cantidad: number;
}

interface Props {
  categorias: Categoria[];
  productos:  ProductoConStock[];
  historialInicial: AutoconsumoHistorial[];
}

function itemKey(producto: ProductoConStock, presentacion?: PresentacionConStock, extras?: ExtraCarrito[]): string {
  const firma = firmaExtras((extras ?? []).map((e) => ({ id: e.fkeCodOpcionExtra, eCantidad: e.eCantidad })));
  return `${producto.eCodProduct}_${presentacion?.eCodPresentacion ?? ""}_${firma}`;
}

export function AutoconsumoClient({ categorias, productos, historialInicial }: Props) {
  const router = useRouter();
  const [categoriaActiva, setCategoriaActiva] = useState("todas");
  const [busqueda, setBusqueda]               = useState("");
  const [carrito, setCarrito]                 = useState<ItemCarrito[]>([]);
  const [nota, setNota]                       = useState("");
  const [enviando, setEnviando]               = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [historial, setHistorial]             = useState(historialInicial);

  const productosFiltrados = productos.filter((p) => {
    const coincideCategoria = categoriaActiva === "todas" || p.fkeCodCategory === categoriaActiva;
    const coincideBusqueda  = p.tNameProduct.toLowerCase().includes(busqueda.toLowerCase());
    return coincideCategoria && coincideBusqueda;
  });

  const conteoPorCategoria: Record<string, number> = {
    todas: productos.length,
    ...Object.fromEntries(
      categorias.map((c) => [c.eCodCategory, productos.filter((p) => p.fkeCodCategory === c.eCodCategory).length])
    ),
  };

  function agregarProducto(producto: ProductoConStock, presentacion?: PresentacionConStock, extras?: ExtraCarrito[]) {
    setError(null);
    const key   = itemKey(producto, presentacion, extras);
    const stock = presentacion?.stockDisponible ?? producto.stockDisponible;
    const bInf  = presentacion?.bInfinito ?? producto.bInfinito;

    setCarrito((prev) => {
      const existe = prev.find((i) => i.key === key);
      if (existe) {
        if (!bInf && existe.cantidad >= stock) return prev;
        return prev.map((i) => (i.key === key ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [...prev, { key, producto, presentacion, extrasSeleccionados: extras, cantidad: 1 }];
    });
  }

  function cambiarCantidad(key: string, delta: number) {
    setError(null);
    setCarrito((prev) =>
      prev
        .map((i) => {
          if (i.key !== key) return i;
          const stock = i.presentacion?.stockDisponible ?? i.producto.stockDisponible;
          const bInf  = i.presentacion?.bInfinito ?? i.producto.bInfinito;
          const nueva = i.cantidad + delta;
          if (!bInf && nueva > stock) return i;
          return { ...i, cantidad: nueva };
        })
        .filter((i) => i.cantidad > 0)
    );
  }

  function quitarItem(key: string) {
    setCarrito((prev) => prev.filter((i) => i.key !== key));
  }

  async function handleRegistrar() {
    if (carrito.length === 0) return;
    setEnviando(true);
    setError(null);

    const result = await crearAutoconsumo(
      carrito.map((i) => ({
        eCodProduct:      i.producto.eCodProduct,
        eCodPresentacion: i.presentacion?.eCodPresentacion,
        cantidad:         i.cantidad,
        extrasSeleccionados: i.extrasSeleccionados?.map((e) => ({
          eCodOpcionExtra: e.fkeCodOpcionExtra,
          eCantidad:       e.eCantidad,
        })),
      })),
      nota,
    );

    setEnviando(false);

    if ("error" in result) {
      setError(result.error ?? "Error desconocido");
      toast.error(result.error ?? "Error al registrar autoconsumo");
      return;
    }

    toast.success("Autoconsumo registrado");
    setHistorial((prev) => [
      {
        eCodAutoconsumo:     result.eCodAutoconsumo,
        fhCreateAutoconsumo: new Date().toISOString(),
        tNota:               nota.trim() || null,
        items: carrito.map((i) => ({
          tNombreProductoSnapshot:     i.producto.tNameProduct,
          tNombrePresentacionSnapshot: i.presentacion?.tNombre ?? null,
          eCantidad:                   i.cantidad,
          ePrecioReferenciaSnapshot:   i.presentacion?.ePricePresentacion ?? i.producto.ePriceProduct,
          extras: (i.extrasSeleccionados ?? []).map((e) => ({
            tNombreSnapshot:       e.tNombreOpcion,
            eCantidadSeleccionada: e.eCantidad,
          })),
        })),
      },
      ...prev,
    ]);
    setCarrito([]);
    setNota("");
    router.refresh();
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTexto}>
          <h1 className={styles.titulo}>
            <GlassWater size={20} className={styles.tituloIcono} />
            Autoconsumo
          </h1>
          <p className={styles.subtitulo}>
            Registra lo que tomes o comas para ti, descuenta inventario e insumos, pero no se cobra ni afecta tu corte de caja.
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        <Buscador valor={busqueda} onChange={setBusqueda} />
        <CategoriaCarrusel
          categorias={categorias}
          categoriaActiva={categoriaActiva}
          conteoPorCategoria={conteoPorCategoria}
          onSeleccionar={setCategoriaActiva}
        />
        <ProductoGrid productos={productosFiltrados} onAgregar={agregarProducto} />
      </div>

      <div className={styles.panel}>
          <p className={styles.panelTitulo}>
            <Coffee size={14} />
            Tu selección
          </p>

          {carrito.length === 0 ? (
            <div className={styles.panelVacio}>
              <p>Agrega lo que vas a consumir</p>
            </div>
          ) : (
            <div className={styles.panelLista}>
              {carrito.map((item) => (
                <div key={item.key} className={styles.itemFila}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemNombre}>{item.producto.tNameProduct}</span>
                    {item.presentacion && <span className={styles.itemPres}>{item.presentacion.tNombre}</span>}
                    {item.extrasSeleccionados && item.extrasSeleccionados.length > 0 && (
                      <span className={styles.itemExtras}>
                        {item.extrasSeleccionados.map((e) => e.tNombreOpcion).join(", ")}
                      </span>
                    )}
                  </div>
                  <div className={styles.itemAcciones}>
                    <button type="button" className={styles.btnCantidad} onClick={() => cambiarCantidad(item.key, -1)}>
                      <Minus size={12} />
                    </button>
                    <span className={styles.itemCantidad}>{item.cantidad}</span>
                    <button type="button" className={styles.btnCantidad} onClick={() => cambiarCantidad(item.key, 1)}>
                      <Plus size={12} />
                    </button>
                    <button type="button" className={styles.btnQuitar} onClick={() => quitarItem(item.key)} aria-label="Quitar">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <textarea
            className={styles.nota}
            placeholder="Nota (opcional)"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
          />

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.btnRegistrar}
            onClick={handleRegistrar}
            disabled={carrito.length === 0 || enviando}
          >
            {enviando ? "Registrando…" : "Registrar autoconsumo"}
          </button>

          {historial.length > 0 && (
            <div className={styles.historial}>
              <p className={styles.historialTitulo}>Autoconsumo reciente</p>
              {historial.map((h) => (
                <div key={h.eCodAutoconsumo} className={styles.historialItem}>
                  <div className={styles.historialHeader}>
                    <span className={styles.historialHora}>{formatFechaHora(h.fhCreateAutoconsumo)}</span>
                  </div>
                  <div className={styles.historialDetalle}>
                    {h.items.map((i, idx) => (
                      <div key={idx} className={styles.historialProducto}>
                        <p className={styles.historialLinea}>
                          {i.eCantidad}× {i.tNombreProductoSnapshot}
                          {i.tNombrePresentacionSnapshot ? ` (${i.tNombrePresentacionSnapshot})` : ""}
                        </p>
                        {i.extras.length > 0 && (
                          <ul className={styles.historialExtras}>
                            {i.extras.map((e, eIdx) => (
                              <li key={eIdx}>
                                {e.eCantidadSeleccionada > 1 ? `${e.eCantidadSeleccionada}× ` : ""}{e.tNombreSnapshot}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                  {h.tNota && <p className={styles.historialNota}>{h.tNota}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}

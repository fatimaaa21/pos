"use client";

import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Trash2, Pencil } from "lucide-react";
import type { Inventario, Producto } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCards } from "@/components/ui/Statscards";
import { type FiltrosUsuario, TablaToolbar } from "@/components/ui/TablaToolbar";
import { DataTable, type ColumnaTabla } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ModalAgregarStock } from "./ModalAgregarStock";
import { ModalVerStock } from "./ModalVerStock";
import { ModalEditarStock } from "./ModalEditarStock";
import { ToastConfirmarEliminar } from "@/components/ui/ToastConfirmarEliminar/ToastConfirmarEliminar";
import { eliminarInventario, toggleEstadoInventario } from "@/lib/actions/inventario";
import { getEstadoStock } from "@/types";
import styles from "./inventario.module.css";

export interface InventarioConProducto extends Inventario {
  productos?: {
    tNameProduct:  string;
    ImgProduct?:   string;
    ePriceProduct: number;
    categorias?: {
      eCodCategory:  string;
      tNameCategory: string;
    };
  };
  // Presentación vinculada a este lote (null si el producto no usa presentaciones)
  presentaciones?: {
    tNombre:            string;
    ePricePresentacion: number;
  } | null;
}

interface Props {
  inventario: InventarioConProducto[];
}

export function InventarioClient({ inventario: inicial }: Props) {
  const [inventario, setInventario] = useState<InventarioConProducto[]>(inicial);
  const [busqueda, setBusqueda]     = useState("");
  const router                      = useRouter();
  const [filtros, setFiltros]       = useState<FiltrosUsuario>({
    busqueda: "", roles: [], estados: [], categorias: [], stocks: [],
  });
  const [modalAgregar, setModalAgregar] = useState(false);
  const [stockVer,     setStockVer]     = useState<InventarioConProducto | null>(null);
  const [stockEditar,  setStockEditar]  = useState<InventarioConProducto | null>(null);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [loteAEliminar, setLoteAEliminar] = useState<InventarioConProducto | null>(null);
  const [eliminando,  setEliminando]    = useState<string | null>(null);
  const [toggleando,  setToggleando]    = useState<string | null>(null);

  // ── Opciones de categoría ─────────────────────────────────────────────────
  const opcionesCategorias = Array.from(
    new Map(
      inventario
        .filter((c) => c.productos?.categorias)
        .map((c) => [
          c.productos!.categorias!.eCodCategory,
          {
            value: c.productos!.categorias!.eCodCategory,
            label: c.productos!.categorias!.tNameCategory,
          },
        ])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtradas = inventario.filter((c) => {
    const texto           = filtros.busqueda.toLowerCase();
    const nombreProducto  = c.productos?.tNameProduct?.toLowerCase() ?? "";
    const nombreCategoria = c.productos?.categorias?.tNameCategory?.toLowerCase() ?? "";
    const nombrePres      = c.presentaciones?.tNombre?.toLowerCase() ?? "";
    const coincideTexto   =
      !texto ||
      nombreProducto.includes(texto) ||
      nombreCategoria.includes(texto) ||
      nombrePres.includes(texto);

    const estadoValor    = c.bStateInventory ? "activo" : "inactivo";
    const coincideEstado = filtros.estados.length === 0 || filtros.estados.includes(estadoValor);

    const codCategoria      = c.productos?.categorias?.eCodCategory ?? "";
    const coincideCategoria = !filtros.categorias?.length || filtros.categorias.includes(codCategoria);

    const estadoStock = getEstadoStock(c.eCantRestante, c.eStockMinimo);
    const stockNorm   = estadoStock === "ilimitado" ? "disponible" : estadoStock;
    const coincideStock = !filtros.stocks?.length || filtros.stocks.includes(stockNorm);

    return coincideTexto && coincideEstado && coincideCategoria && coincideStock;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handleStockAgregado(nuevo: InventarioConProducto) {
  setInventario((prev) => [nuevo, ...prev]);
  setModalAgregar(false);
  router.refresh();
  const nombre = (nuevo as any).productos?.tNameProduct ?? "Producto";
  toast.success(`Stock de "${nombre}" agregado`);
}

  function handleStockEditado(actualizado: InventarioConProducto) {
  setInventario((prev) =>
    prev.map((c) => c.eCodInventory === actualizado.eCodInventory ? actualizado : c)
  );
  setStockEditar(null);
  router.refresh();
  const nombre = actualizado.productos?.tNameProduct ?? "Producto";
  toast.success(`Stock de "${nombre}" actualizado`);
}

  function handleEliminar(lote: InventarioConProducto) {
    setLoteAEliminar(lote);
  }
  
  async function confirmarEliminar() {
  if (!loteAEliminar) return;
  setEliminando(loteAEliminar.eCodInventory);
  const result = await eliminarInventario(loteAEliminar.eCodInventory);
  setEliminando(null);
  if (!result?.error) {
    setInventario((prev) =>
      prev.filter((i) => i.eCodInventory !== loteAEliminar.eCodInventory)
    );
    const nombre = loteAEliminar.productos?.tNameProduct ?? "Lote";
    toast.success(`Lote de "${nombre}" eliminado`);
    setLoteAEliminar(null);
  } else {
    toast.error(result.error);
    setLoteAEliminar(null);
  }
}

  function getNombreLote(lote: InventarioConProducto): string {
    const base = lote.productos?.tNameProduct ?? "Lote";
    const pres = lote.presentaciones?.tNombre;
    return pres ? `${base} – ${pres}` : base;
  }

  async function handleToggle(item: InventarioConProducto) {
  setToggleando(item.eCodInventory);
  const result = await toggleEstadoInventario(item.eCodInventory, !item.bStateInventory);
  if (!result?.error) {
    setInventario((prev) =>
      prev.map((i) =>
        i.eCodInventory === item.eCodInventory
          ? { ...i, bStateInventory: !i.bStateInventory }
          : i
      )
    );
    const nombre = item.productos?.tNameProduct ?? "Lote";
    const nuevoEstado = !item.bStateInventory;
    toast.success(`${nombre} ${nuevoEstado ? "activado" : "desactivado"}`);
  } else {
    toast.error(`No se pudo cambiar el estado: ${result.error}`);
  }
  setToggleando(null);
}

  async function recargar() {
    const supabase = createClient();
    const { data } = await supabase
      .from("vista_inventario")
      .select(`
        *,
        productos!inventario_fkeCodProduct_fkey (
          tNameProduct, ImgProduct, ePriceProduct,
          categorias ( eCodCategory, tNameCategory )
        ),
        presentaciones ( tNombre, ePricePresentacion )
      `)
      .order("fhCreateInventory", { ascending: false });
    if (data) setInventario(data as InventarioConProducto[]);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const disponibles = inventario.filter((p) => {
    const e = getEstadoStock(p.eCantRestante, p.eStockMinimo);
    return e === "disponible" || e === "ilimitado";
  }).length;
  const stockBajo = inventario.filter(
    (p) => getEstadoStock(p.eCantRestante, p.eStockMinimo) === "bajo"
  ).length;
  const agotados = inventario.filter(
    (p) => getEstadoStock(p.eCantRestante, p.eStockMinimo) === "agotado"
  ).length;

  // ── Columnas ──────────────────────────────────────────────────────────────
  const columnas: ColumnaTabla<InventarioConProducto>[] = [
    {
      key: "tNameProduct",
      label: "Producto",
      render: (c) => {
        const producto = c.productos;
        const pres     = c.presentaciones;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className={styles.avatar}>
              {producto?.ImgProduct ? (
                <img
                  src={producto.ImgProduct}
                  alt={producto.tNameProduct ?? "Producto"}
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <span>📦</span>
              )}
            </div>
            <div>
              <span style={{ fontWeight: 600 }}>
                {producto?.tNameProduct ?? "Sin nombre"}
              </span>
              {pres?.tNombre && (
                <span style={{
                  marginLeft: 5,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--gray)",
                }}>
                  ({pres.tNombre})
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "tNameCategory",
      label: "Categoría",
      render: (c) => (
        <span>{c.productos?.categorias?.tNameCategory ?? "Sin categoría"}</span>
      ),
    },
    {
      key: "eCantIngresada",
      label: "Ingresadas",
      render: (c) => <span>{c.eCantIngresada}</span>,
    },
    {
      key: "eCantVendida",
      label: "Vendidas",
      render: (c) => <span>{c.eCantVendida ?? 0}</span>,
    },
    {
      key: "eCantRestante",
      label: "Restantes",
      render: (c) => {
        const estado = getEstadoStock(c.eCantRestante, c.eStockMinimo);
        const variante =
          estado === "ilimitado" ? "ilimitado"  as const
          : estado === "bajo"    ? "bajo"        as const
          : estado === "agotado" ? "agotado"     as const
          : "disponible"                          as const;
        return (
          <Badge variante={variante} dot={false}>
            {c.eCantRestante}
          </Badge>
        );
      },
    },
    {
      key: "ePriceProduct",
      label: "Precio",
      render: (c) => {
        // Si tiene presentación, mostrar el precio de la presentación
        const precio = c.presentaciones?.ePricePresentacion ?? c.productos?.ePriceProduct;
        return <span>$ {precio?.toFixed(2) ?? "—"}</span>;
      },
    },
    {
      key: "bStateInventory",
      label: "Estado",
      render: (c) => (
        <Badge
          activo={c.bStateInventory}
          onToggle={() => handleToggle(c)}
          toggling={toggleando === c.eCodInventory}
        />
      ),
    },
    {
      key: "acciones",
      label: "Acciones",
      render: (c) => (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <ActionBtn title="Ver detalles" onClick={() => setStockVer(c)}>
            <Eye size={18} />
          </ActionBtn>
          {!c.bUnlimitedInventory && (
            <ActionBtn title="Agregar unidades" onClick={() => setStockEditar(c)}>
              <Pencil size={18} />
            </ActionBtn>
          )}
          <ActionBtn
            title="Eliminar"
            onClick={() => handleEliminar(c)}
            loading={eliminando === c.eCodInventory}
            danger
          >
            <Trash2 size={18} />
          </ActionBtn>
        </div>
      ),
    },
  ];

  return (
    <div className="container">
      <PageHeader
        titulo="Inventario"
        descripcion="Control de stock por turno"
        boton={{ label: "Agregar stock", onClick: () => setModalAgregar(true) }}
      />

      <StatCards stats={[
        { label: "Productos en inventario", value: inventario.length, variante: "primary" },
        { label: "Disponibles",             value: disponibles,        variante: "success" },
        { label: "Stock bajo",              value: stockBajo,          variante: "warning" },
        { label: "Agotados",                value: agotados,           variante: "error"   },
      ]} />

      <TablaToolbar
        filtros={filtros}
        onChange={setFiltros}
        total={filtradas.length}
        ocultarRol
        opcionesCategorias={opcionesCategorias}
        mostrarStock
      />

      <DataTable
        columnas={columnas}
        datos={filtradas}
        keyExtractor={(c) => c.eCodInventory}
        seleccionable
        seleccionados={seleccionados}
        onSeleccionar={setSeleccionados}
        vacio="No hay productos en inventario"
      />

      {modalAgregar && (
        <ModalAgregarStock
          onClose={() => setModalAgregar(false)}
          onAgregado={handleStockAgregado}
        />
      )}
      {stockVer && (
        <ModalVerStock
          inventario={stockVer}
          onClose={() => setStockVer(null)}
        />
      )}
      {stockEditar && (
        <ModalEditarStock
          inventario={stockEditar}
          onClose={() => setStockEditar(null)}
          onEditado={handleStockEditado}
        />
      )}
      {loteAEliminar && (
      <ToastConfirmarEliminar
        tipo="lote de inventario"
        nombre={getNombreLote(loteAEliminar)}
        onConfirmar={confirmarEliminar}
        onCancelar={() => setLoteAEliminar(null)}
        cargando={eliminando === loteAEliminar.eCodInventory}
      />
    )}
    </div>
  );
}

function ActionBtn({
  children, title, onClick, danger, loading,
}: {
  children: React.ReactNode;
  title:    string;
  onClick:  () => void;
  danger?:  boolean;
  loading?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={loading}
      className={`${styles.actionBtn} ${danger ? styles.actionBtnDanger : ""}`}
    >
      {loading ? "⏳" : children}
    </button>
  );
}